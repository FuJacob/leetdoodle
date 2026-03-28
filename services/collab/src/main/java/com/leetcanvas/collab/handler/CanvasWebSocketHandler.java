package com.leetcanvas.collab.handler;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.leetcanvas.collab.model.ImmutableJoinMessage;
import com.leetcanvas.collab.model.JoinMessage;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * The core of the collab service. Handles every WebSocket lifecycle event:
 * incoming messages, and disconnections.
 *
 * WHAT IS A WEBSOCKET SESSION?
 * When a client connects, Spring creates a WebSocketSession representing that
 * connection. It wraps the underlying TCP socket and lets us send messages back.
 * Think of it like a phone call — the session IS the open line with one client.
 *
 * THE FAN-OUT PATTERN:
 * "Fan-out" means 1 message in → N messages out. When user A moves their cursor,
 * we receive one message and relay it to every other user in that canvas.
 * This is the core operation of real-time collaboration (Figma, Google Docs,
 * multiplayer games all work this way at their foundation).
 *
 * WHY THIS SERVER IS STATEFUL (and why that matters for scaling):
 * Normal REST APIs are stateless — each HTTP request stands alone, the server
 * remembers nothing between requests. This WebSocket server is STATEFUL — it
 * continuously tracks which sessions are in which canvas room. This is what makes
 * real-time servers harder to scale: if you run two instances, user A on instance 1
 * and user B on instance 2 would never see each other. The fix is an external
 * shared broker (Redis pub/sub, Kafka) — we'll tackle that when we add more services.
 */
@Component // marks this as a Spring-managed bean; Spring creates and injects it where needed
public class CanvasWebSocketHandler extends TextWebSocketHandler {

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
     * Jackson's ObjectMapper converts Java objects ↔ JSON strings.
     *
     * Injected via constructor (Dependency Injection) rather than `new ObjectMapper()`
     * because Spring Boot auto-configures one with the right settings, it's expensive
     * to create, and tests can swap it out without changing this class.
     */
    private final ObjectMapper objectMapper;

    public CanvasWebSocketHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * Called once per incoming message. Every message from every client arrives here.
     *
     * We use a TYPE DISCRIMINATOR pattern: parse just enough JSON to read the "type"
     * field, then route to the right handler. This same idea appears in Kafka consumers,
     * gRPC service dispatch, actor systems, and event buses.
     *
     * PURE RELAY ARCHITECTURE:
     * For canvas events (node_create, node_move, etc.), the server doesn't interpret
     * the payload — it just broadcasts the raw JSON to all peers in the same canvas.
     * This keeps the server simple and decoupled from the frontend's data model.
     * The client is the source of truth; the server is just a message router.
     */
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        JsonNode root = objectMapper.readTree(message.getPayload());
        String type = root.get("type").asText();

        switch (type) {
            // Join is special: it registers the session in a canvas room
            case "join" -> handleJoin(session, objectMapper.treeToValue(root, ImmutableJoinMessage.class));

            // All other events: just relay to peers in the same canvas.
            // The server doesn't need to understand the payload — it's opaque bytes.
            // This covers: cursor_move, node_create, node_move, node_update,
            // node_delete, edge_create, edge_delete, and any future event types.
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
    private void handleJoin(WebSocketSession session, JoinMessage msg) {
        System.out.println("handleJoin is being called");
        canvasSessions
                .computeIfAbsent(msg.canvasId(), k -> ConcurrentHashMap.newKeySet())
                .add(session);

        // Record the reverse mapping so afterConnectionClosed can clean up in O(1)
        sessionToCanvas.put(session.getId(), msg.canvasId());

        System.out.printf("User %s joined canvas %s (total sessions in canvas: %d)%n",
            msg.userId(), msg.canvasId(), canvasSessions.get(msg.canvasId()).size());
    }

    /**
     * Generic broadcast: forwards a message to all OTHER sessions in the same canvas.
     * This is the fan-out: 1 message in → (N-1) messages out.
     *
     * PURE RELAY:
     * The server doesn't parse or validate the payload beyond extracting the type.
     * It just forwards the raw JSON string. This means:
     * - Adding new event types requires zero server changes
     * - Frontend schema changes don't break the server
     * - Server stays simple and fast
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

        TextMessage outbound = new TextMessage(payload);

        for (WebSocketSession peer : canvasSessions.getOrDefault(canvasId, Set.of())) {
            if (!peer.isOpen()) continue;                        // skip dead sessions
            if (peer.getId().equals(session.getId())) continue;  // don't echo to sender

            // WHY synchronized(peer)?
            // WebSocketSession.sendMessage() is NOT thread-safe. If two threads call
            // it on the same session concurrently, the WebSocket frames can get corrupted.
            // synchronized(peer) ensures only one thread sends to a given peer at a time.
            synchronized (peer) {
                peer.sendMessage(outbound);
            }
        }
    }

    /**
     * Called automatically when a client disconnects — tab close, network drop, etc.
     *
     * CLEANUP IS NON-NEGOTIABLE in stateful servers. Without it:
     * - canvasSessions grows forever → memory leak
     * - We'd try to send to dead sessions → exceptions and wasted CPU
     * - Users would appear to stay connected long after they've left
     *
     * remove() on ConcurrentHashMap is atomic — safe to call from any thread.
     */
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        // remove() returns the old value atomically, giving us the canvasId to clean up
        String canvasId = sessionToCanvas.remove(session.getId());
        if (canvasId == null) return; // session never joined, nothing to clean up

        Set<WebSocketSession> sessions = canvasSessions.get(canvasId);
        if (sessions != null) {
            sessions.remove(session);
            // If this was the last user, evict the canvas entry entirely.
            // Without this, every canvas ever visited would accumulate in memory forever.
            if (sessions.isEmpty()) {
                canvasSessions.remove(canvasId);
                System.out.println("Canvas " + canvasId + " is now empty, removed from registry");
            }
        }

        System.out.println("Session closed: " + session.getId() + " (status: " + status + ")");
    }
}
