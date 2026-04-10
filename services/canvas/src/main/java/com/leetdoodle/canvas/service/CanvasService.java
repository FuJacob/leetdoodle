package com.leetdoodle.canvas.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.leetdoodle.canvas.model.CanvasEdgeRecord;
import com.leetdoodle.canvas.model.CanvasNodeRecord;
import com.leetdoodle.canvas.model.CanvasOperationType;
import com.leetdoodle.canvas.model.CanvasSnapshot;
import com.leetdoodle.canvas.model.CommittedCanvasOperation;
import com.leetdoodle.canvas.model.EdgeCreatePayload;
import com.leetdoodle.canvas.model.EdgeDeletePayload;
import com.leetdoodle.canvas.model.NodeCreatePayload;
import com.leetdoodle.canvas.model.NodeDeletePayload;
import com.leetdoodle.canvas.model.NodeMovePayload;
import com.leetdoodle.canvas.model.NodeUpdatePayload;
import com.leetdoodle.canvas.model.StructuralOperationRequest;
import com.leetdoodle.canvas.repository.CanvasEdgeRepository;
import com.leetdoodle.canvas.repository.CanvasNodeRepository;
import com.leetdoodle.canvas.repository.CanvasOperationRepository;
import com.leetdoodle.canvas.repository.CanvasRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.OptionalLong;

/**
 * Application service for durable structural canvas operations.
 *
 * <p>This service owns the "persisted truth" for nodes, edges, and structural
 * sequencing. Collab already calls into this service for durable operations
 * while continuing to relay ephemeral events like cursors in memory.
 */
@Service
public class CanvasService {

    private static final int DEFAULT_OP_LIMIT = 200;
    private static final int MAX_OP_LIMIT = 1_000;

    private final CanvasRepository canvasRepository;
    private final CanvasNodeRepository canvasNodeRepository;
    private final CanvasEdgeRepository canvasEdgeRepository;
    private final CanvasOperationRepository canvasOperationRepository;
    private final ObjectMapper objectMapper;

    public CanvasService(CanvasRepository canvasRepository,
                         CanvasNodeRepository canvasNodeRepository,
                         CanvasEdgeRepository canvasEdgeRepository,
                         CanvasOperationRepository canvasOperationRepository,
                         ObjectMapper objectMapper) {
        this.canvasRepository = canvasRepository;
        this.canvasNodeRepository = canvasNodeRepository;
        this.canvasEdgeRepository = canvasEdgeRepository;
        this.canvasOperationRepository = canvasOperationRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * Load the current materialized durable state for one canvas.
     *
     * <p>If the canvas does not exist yet we return an empty snapshot at version
     * 0 rather than forcing the caller to special-case 404 for new canvases.
     */
    public CanvasSnapshot getSnapshot(String canvasId) {
        validateCanvasId(canvasId);
        long headVersion = canvasRepository.findHeadVersion(canvasId).orElse(0L);
        return new CanvasSnapshot(
            canvasId,
            headVersion,
            canvasNodeRepository.findByCanvasId(canvasId),
            canvasEdgeRepository.findByCanvasId(canvasId)
        );
    }

    /**
     * Return committed structural operations after a known version.
     */
    public List<CommittedCanvasOperation> getOperationsAfter(String canvasId, long afterVersion, Integer limit) {
        validateCanvasId(canvasId);
        if (afterVersion < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "afterVersion must be >= 0");
        }

        int resolvedLimit = limit == null ? DEFAULT_OP_LIMIT : limit;
        if (resolvedLimit < 1 || resolvedLimit > MAX_OP_LIMIT) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "limit must be between 1 and " + MAX_OP_LIMIT
            );
        }

        return canvasOperationRepository.findAfterVersion(canvasId, afterVersion, resolvedLimit);
    }

    /**
     * Apply one structural operation transactionally.
     *
     * <p>The entire durability contract happens inside one DB transaction:
     * reserve the next version, append the op log row, mutate the materialized
     * tables, then commit. Either all of that becomes visible together or none
     * of it does.
     */
    @Transactional
    public CommittedCanvasOperation applyStructuralOperation(String canvasId, StructuralOperationRequest request) {
        validateCanvasId(canvasId);
        validateRequest(request);

        var existing = canvasOperationRepository.findByClientOperationId(canvasId, request.clientOperationId());
        if (existing.isPresent()) {
            return existing.get();
        }

        long version = canvasRepository.reserveNextVersion(canvasId);
        CommittedCanvasOperation pendingOperation = new CommittedCanvasOperation(
            null,
            canvasId,
            version,
            request.clientOperationId(),
            request.actorUserId(),
            request.operationType(),
            Objects.requireNonNull(request.payload()),
            Instant.EPOCH
        );

        CommittedCanvasOperation committedOperation = canvasOperationRepository.insert(pendingOperation);
        applyMaterializedMutation(canvasId, version, request.operationType(), request.payload());
        return committedOperation;
    }

    private void applyMaterializedMutation(String canvasId,
                                           long version,
                                           CanvasOperationType operationType,
                                           JsonNode payload) {
        try {
            switch (operationType) {
                case NODE_CREATE -> applyNodeCreate(canvasId, version, payload);
                case NODE_MOVE -> applyNodeMove(canvasId, version, payload);
                case NODE_UPDATE -> applyNodeUpdate(canvasId, version, payload);
                case NODE_DELETE -> applyNodeDelete(canvasId, payload);
                case EDGE_CREATE -> applyEdgeCreate(canvasId, version, payload);
                case EDGE_DELETE -> applyEdgeDelete(canvasId, payload);
            }
        } catch (DataIntegrityViolationException exception) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Structural operation violates canvas constraints",
                exception
            );
        }
    }

    private void applyNodeCreate(String canvasId, long version, JsonNode payload) {
        NodeCreatePayload node = readPayload(payload, NodeCreatePayload.class, "node_create");
        requireText(node.nodeId(), "payload.nodeId");
        requireText(node.nodeType(), "payload.nodeType");
        requirePositive(node.width(), "payload.width");
        requirePositive(node.height(), "payload.height");

        CanvasNodeRecord record = new CanvasNodeRecord(
            canvasId,
            node.nodeId(),
            node.nodeType(),
            node.x(),
            node.y(),
            node.width(),
            node.height(),
            nonNullJson(node.data()),
            version,
            version,
            Instant.EPOCH,
            Instant.EPOCH
        );
        canvasNodeRepository.insert(record);
    }

    private void applyNodeMove(String canvasId, long version, JsonNode payload) {
        NodeMovePayload move = readPayload(payload, NodeMovePayload.class, "node_move");
        requireText(move.nodeId(), "payload.nodeId");

        canvasNodeRepository.findById(canvasId, move.nodeId())
            .orElseThrow(() -> notFound("Node " + move.nodeId() + " not found"));

        int updated = canvasNodeRepository.updatePosition(canvasId, move.nodeId(), version, move.x(), move.y());
        if (updated == 0) {
            throw notFound("Node " + move.nodeId() + " not found");
        }
    }

    private void applyNodeUpdate(String canvasId, long version, JsonNode payload) {
        NodeUpdatePayload patch = readPayload(payload, NodeUpdatePayload.class, "node_update");
        requireText(patch.nodeId(), "payload.nodeId");

        CanvasNodeRecord existing = canvasNodeRepository.findById(canvasId, patch.nodeId())
            .orElseThrow(() -> notFound("Node " + patch.nodeId() + " not found"));

        double width = patch.width() != null ? patch.width() : existing.width();
        double height = patch.height() != null ? patch.height() : existing.height();
        requirePositive(width, "payload.width");
        requirePositive(height, "payload.height");

        CanvasNodeRecord updatedNode = new CanvasNodeRecord(
            existing.canvasId(),
            existing.nodeId(),
            existing.nodeType(),
            existing.x(),
            existing.y(),
            width,
            height,
            patch.data() != null ? patch.data() : existing.data(),
            existing.createdVersion(),
            version,
            existing.createdAt(),
            Instant.EPOCH
        );

        canvasNodeRepository.updateNode(updatedNode);
    }

    private void applyNodeDelete(String canvasId, JsonNode payload) {
        NodeDeletePayload delete = readPayload(payload, NodeDeletePayload.class, "node_delete");
        requireText(delete.nodeId(), "payload.nodeId");

        int deleted = canvasNodeRepository.delete(canvasId, delete.nodeId());
        if (deleted == 0) {
            throw notFound("Node " + delete.nodeId() + " not found");
        }
    }

    private void applyEdgeCreate(String canvasId, long version, JsonNode payload) {
        EdgeCreatePayload edge = readPayload(payload, EdgeCreatePayload.class, "edge_create");
        requireText(edge.edgeId(), "payload.edgeId");
        requireText(edge.fromNodeId(), "payload.fromNodeId");
        requireText(edge.toNodeId(), "payload.toNodeId");

        canvasNodeRepository.findById(canvasId, edge.fromNodeId())
            .orElseThrow(() -> notFound("Source node " + edge.fromNodeId() + " not found"));
        canvasNodeRepository.findById(canvasId, edge.toNodeId())
            .orElseThrow(() -> notFound("Target node " + edge.toNodeId() + " not found"));

        CanvasEdgeRecord record = new CanvasEdgeRecord(
            canvasId,
            edge.edgeId(),
            edge.fromNodeId(),
            edge.toNodeId(),
            version,
            version,
            Instant.EPOCH,
            Instant.EPOCH
        );
        canvasEdgeRepository.insert(record);
    }

    private void applyEdgeDelete(String canvasId, JsonNode payload) {
        EdgeDeletePayload delete = readPayload(payload, EdgeDeletePayload.class, "edge_delete");
        requireText(delete.edgeId(), "payload.edgeId");

        int deleted = canvasEdgeRepository.delete(canvasId, delete.edgeId());
        if (deleted == 0) {
            throw notFound("Edge " + delete.edgeId() + " not found");
        }
    }

    private void validateCanvasId(String canvasId) {
        requireText(canvasId, "canvasId");
    }

    private void validateRequest(StructuralOperationRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "request body is required");
        }
        requireText(request.clientOperationId(), "clientOperationId");
        requireText(request.actorUserId(), "actorUserId");
        if (request.operationType() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "operationType is required");
        }
        if (request.payload() == null || request.payload().isNull()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "payload is required");
        }
    }

    private <T> T readPayload(JsonNode payload, Class<T> payloadType, String operationName) {
        try {
            return objectMapper.treeToValue(payload, payloadType);
        } catch (Exception exception) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Invalid payload for " + operationName,
                exception
            );
        }
    }

    private JsonNode nonNullJson(JsonNode value) {
        return value == null ? objectMapper.createObjectNode() : value;
    }

    private void requireText(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, fieldName + " is required");
        }
    }

    private void requirePositive(double value, String fieldName) {
        if (value <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, fieldName + " must be > 0");
        }
    }

    private ResponseStatusException notFound(String message) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, message);
    }
}
