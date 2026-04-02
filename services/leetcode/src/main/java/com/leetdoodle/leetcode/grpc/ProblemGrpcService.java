package com.leetdoodle.leetcode.grpc;

import com.leetdoodle.grpc.GetProblemEvalRequest;
import com.leetdoodle.grpc.GetProblemEvalResponse;
import com.leetdoodle.grpc.ProblemServiceGrpc;
import com.leetdoodle.grpc.TestCaseProto;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import net.devh.boot.grpc.server.service.GrpcService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.util.List;
import java.util.Map;

/**
 * gRPC server implementation for the ProblemService.
 *
 * WHY JDBC DIRECTLY INSTEAD OF ProblemRepository + TestCaseRepository?
 * This service needs a tight projection: just `prompt` and `entry_point`
 * from problems, plus `input`/`output` from test_cases. The existing repos
 * would return far more data (tags, hints, solution content...) and require
 * additional queries. A focused JDBC query here is simpler and faster.
 *
 * @GrpcService: net.devh's annotation that registers this class as a gRPC
 * service handler. Under the hood it extends ProblemServiceImplBase and
 * the starter wires it into the Netty gRPC server (configured via
 * grpc.server.port in application.properties).
 */
@GrpcService
public class ProblemGrpcService extends ProblemServiceGrpc.ProblemServiceImplBase {

    private static final Logger log = LoggerFactory.getLogger(ProblemGrpcService.class);

    private final NamedParameterJdbcTemplate jdbc;

    public ProblemGrpcService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void getProblemEval(GetProblemEvalRequest request,
                               StreamObserver<GetProblemEvalResponse> responseObserver) {
        int problemId = request.getProblemId();
        log.info("grpc.getProblemEval problem_id={}", problemId);

        // Fetch prompt + entry_point from the problems table.
        // Returns null if no row found (problem doesn't exist or was never seeded).
        String[] evalFields = jdbc.query(
            "SELECT prompt, entry_point FROM problems WHERE id = :id",
            Map.of("id", problemId),
            (rs, n) -> new String[]{ rs.getString("prompt"), rs.getString("entry_point") }
        ).stream().findFirst().orElse(null);

        if (evalFields == null || evalFields[0] == null || evalFields[1] == null) {
            log.warn("grpc.getProblemEval.not_found problem_id={}", problemId);
            responseObserver.onError(
                Status.NOT_FOUND
                    .withDescription("No eval data for problem_id=" + problemId)
                    .asRuntimeException()
            );
            return;
        }

        String prompt     = evalFields[0];
        String entryPoint = evalFields[1];

        // Fetch individual test cases (already filtered — no NULL outputs in DB)
        List<TestCaseProto> testCases = jdbc.query(
            "SELECT input, output FROM test_cases WHERE problem_id = :id ORDER BY id",
            Map.of("id", problemId),
            (rs, n) -> TestCaseProto.newBuilder()
                .setInput(rs.getString("input"))
                .setExpectedOutput(rs.getString("output"))
                .build()
        );

        log.info("grpc.getProblemEval.ok problem_id={} testCases={}", problemId, testCases.size());

        responseObserver.onNext(
            GetProblemEvalResponse.newBuilder()
                .setPrompt(prompt)
                .setEntryPoint(entryPoint)
                .addAllTestCases(testCases)
                .build()
        );
        responseObserver.onCompleted();
    }
}
