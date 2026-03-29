package com.leetcanvas.worker.messaging;

import com.leetcanvas.worker.db.SubmissionResultWriter;
import com.leetcanvas.worker.db.TestCaseReader;
import com.leetcanvas.worker.docker.EvalRunner;
import com.leetcanvas.worker.docker.EvalRunner.EvalResult;
import com.leetcanvas.worker.docker.EvalRunner.TestCase;
import com.leetcanvas.worker.model.EvalJob;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class EvalConsumer {

    private static final Logger log = LoggerFactory.getLogger(EvalConsumer.class);

    private final EvalRunner            runner;
    private final TestCaseReader        testCaseReader;
    private final SubmissionResultWriter resultWriter;

    public EvalConsumer(EvalRunner runner, TestCaseReader testCaseReader,
                        SubmissionResultWriter resultWriter) {
        this.runner        = runner;
        this.testCaseReader = testCaseReader;
        this.resultWriter  = resultWriter;
    }

    /**
     * Consume one eval job from the queue.
     *
     * Spring AMQP ACKs the message automatically when this method returns
     * without throwing. If an exception escapes, the message is NACKed and
     * requeued — so transient failures (Docker hiccup, DB blip) are retried
     * automatically.
     *
     * In production you'd add a dead-letter queue (DLQ) so messages that fail
     * repeatedly don't loop forever. For now, uncaught exceptions go to the
     * RabbitMQ default handling.
     */
    @RabbitListener(queues = RabbitConfig.QUEUE)
    public void handle(EvalJob job) {
        log.info("Evaluating submission {} (problem={}, lang={})",
            job.submissionId(), job.problemId(), job.language());

        try {
            List<TestCase> testCases = testCaseReader.findByProblemId(job.problemId());
            if (testCases.isEmpty()) {
                log.warn("No test cases for problem {}", job.problemId());
                resultWriter.write(job.submissionId(),
                    new EvalResult("RUNTIME_ERROR", 0, 0, "No test cases found for this problem"));
                return;
            }

            EvalResult result = runner.run(job.language(), job.code(), testCases);
            resultWriter.write(job.submissionId(), result);

            log.info("Submission {} → {} ({}/{})",
                job.submissionId(), result.status(), result.passed(), result.total());

        } catch (Exception e) {
            log.error("Eval failed for submission {}", job.submissionId(), e);
            resultWriter.write(job.submissionId(),
                new EvalResult("RUNTIME_ERROR", 0, 0, e.getMessage()));
        }
    }
}
