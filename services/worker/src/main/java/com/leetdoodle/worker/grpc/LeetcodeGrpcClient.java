package com.leetdoodle.worker.grpc;

import com.leetdoodle.grpc.GetProblemEvalRequest;
import com.leetdoodle.grpc.GetProblemEvalResponse;
import com.leetdoodle.grpc.ProblemServiceGrpc;
import net.devh.boot.grpc.client.inject.GrpcClient;
import org.springframework.stereotype.Component;

/**
 * Thin wrapper around the generated gRPC blocking stub.
 *
 * WHY A WRAPPER INSTEAD OF INJECTING THE STUB DIRECTLY?
 * Keeps gRPC details (proto types, stub lifecycle) out of EvalConsumer.
 * EvalConsumer just calls getProblemEval(id) and gets a response — it
 * doesn't need to know about channels, stubs, or proto message builders.
 *
 * @GrpcClient("leetcode-service"): net.devh resolves this name to a
 * channel using application.properties:
 *   grpc.client.leetcode-service.address=static://localhost:9090
 * The channel is managed (pooled, health-checked) by the starter.
 *
 * The blocking stub makes synchronous calls — the calling thread waits
 * for the response. This is fine here because EvalConsumer already runs
 * in a background thread (RabbitMQ listener thread pool).
 */
@Component
public class LeetcodeGrpcClient {

    @GrpcClient("leetcode-service")
    private ProblemServiceGrpc.ProblemServiceBlockingStub stub;

    public GetProblemEvalResponse getProblemEval(int problemId) {
        return stub.getProblemEval(
            GetProblemEvalRequest.newBuilder()
                .setProblemId(problemId)
                .build()
        );
    }
}
