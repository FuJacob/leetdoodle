package com.leetdoodle.collab.handler;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.leetdoodle.collab.canvas.CanvasServiceClient;
import com.leetdoodle.collab.canvas.CanvasSnapshotResponse;
import com.leetdoodle.collab.canvas.CommittedCanvasOperationResponse;
import com.leetdoodle.collab.canvas.StructuralOperationRequest;
import com.leetdoodle.collab.model.ImmutableJoinMessage;
import com.leetdoodle.collab.model.JoinMessage;
import org.springframework.http.HttpStatus;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * The core of the collab service. Handles every WebSocket lifecycle event:
 * incoming messages, and disconnections.
 *
 * WHAT IS A WEBSOCKET SESSION?
 * When a client connects, Spring creates a WebSocketSession representing that
 * connection. It wraps the underlying TCP socket and lets us send messages
 * back.
 * Think of it like a phone call — the session IS the open line with one client.
 *
 * THE FAN-OUT PATTERN:
 * "Fan-out" means 1 message in → N messages out. When user A moves their
 * cursor,
 * we receive one message and relay it to every other user in that canvas.
 * This is the core operation of real-time collaboration (Figma, Google Docs,
 * multiplayer games all work this way at their foundation).
 *
 * WHY THIS SERVER IS STATEFUL (and why that matters for scaling):
 * Normal REST APIs are stateless — each HTTP request stands alone, the server
 * remembers nothing between requests. This WebSocket server is STATEFUL — it
 * continuously tracks which sessions are in which canvas room. This is what
 * makes
 * real-time servers harder to scale: if you run two instances, user A on
 * instance 1
 * and user B on instance 2 would never see each other. The fix is an external
 * shared broker (Redis pub/sub, Kafka) — we'll tackle that when we add more
 * services.
 */
@Component // marks this as a Spring-managed bean; Spring creates and injects it where
           // needed
public class CanvasWebSocketHandler extends TextWebSocketHandler {

    private static final Set<String> STRUCTURAL_EVENT_TYPES = Set.of(
        "node_create",
        "node_move",
        "node_update",
        "node_delete",
        "edge_create",
        "edge_delete"
    );

    private static final String[] USER_COLORS = {
        "#3b82f6", // blue
        "#10b981", // emerald
        "#f59e0b", // amber
        "#ef4444", // red
        "#06b6d4", // cyan
        "#f97316"  // orange
    };

    /**
     * The room registry: canvasId → all active sessions in that canvas.
     *
     * WHY ConcurrentHashMap AND NOT regular HashMap?
     * A web server handles many requests on different threads simultaneously.
     * Regular HashMap is NOT thread-safe — concurrent modifications can corrupt
     * its internal state or cause infinite loops. ConcurrentHashMap uses
     * fine-grained internal locking so multiple threads can read/write safely.
     *
     * WHY ConcurrentHashMap.newKeySet() FOR THE VALUES?
     * We need a thread-safe Set for the inner collection too. This factory creates
     * a Set backed by a ConcurrentHashMap, giving us the same safety guarantees.
     */
    private final Map<String, Set<WebSocketSession>> canvasSessions = new ConcurrentHashMap<>();

    /**
     * Reverse index: sessionId → canvasId.
     *
     * WHY A SECOND MAP?
     * When a client disconnects, Spring gives us the WebSocketSession but NOT which
     * canvas it was in. Without this map, cleanup would require scanning every
     * canvas's session set — O(N) across all canvases. With this reverse index,
     * cleanup is O(1). Maintaining reverse indexes for efficient cleanup is a
     * common pattern in distributed systems.
     */
    private final Map<String, String> sessionToCanvas = new ConcurrentHashMap<>();

    /**
     * Reverse index: sessionId → userId.
     * Needed to broadcast user_leave events when a connection closes.
     */
    private final Map<String, String> sessionToUserId = new ConcurrentHashMap<>();

    /**
     * Per-canvas presence state keyed by userId.
     *
     * In this app, userId is unique per tab/session, so we do not maintain
     * per-user session ref-counts.
     */
    private final Map<String, CanvasPresenceState> canvasPresence = new ConcurrentHashMap<>();

    /**
     * In-memory CRDT op log per document.
     *
     * Key format: "{canvasId}::{docId}".
     *
     * WHY KEEP AN OP LOG AT THE RELAY?
     * WebSocket fan-out only handles "live" peers. If a user reconnects later,
     * they missed historical operations. The log gives us a replay source so
     * sync_request can return just the missing ops.
     *
     * This is intentionally in-memory for learning simplicity. Production would
     * persist to Redis/Postgres/Kafka so process restarts do not lose history.
     */
    private final Map<String, List<JsonNode>> docOpLog = new ConcurrentHashMap<>();

    /**
     * Dedup set per document for idempotency.
     *
     * CRDT networks are retry-heavy by design. If the same op is re-sent
     * (network retries, reconnect replay, etc.), we must avoid rebroadcasting
     * and duplicating it in the log. Key is "{actor}:{seq}".
     */
    private final Map<String, Set<String>> docSeenOpKeys = new ConcurrentHashMap<>();

    /**
     * Sessions currently waiting for durable bootstrap state from canvas-service.
     *
     * <p>While a session is in this set, committed structural broadcasts are
     * queued rather than sent immediately. Once bootstrap finishes, we flush only
     * the queued events newer than the snapshot's head version.
     */
    private final Set<String> bootstrappingSessions = ConcurrentHashMap.newKeySet();

    /**
     * Per-session queue of structural broadcasts that happened during bootstrap.
     */
    private final Map<String, List<QueuedStructuralMessage>> pendingStructuralMessages = new ConcurrentHashMap<>();

    /**
     * Jackson's ObjectMapper converts Java objects ↔ JSON strings.
     *
     * Injected via constructor (Dependency Injection) rather than `new
     * ObjectMapper()`
     * because Spring Boot auto-configures one with the right settings, it's
     * expensive
     * to create, and tests can swap it out without changing this class.
     */
    private final ObjectMapper objectMapper;
    private final CanvasServiceClient canvasServiceClient;

    private record CollabUser(String id, String displayName, String color) {}
    private record QueuedStructuralMessage(long version, String payload) {}

    private static final class CanvasPresenceState {
        private final Map<String, CollabUser> usersById = new HashMap<>();

        synchronized CollabUser onJoin(String userId, String displayName) {
            CollabUser existing = usersById.get(userId);
            if (existing != null) {
                String normalizedName = normalizeDisplayName(displayName, userId);
                if (!existing.displayName().equals(normalizedName)) {
                    CollabUser updated = new CollabUser(userId, normalizedName, existing.color());
                    usersById.put(userId, updated);
                    return updated;
                }
                return existing;
            }

            String color = nextColor();
            CollabUser created = new CollabUser(userId, normalizeDisplayName(displayName, userId), color);
            usersById.put(userId, created);
            return created;
        }

        synchronized boolean onLeave(String userId) {
            return usersById.remove(userId) != null;
        }

        synchronized List<CollabUser> snapshotUsers() {
            List<CollabUser> users = new ArrayList<>(usersById.values());
            users.sort(java.util.Comparator.comparing(CollabUser::id));
            return users;
        }

        synchronized boolean isEmpty() {
            return usersById.isEmpty();
        }

        private String nextColor() {
            Set<String> used = new HashSet<>();
            for (CollabUser user : usersById.values()) {
                used.add(user.color());
            }
            for (String color : USER_COLORS) {
                if (!used.contains(color)) {
                    return color;
                }
            }
            int index = usersById.size() % USER_COLORS.length;
            return USER_COLORS[index];
        }

        private String normalizeDisplayName(String displayName, String fallbackUserId) {
            if (displayName == null) {
                return fallbackUserId;
            }
            String normalized = displayName.trim();
            if (normalized.isEmpty()) {
                return fallbackUserId;
            }
            return normalized.length() <= 24 ? normalized : normalized.substring(0, 24);
        }
    }

    public CanvasWebSocketHandler(ObjectMapper objectMapper, CanvasServiceClient canvasServiceClient) {
        this.objectMapper = objectMapper;
        this.canvasServiceClient = canvasServiceClient;
    }

    /**
     * Called once per incoming message. Every message from every client arrives
     * here.
     *
     * We use a TYPE DISCRIMINATOR pattern: parse just enough JSON to read the
     * "type"
     * field, then route to the right handler. This same idea appears in Kafka
     * consumers,
     * gRPC service dispatch, actor systems, and event buses.
     *
     * SPLIT TRANSPORT MODEL:
     * - ephemeral events (cursor, drag lifecycle, draw preview) still relay
     *   directly in-memory for low latency
     * - durable structural events (node/edge graph changes) round-trip through
     *   canvas-service first, then collab broadcasts the committed versioned
     *   event to peers
     *
     * This keeps collab fast where it should be fast, while moving durable
     * structural truth out of the websocket process.
     */
    @Override
    protected void handleTextMessage(@NonNull WebSocketSession session, @NonNull TextMessage message) throws Exception {
        JsonNode root = objectMapper.readTree(message.getPayload());
        JsonNode typeNode = root.get("type");
        if (typeNode == null) {
            System.out.println("Warning: incoming message missing type field");
            return;
        }
        String type = typeNode.asText();

        switch (type) {
            // Join is special: it registers the session in a canvas room
            case "join" ->
                handleJoin(session, objectMapper.treeToValue(root, ImmutableJoinMessage.class));

            // CRDT ops are logged + deduplicated + fanned out.
            // This gives us reconnection replay without changing the relay model.
            case "crdt_op" -> handleCrdtOp(session, root, message.getPayload());

            // sync_request is not broadcast. It's a point-to-point response that
            // returns only ops the requester has not yet integrated.
            case "sync_request" -> handleSyncRequest(session, root);

            case "node_create",
                 "node_move",
                 "node_update",
                 "node_delete",
                 "edge_create",
                 "edge_delete" -> handleStructuralEvent(session, root, type);

            // Everything else is treated as ephemeral relay traffic.
            default -> broadcastToCanvas(session, message.getPayload());
        }
    }

    /**
     * Registers this session in a canvas room so it can receive future broadcasts.
     *
     * computeIfAbsent is ATOMIC: it checks if the key exists and, if not, creates
     * the value — all in one thread-safe step. Without atomicity, two users joining
     * simultaneously could both see "no set exists", both create one, and one would
     * be silently lost. This is a race condition — a class of bug that only appears
     * under concurrent load and is notoriously hard to reproduce in testing.
     */
    private void handleJoin(WebSocketSession session, JoinMessage msg) throws Exception {
        bootstrappingSessions.add(session.getId());
        pendingStructuralMessages.put(session.getId(), new ArrayList<>());

        canvasSessions
                .computeIfAbsent(msg.canvasId(), k -> ConcurrentHashMap.newKeySet())
                .add(session);

        // Record reverse mappings so afterConnectionClosed can clean up and broadcast
        // user_leave
        sessionToCanvas.put(session.getId(), msg.canvasId());
        sessionToUserId.put(session.getId(), msg.userId());

        CanvasPresenceState presenceState =
            canvasPresence.computeIfAbsent(msg.canvasId(), ignored -> new CanvasPresenceState());
        CollabUser joinedUser = presenceState.onJoin(msg.userId(), msg.displayName());

        System.out.printf("User %s joined canvas %s (total sessions in canvas: %d)%n",
                msg.userId(), msg.canvasId(), canvasSessions.get(msg.canvasId()).size());

        CanvasSnapshotResponse snapshot = canvasServiceClient.getSnapshot(msg.canvasId());

        sendPresenceSnapshot(session, presenceState.snapshotUsers());
        sendCanvasBootstrap(session, snapshot);
        flushBootstrappedStructuralMessages(session, snapshot.headVersion());

        // userId is tab-unique, so every join is a distinct presence participant.
        broadcastUserJoin(msg.canvasId(), session.getId(), joinedUser);
    }

    /**
     * Persist one structural mutation through canvas-service, then broadcast the
     * committed versioned event to peers.
     *
     * <p>This replaces the old "optimistic opaque relay" path for structural
     * state. Ephemeral events can still relay immediately, but nodes/edges now
     * broadcast only after the durable write succeeds.
     */
    private void handleStructuralEvent(WebSocketSession session, JsonNode root, String type) throws Exception {
        String canvasId = sessionToCanvas.get(session.getId());
        String actorUserId = sessionToUserId.get(session.getId());
        if (canvasId == null || actorUserId == null) {
            System.out.println("Warning: structural event from session that hasn't joined: " + session.getId());
            return;
        }

        StructuralOperationRequest request = new StructuralOperationRequest(
            structuralClientOperationId(root, session),
            actorUserId,
            structuralOperationType(type),
            structuralPayloadFor(type, root)
        );

        CommittedCanvasOperationResponse committed = canvasServiceClient.commitStructuralOperation(canvasId, request);
        String committedPayload = objectMapper.writeValueAsString(
            structuralBroadcastMessage(canvasId, committed)
        );
        sendToSession(session, new TextMessage(committedPayload));
        broadcastStructuralToCanvas(canvasId, session.getId(), committed.version(), committedPayload);
    }

    /**
     * Handles one CRDT operation envelope.
     *
     * Responsibilities:
     * 1) Validate minimally required routing fields
     * 2) Deduplicate by op key (actor:seq)
     * 3) Append to per-doc op log for future replay
     * 4) Fan-out to live peers in the same canvas
     *
     * WHY DEDUP AT THE RELAY?
     * CRDT operations are idempotent on clients, but dedup at relay still matters:
     * - reduces network amplification under retry storms
     * - keeps replay logs compact
     * - simplifies debugging (one canonical entry per op)
     */
    private void handleCrdtOp(WebSocketSession session, JsonNode root, String rawPayload) throws Exception {
        String canvasId = readText(root, "canvasId");
        String docId = readText(root, "docId");
        JsonNode op = root.get("op");

        if (canvasId == null || docId == null || op == null) {
            System.out.println("Warning: invalid crdt_op payload, missing canvasId/docId/op");
            return;
        }

        String docKey = docKey(canvasId, docId);
        String opKey = opKey(op);

        // If actor/seq is missing, we cannot deduplicate safely, so we still relay
        // but avoid polluting replay log with unkeyed entries.
        if (opKey == null) {
            System.out.println("Warning: crdt_op missing actor/seq, relaying without log append");
            broadcastToCanvas(session, rawPayload);
            return;
        }

        Set<String> seen = docSeenOpKeys.computeIfAbsent(docKey, k -> ConcurrentHashMap.newKeySet());
        if (!seen.add(opKey)) {
            // Duplicate op (retry/replay). Drop silently.
            return;
        }

        List<JsonNode> log = docOpLog.computeIfAbsent(docKey, k -> new ArrayList<>());
        synchronized (log) {
            // Deep copy prevents accidental mutation if caller reuses mutable JsonNodes.
            log.add(op.deepCopy());
        }

        broadcastToCanvas(session, rawPayload);
    }

    /**
     * Responds to sync_request with only the operations the requester is missing.
     *
     * Request payload shape:
     * {
     * "type": "sync_request",
     * "canvasId": "...",
     * "docId": "...",
     * "stateVector": { "actorA": 12, "actorB": 4 }
     * }
     *
     * Response payload shape:
     * {
     * "type": "sync_response",
     * "docId": "...",
     * "ops": [ ... ]
     * }
     */
    private void handleSyncRequest(WebSocketSession session, JsonNode root) throws Exception {
        String canvasId = readText(root, "canvasId");
        String docId = readText(root, "docId");

        if (canvasId == null || docId == null) {
            System.out.println("Warning: invalid sync_request payload, missing canvasId/docId");
            return;
        }

        JsonNode vectorNode = root.get("stateVector");
        String docKey = docKey(canvasId, docId);
        List<JsonNode> log = docOpLog.getOrDefault(docKey, List.of());
        List<JsonNode> missing = new ArrayList<>();

        synchronized (log) {
            for (JsonNode op : log) {
                String actor = readText(op, "actor");
                Integer seq = readInt(op, "seq");
                if (actor == null || seq == null)
                    continue;

                int seenSeq = -1;
                if (vectorNode != null && vectorNode.has(actor)) {
                    seenSeq = vectorNode.get(actor).asInt(-1);
                }

                if (seq > seenSeq) {
                    missing.add(op);
                }
            }
        }

        ObjectNode response = objectMapper.createObjectNode();
        response.put("type", "sync_response");
        response.put("docId", docId);
        ArrayNode ops = response.putArray("ops");
        for (JsonNode op : missing) {
            ops.add(op);
        }

        TextMessage outbound = new TextMessage(
            Objects.requireNonNull(objectMapper.writeValueAsString(response))
        );
        sendToSession(session, outbound);
    }

    /**
     * Generic broadcast for ephemeral events: forwards a message to all OTHER
     * sessions in the same canvas.
     *
     * This path intentionally stays lightweight and schema-agnostic because it is
     * used for low-latency signals where durable sequencing does not matter.
     *
     * ORDERING NOTE:
     * We don't guarantee message ordering. Rapid updates from user A might arrive
     * at user B slightly out of order due to thread scheduling. For cursors and
     * node moves this is fine — a stale position for one frame is invisible. For
     * collaborative text editing, ordering is critical and requires Operational
     * Transforms (OT) or CRDTs.
     */
    private void broadcastToCanvas(WebSocketSession session, String payload) throws Exception {
        String canvasId = sessionToCanvas.get(session.getId());

        // Guard: client sent message before joining — no canvas to route to.
        // Defensive programming: never assume messages arrive in the right order.
        if (canvasId == null) {
            System.out.println("Warning: message from session that hasn't joined: " + session.getId());
            return;
        }

        broadcastToCanvas(canvasId, session.getId(), payload);
    }

    private void broadcastToCanvas(String canvasId, String senderSessionId, String payload) throws Exception {
        TextMessage outbound = new TextMessage(Objects.requireNonNull(payload));
        for (WebSocketSession peer : canvasSessions.getOrDefault(canvasId, Set.of())) {
            if (!peer.isOpen())
                continue; // skip dead sessions
            if (peer.getId().equals(senderSessionId))
                continue; // don't echo to sender

            // WHY synchronized(peer)?
            // WebSocketSession.sendMessage() is NOT thread-safe. If two threads call
            // it on the same session concurrently, the WebSocket frames can get corrupted.
            // synchronized(peer) ensures only one thread sends to a given peer at a time.
            sendToSession(peer, outbound);
        }
    }

    private void broadcastStructuralToCanvas(String canvasId,
                                             String senderSessionId,
                                             long version,
                                             String payload) throws Exception {
        for (WebSocketSession peer : canvasSessions.getOrDefault(canvasId, Set.of())) {
            if (!peer.isOpen()) {
                continue;
            }
            if (peer.getId().equals(senderSessionId)) {
                continue;
            }
            if (bootstrappingSessions.contains(peer.getId())) {
                queueStructuralMessage(peer.getId(), version, payload);
                continue;
            }
            sendToSession(peer, new TextMessage(payload));
        }
    }

    private void sendPresenceSnapshot(WebSocketSession session, List<CollabUser> users) throws Exception {
        ObjectNode response = objectMapper.createObjectNode();
        response.put("type", "presence_snapshot");
        ArrayNode usersNode = response.putArray("users");
        for (CollabUser user : users) {
            ObjectNode userNode = usersNode.addObject();
            userNode.put("id", user.id());
            userNode.put("displayName", user.displayName());
            userNode.put("color", user.color());
        }
        sendToSession(session, new TextMessage(
            Objects.requireNonNull(objectMapper.writeValueAsString(response))
        ));
    }

    private void broadcastUserJoin(String canvasId, String senderSessionId, CollabUser user) throws Exception {
        ObjectNode response = objectMapper.createObjectNode();
        response.put("type", "user_join");
        ObjectNode userNode = response.putObject("user");
        userNode.put("id", user.id());
        userNode.put("displayName", user.displayName());
        userNode.put("color", user.color());
        broadcastToCanvas(canvasId, senderSessionId, objectMapper.writeValueAsString(response));
    }

    private void broadcastUserLeave(String canvasId, String senderSessionId, String userId) throws Exception {
        ObjectNode response = objectMapper.createObjectNode();
        response.put("type", "user_leave");
        response.put("userId", userId);
        broadcastToCanvas(canvasId, senderSessionId, objectMapper.writeValueAsString(response));
    }

    private void sendToSession(WebSocketSession session, TextMessage message) throws Exception {
        if (!session.isOpen()) {
            return;
        }
        synchronized (session) {
            session.sendMessage(Objects.requireNonNull(message));
        }
    }

    private void sendCanvasBootstrap(WebSocketSession session, CanvasSnapshotResponse snapshot) throws Exception {
        ObjectNode response = objectMapper.createObjectNode();
        response.put("type", "canvas_bootstrap");
        response.put("canvasId", snapshot.canvasId());
        response.put("headVersion", snapshot.headVersion());
        response.set("nodes", snapshot.nodes() == null ? objectMapper.createArrayNode() : snapshot.nodes().deepCopy());
        response.set("edges", snapshot.edges() == null ? objectMapper.createArrayNode() : snapshot.edges().deepCopy());
        sendToSession(session, new TextMessage(
            Objects.requireNonNull(objectMapper.writeValueAsString(response))
        ));
    }

    private void flushBootstrappedStructuralMessages(WebSocketSession session, long headVersion) throws Exception {
        String sessionId = session.getId();
        List<QueuedStructuralMessage> queue = pendingStructuralMessages.remove(sessionId);

        synchronized (session) {
            if (queue != null) {
                synchronized (queue) {
                    for (QueuedStructuralMessage queued : queue) {
                        if (queued.version() <= headVersion) {
                            continue;
                        }
                        session.sendMessage(new TextMessage(queued.payload()));
                    }
                }
            }
            bootstrappingSessions.remove(sessionId);
        }
    }

    private void queueStructuralMessage(String sessionId, long version, String payload) {
        List<QueuedStructuralMessage> queue = pendingStructuralMessages.computeIfAbsent(sessionId, ignored -> new ArrayList<>());
        synchronized (queue) {
            queue.add(new QueuedStructuralMessage(version, payload));
        }
    }

    private String docKey(String canvasId, String docId) {
        return canvasId + "::" + docId;
    }

    private String opKey(JsonNode op) {
        String actor = readText(op, "actor");
        Integer seq = readInt(op, "seq");
        if (actor == null || seq == null)
            return null;
        return actor + ":" + seq;
    }

    private String readText(JsonNode node, String field) {
        if (node == null)
            return null;
        JsonNode value = node.get(field);
        if (value == null || value.isNull())
            return null;
        return value.asText();
    }

    private Integer readInt(JsonNode node, String field) {
        if (node == null)
            return null;
        JsonNode value = node.get(field);
        if (value == null || value.isNull())
            return null;
        return value.asInt();
    }

    private String structuralClientOperationId(JsonNode root, WebSocketSession session) {
        String existingId = readText(root, "clientOperationId");
        if (existingId != null && !existingId.isBlank()) {
            return existingId;
        }
        return session.getId() + ":" + UUID.randomUUID();
    }

    private String structuralOperationType(String eventType) {
        return switch (eventType) {
            case "node_create" -> "NODE_CREATE";
            case "node_move" -> "NODE_MOVE";
            case "node_update" -> "NODE_UPDATE";
            case "node_delete" -> "NODE_DELETE";
            case "edge_create" -> "EDGE_CREATE";
            case "edge_delete" -> "EDGE_DELETE";
            default -> throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Unsupported structural event type: " + eventType
            );
        };
    }

    private JsonNode structuralPayloadFor(String eventType, JsonNode root) {
        return switch (eventType) {
            case "node_create" -> requireField(root, "node", eventType).deepCopy();
            case "node_move" -> {
                ObjectNode payload = objectMapper.createObjectNode();
                payload.put("nodeId", requireTextField(root, "nodeId", eventType));
                payload.put("x", requireNumericField(root, "x", eventType));
                payload.put("y", requireNumericField(root, "y", eventType));
                yield payload;
            }
            case "node_update" -> {
                ObjectNode patch = requireField(root, "patch", eventType).deepCopy();
                patch.put("nodeId", requireTextField(root, "nodeId", eventType));
                yield patch;
            }
            case "node_delete" -> {
                ObjectNode payload = objectMapper.createObjectNode();
                payload.put("nodeId", requireTextField(root, "nodeId", eventType));
                yield payload;
            }
            case "edge_create" -> requireField(root, "edge", eventType).deepCopy();
            case "edge_delete" -> {
                ObjectNode payload = objectMapper.createObjectNode();
                payload.put("edgeId", requireTextField(root, "edgeId", eventType));
                yield payload;
            }
            default -> throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Unsupported structural event type: " + eventType
            );
        };
    }

    private ObjectNode structuralBroadcastMessage(String canvasId, CommittedCanvasOperationResponse committed) {
        ObjectNode outbound = objectMapper.createObjectNode();
        outbound.put("canvasId", canvasId);
        outbound.put("userId", committed.actorUserId());
        outbound.put("version", committed.version());
        outbound.put("eventId", committed.id());
        outbound.put("clientOperationId", committed.clientOperationId());

        String operationType = committed.operationType();
        JsonNode payload = committed.payload();

        switch (operationType) {
            case "NODE_CREATE" -> {
                outbound.put("type", "node_create");
                outbound.set("node", payload.deepCopy());
            }
            case "NODE_MOVE" -> {
                outbound.put("type", "node_move");
                outbound.put("nodeId", readText(payload, "nodeId"));
                outbound.put("x", payload.path("x").asDouble());
                outbound.put("y", payload.path("y").asDouble());
            }
            case "NODE_UPDATE" -> {
                outbound.put("type", "node_update");
                outbound.put("nodeId", readText(payload, "nodeId"));
                ObjectNode patch = payload.deepCopy();
                patch.remove("nodeId");
                outbound.set("patch", patch);
            }
            case "NODE_DELETE" -> {
                outbound.put("type", "node_delete");
                outbound.put("nodeId", readText(payload, "nodeId"));
            }
            case "EDGE_CREATE" -> {
                outbound.put("type", "edge_create");
                outbound.set("edge", payload.deepCopy());
            }
            case "EDGE_DELETE" -> {
                outbound.put("type", "edge_delete");
                outbound.put("edgeId", readText(payload, "edgeId"));
            }
            default -> throw new ResponseStatusException(
                HttpStatus.BAD_GATEWAY,
                "canvas-service returned unsupported operation type: " + operationType
            );
        }

        return outbound;
    }

    private ObjectNode requireField(JsonNode node, String field, String eventType) {
        JsonNode value = node.get(field);
        if (value == null || value.isNull() || !value.isObject()) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                eventType + " requires object field '" + field + "'"
            );
        }
        return (ObjectNode) value;
    }

    private String requireTextField(JsonNode node, String field, String eventType) {
        String value = readText(node, field);
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                eventType + " requires text field '" + field + "'"
            );
        }
        return value;
    }

    private double requireNumericField(JsonNode node, String field, String eventType) {
        JsonNode value = node.get(field);
        if (value == null || !value.isNumber()) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                eventType + " requires numeric field '" + field + "'"
            );
        }
        return value.asDouble();
    }

    /**
     * Called automatically when a client disconnects — tab close, network drop,
     * etc.
     *
     * CLEANUP IS NON-NEGOTIABLE in stateful servers. Without it:
     * - canvasSessions grows forever → memory leak
     * - We'd try to send to dead sessions → exceptions and wasted CPU
     * - Users would appear to stay connected long after they've left
     *
     * remove() on ConcurrentHashMap is atomic — safe to call from any thread.
     */
    @Override
    public void afterConnectionClosed(@NonNull WebSocketSession session, @NonNull CloseStatus status) {
        bootstrappingSessions.remove(session.getId());
        pendingStructuralMessages.remove(session.getId());

        // remove() returns the old value atomically, giving us the canvasId to clean up
        String canvasId = sessionToCanvas.remove(session.getId());
        String userId = sessionToUserId.remove(session.getId());
        if (canvasId == null)
            return; // session never joined, nothing to clean up

        CanvasPresenceState presenceState = canvasPresence.get(canvasId);
        boolean userRemovedFromPresence = false;
        if (presenceState != null && userId != null) {
            userRemovedFromPresence = presenceState.onLeave(userId);
        }

        Set<WebSocketSession> sessions = canvasSessions.get(canvasId);
        if (sessions != null) {
            sessions.remove(session);
        }

        if (userRemovedFromPresence && userId != null) {
            try {
                broadcastUserLeave(canvasId, session.getId(), userId);
            } catch (Exception e) {
                System.err.println("Failed to broadcast user_leave: " + e.getMessage());
            }
        }

        // If this was the last active session in the canvas, evict room state.
        // Without this, every canvas ever visited would accumulate in memory forever.
        if (sessions != null && sessions.isEmpty()) {
            canvasSessions.remove(canvasId);
            canvasPresence.remove(canvasId);
            System.out.println("Canvas " + canvasId + " is now empty, removed from registry");
        } else if (presenceState != null && presenceState.isEmpty()) {
            // Defensive cleanup if room state and presence state drift.
            canvasPresence.remove(canvasId, presenceState);
        }

        System.out.println("Session closed: " + session.getId() + " (userId: " + userId + ", status: " + status + ")");
    }
}
