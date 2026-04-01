package com.leetcanvas.worker.messaging;

import com.leetcanvas.grpc.GetProblemEvalResponse;
import com.leetcanvas.worker.db.SubmissionResultWriter;
import com.leetcanvas.worker.docker.EvalRunner;
import com.leetcanvas.worker.docker.EvalRunner.EvalResult;
import com.leetcanvas.worker.docker.EvalRunner.EvalSpec;
import com.leetcanvas.worker.docker.EvalRunner.TestCase;
import com.leetcanvas.worker.grpc.LeetcodeGrpcClient;
import com.leetcanvas.worker.model.EvalJob;
import io.grpc.StatusRuntimeException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;

/**
 * AMQP consumer that orchestrates one evaluation flow per queue message.
 *
 * <p>Flow: validate payload, fetch eval metadata via gRPC, run code in Docker, persist terminal
 * status/result back to submissions storage.
 */
@Component
public class EvalConsumer {

    private static final Logger log = LoggerFactory.getLogger(EvalConsumer.class);

    private final EvalRunner             runner;
    private final LeetcodeGrpcClient     grpcClient;
    private final SubmissionResultWriter resultWriter;

    public EvalConsumer(EvalRunner runner, LeetcodeGrpcClient grpcClient,
                        SubmissionResultWriter resultWriter) {
        this.runner       = runner;
        this.grpcClient   = grpcClient;
        this.resultWriter = resultWriter;
    }

    /**
     * Consume one eval job from the queue.
     *
     * Spring AMQP ACKs the message automatically when this method returns
     * without throwing. If an exception escapes, the message is NACKed and
     * requeued — so transient failures (Docker hiccup, DB blip, gRPC blip)
     * are retried automatically.
     */
    @RabbitListener(queues = RabbitConfig.QUEUE)
    public void handle(EvalJob job) {
        long startedAt = System.currentTimeMillis();

        if (!isValid(job)) {
            log.error("Dropping malformed eval job payload: {}", job);
            return;
        }

        log.info("Evaluating submission {} (problem={})", job.submissionId(), job.problemId());

        try {
            // Fetch prompt, entry_point, and test cases from the leetcode-service via gRPC.
            // This decouples the worker from the leetcode DB schema entirely.
            GetProblemEvalResponse evalData = grpcClient.getProblemEval(job.problemId());

            List<TestCase> testCases = evalData.getTestCasesList().stream()
                .map(tc -> new TestCase(tc.getInput(), tc.getExpectedOutput()))
                .toList();

            EvalSpec spec = new EvalSpec(evalData.getPrompt(), evalData.getEntryPoint());

            log.info("Loaded {} test cases for submission {}", testCases.size(), job.submissionId());

            if (testCases.isEmpty()) {
                log.warn("No test cases for submission {} (problem={})",
                    job.submissionId(), job.problemId());
                resultWriter.write(job.submissionId(),
                    new EvalResult("RUNTIME_ERROR", Collections.emptyList(), "No test cases found for this problem"));
                return;
            }

            log.info("Dispatching submission {} to Docker runner", job.submissionId());
            EvalResult result = runner.run(job.submissionId(), job.code(), testCases, spec);
            log.info("Docker runner finished for submission {} with status {}",
                job.submissionId(), result.status());

            resultWriter.write(job.submissionId(), result);

            long passed    = result.cases().stream().filter(EvalRunner.CaseResult::passed).count();
            long elapsedMs = System.currentTimeMillis() - startedAt;
            log.info("Submission {} → {} ({}/{}) in {} ms",
                job.submissionId(), result.status(), passed, result.cases().size(), elapsedMs);

        } catch (StatusRuntimeException e) {
            // gRPC NOT_FOUND means the problem has no eval data seeded yet
            log.error("gRPC error for submission {} (problem={}): {}",
                job.submissionId(), job.problemId(), e.getStatus());
            resultWriter.write(job.submissionId(),
                new EvalResult("RUNTIME_ERROR", Collections.emptyList(), e.getStatus().getDescription()));
        } catch (Exception e) {
            log.error("Eval failed for submission {}", job.submissionId(), e);
            resultWriter.write(job.submissionId(),
                new EvalResult("RUNTIME_ERROR", Collections.emptyList(), e.getMessage()));
        }
    }

    private boolean isValid(EvalJob job) {
        if (job == null) return false;
        if (job.submissionId() == null || job.submissionId().isBlank()) return false;
        return job.problemId() > 0;
    }
}
