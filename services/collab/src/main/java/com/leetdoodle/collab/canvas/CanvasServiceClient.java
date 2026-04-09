package com.leetdoodle.collab.canvas;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.leetdoodle.grpc.CanvasServiceGrpc;
import com.leetdoodle.grpc.CommitStructuralOpRequest;
import com.leetdoodle.grpc.GetCanvasOpsAfterRequest;
import com.leetdoodle.grpc.GetCanvasSnapshotRequest;
import io.grpc.StatusRuntimeException;
import net.devh.boot.grpc.client.inject.GrpcClient;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * Thin synchronous client from collab -> canvas-service.
 *
 * <p>Collab stays the websocket gateway, but durable structural writes now go
 * through canvas-service before we broadcast anything to peers. This client
 * keeps that dependency explicit and localised.
 */
@Component
public class CanvasServiceClient {

    private final ObjectMapper objectMapper;

    @GrpcClient("canvas-service")
    private CanvasServiceGrpc.CanvasServiceBlockingStub stub;

    public CanvasServiceClient(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * Fetch the current durable materialized snapshot for one canvas.
     */
    public CanvasSnapshotResponse getSnapshot(String canvasId) {
        try {
            var response = stub.getCanvasSnapshot(
                GetCanvasSnapshotRequest.newBuilder()
                    .setCanvasId(canvasId)
                    .build()
            );

            return new CanvasSnapshotResponse(
                response.getCanvasId(),
                response.getHeadVersion(),
                readJson(response.getNodesJson()),
                readJson(response.getEdgesJson())
            );
        } catch (StatusRuntimeException exception) {
            throw mapGrpcError("Failed to load canvas snapshot", exception);
        }
    }

    /**
     * Commit one structural operation and return the committed versioned result.
     */
    public CommittedCanvasOperationResponse commitStructuralOperation(String canvasId,
                                                                     StructuralOperationRequest requestBody) {
        try {
            var response = stub.commitStructuralOp(
                CommitStructuralOpRequest.newBuilder()
                    .setCanvasId(canvasId)
                    .setClientOperationId(requestBody.clientOperationId())
                    .setActorUserId(requestBody.actorUserId())
                    .setOperationType(requestBody.operationType())
                    .setPayloadJson(writeJson(requestBody.payload()))
                    .build()
            );

            return new CommittedCanvasOperationResponse(
                response.getId(),
                response.getCanvasId(),
                response.getVersion(),
                response.getClientOperationId(),
                response.getActorUserId(),
                response.getOperationType(),
                readJson(response.getPayloadJson())
            );
        } catch (StatusRuntimeException exception) {
            throw mapGrpcError("Failed to commit structural op", exception);
        }
    }

    /**
     * Fetch committed structural ops newer than a known canvas version.
     *
     * <p>This is not on the hot path yet, but we expose it now so join/catch-up
     * flows have a typed API once the frontend starts version-aware replay.
     */
    public List<CommittedCanvasOperationResponse> getOperationsAfter(String canvasId, long afterVersion, int limit) {
        try {
            var response = stub.getCanvasOpsAfter(
                GetCanvasOpsAfterRequest.newBuilder()
                    .setCanvasId(canvasId)
                    .setAfterVersion(afterVersion)
                    .setLimit(limit)
                    .build()
            );

            return response.getOpsList().stream()
                .map(op -> new CommittedCanvasOperationResponse(
                    op.getId(),
                    op.getCanvasId(),
                    op.getVersion(),
                    op.getClientOperationId(),
                    op.getActorUserId(),
                    op.getOperationType(),
                    readJson(op.getPayloadJson())
                ))
                .toList();
        } catch (StatusRuntimeException exception) {
            throw mapGrpcError("Failed to load canvas ops", exception);
        }
    }

    private JsonNode readJson(String rawJson) {
        try {
            return objectMapper.readTree(rawJson);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to parse JSON from canvas-service", exception);
        }
    }

    private String writeJson(JsonNode json) {
        try {
            return objectMapper.writeValueAsString(json);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to serialize JSON for canvas-service", exception);
        }
    }

    private ResponseStatusException mapGrpcError(String fallbackMessage, StatusRuntimeException exception) {
        HttpStatus status = switch (exception.getStatus().getCode()) {
            case INVALID_ARGUMENT -> HttpStatus.BAD_REQUEST;
            case NOT_FOUND -> HttpStatus.NOT_FOUND;
            case ALREADY_EXISTS, ABORTED -> HttpStatus.CONFLICT;
            default -> HttpStatus.BAD_GATEWAY;
        };
        String reason = exception.getStatus().getDescription();
        return new ResponseStatusException(
            status,
            reason == null || reason.isBlank() ? fallbackMessage : reason,
            exception
        );
    }
}
