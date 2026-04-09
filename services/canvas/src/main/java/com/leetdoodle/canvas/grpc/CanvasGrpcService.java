package com.leetdoodle.canvas.grpc;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.leetdoodle.canvas.model.CommittedCanvasOperation;
import com.leetdoodle.canvas.model.StructuralOperationRequest;
import com.leetdoodle.canvas.service.CanvasService;
import com.leetdoodle.grpc.CanvasServiceGrpc;
import com.leetdoodle.grpc.CommitStructuralOpRequest;
import com.leetdoodle.grpc.CommittedStructuralOpResponse;
import com.leetdoodle.grpc.GetCanvasOpsAfterRequest;
import com.leetdoodle.grpc.GetCanvasOpsAfterResponse;
import com.leetdoodle.grpc.GetCanvasSnapshotRequest;
import com.leetdoodle.grpc.GetCanvasSnapshotResponse;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import net.devh.boot.grpc.server.service.GrpcService;
import org.springframework.web.server.ResponseStatusException;

/**
 * gRPC server adapter for durable canvas state.
 *
 * <p>The HTTP controller can remain available as a debug surface, but internal
 * service-to-service traffic should use this gRPC contract so collab and canvas
 * share one compile-time-checked interface.
 */
@GrpcService
public class CanvasGrpcService extends CanvasServiceGrpc.CanvasServiceImplBase {

    private final CanvasService canvasService;
    private final ObjectMapper objectMapper;

    public CanvasGrpcService(CanvasService canvasService, ObjectMapper objectMapper) {
        this.canvasService = canvasService;
        this.objectMapper = objectMapper;
    }

    @Override
    public void getCanvasSnapshot(GetCanvasSnapshotRequest request,
                                  StreamObserver<GetCanvasSnapshotResponse> responseObserver) {
        try {
            var snapshot = canvasService.getSnapshot(request.getCanvasId());
            responseObserver.onNext(
                GetCanvasSnapshotResponse.newBuilder()
                    .setCanvasId(snapshot.canvasId())
                    .setHeadVersion(snapshot.headVersion())
                    .setNodesJson(writeJson(snapshot.nodes()))
                    .setEdgesJson(writeJson(snapshot.edges()))
                    .build()
            );
            responseObserver.onCompleted();
        } catch (ResponseStatusException exception) {
            responseObserver.onError(mapStatus(exception).asRuntimeException());
        } catch (Exception exception) {
            responseObserver.onError(
                Status.INTERNAL.withDescription("Failed to load canvas snapshot").withCause(exception).asRuntimeException()
            );
        }
    }

    @Override
    public void getCanvasOpsAfter(GetCanvasOpsAfterRequest request,
                                  StreamObserver<GetCanvasOpsAfterResponse> responseObserver) {
        try {
            var ops = canvasService.getOperationsAfter(
                request.getCanvasId(),
                request.getAfterVersion(),
                request.getLimit() == 0 ? null : request.getLimit()
            );

            GetCanvasOpsAfterResponse.Builder response = GetCanvasOpsAfterResponse.newBuilder();
            for (CommittedCanvasOperation operation : ops) {
                response.addOps(toProto(operation));
            }
            responseObserver.onNext(response.build());
            responseObserver.onCompleted();
        } catch (ResponseStatusException exception) {
            responseObserver.onError(mapStatus(exception).asRuntimeException());
        } catch (Exception exception) {
            responseObserver.onError(
                Status.INTERNAL.withDescription("Failed to load canvas ops").withCause(exception).asRuntimeException()
            );
        }
    }

    @Override
    public void commitStructuralOp(CommitStructuralOpRequest request,
                                   StreamObserver<CommittedStructuralOpResponse> responseObserver) {
        try {
            var committed = canvasService.applyStructuralOperation(
                request.getCanvasId(),
                new StructuralOperationRequest(
                    request.getClientOperationId(),
                    request.getActorUserId(),
                    parseOperationType(request.getOperationType()),
                    readJson(request.getPayloadJson())
                )
            );
            responseObserver.onNext(toProto(committed));
            responseObserver.onCompleted();
        } catch (ResponseStatusException exception) {
            responseObserver.onError(mapStatus(exception).asRuntimeException());
        } catch (Exception exception) {
            responseObserver.onError(
                Status.INTERNAL.withDescription("Failed to commit structural op").withCause(exception).asRuntimeException()
            );
        }
    }

    private CommittedStructuralOpResponse toProto(CommittedCanvasOperation operation) {
        return CommittedStructuralOpResponse.newBuilder()
            .setId(operation.id().toString())
            .setCanvasId(operation.canvasId())
            .setVersion(operation.version())
            .setClientOperationId(operation.clientOperationId())
            .setActorUserId(operation.actorUserId())
            .setOperationType(operation.operationType().name())
            .setPayloadJson(writeJson(operation.payload()))
            .build();
    }

    private com.leetdoodle.canvas.model.CanvasOperationType parseOperationType(String rawValue) {
        try {
            return com.leetdoodle.canvas.model.CanvasOperationType.valueOf(rawValue);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(
                org.springframework.http.HttpStatus.BAD_REQUEST,
                "Unsupported operationType: " + rawValue,
                exception
            );
        }
    }

    private com.fasterxml.jackson.databind.JsonNode readJson(String rawJson) {
        try {
            return objectMapper.readTree(rawJson);
        } catch (JsonProcessingException exception) {
            throw new ResponseStatusException(
                org.springframework.http.HttpStatus.BAD_REQUEST,
                "Invalid JSON payload",
                exception
            );
        }
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to serialize gRPC response payload", exception);
        }
    }

    private Status mapStatus(ResponseStatusException exception) {
        return switch (exception.getStatusCode().value()) {
            case 400 -> Status.INVALID_ARGUMENT.withDescription(exception.getReason());
            case 404 -> Status.NOT_FOUND.withDescription(exception.getReason());
            case 409 -> Status.ALREADY_EXISTS.withDescription(exception.getReason());
            default -> Status.INTERNAL.withDescription(exception.getReason());
        };
    }
}
