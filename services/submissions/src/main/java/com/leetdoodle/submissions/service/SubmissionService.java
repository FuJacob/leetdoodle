package com.leetdoodle.submissions.service;

import com.leetdoodle.submissions.model.EvalJob;
import com.leetdoodle.submissions.model.ImmutableSubmission;
import com.leetdoodle.submissions.model.Submission;
import com.leetdoodle.submissions.repository.OutboxRepository;
import com.leetdoodle.submissions.repository.SubmissionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Objects;
import java.util.UUID;

/**
 * Application service for submission lifecycle operations.
 *
 * <p>Coordinates writes across submission and outbox repositories so job dispatch remains
 * transactional and resilient to transient broker outages.
 */
@Service
public class SubmissionService {

    private final SubmissionRepository submissionRepository;
    private final OutboxRepository     outboxRepository;

    public SubmissionService(SubmissionRepository submissionRepository,
                             OutboxRepository outboxRepository) {
        this.submissionRepository = submissionRepository;
        this.outboxRepository     = outboxRepository;
    }

    /**
     * Create a submission and enqueue it for evaluation.
     *
     * OUTBOX PATTERN — why @Transactional fixes the dual-write problem:
     *
     * The old approach called repository.insert() then publisher.publish().
     * These were two independent operations: if the app crashed between them,
     * or RabbitMQ was temporarily unavailable, the submission row existed in
     * Postgres but the worker never received the job — stuck at PENDING forever.
     *
     * The fix: both writes (submission row + outbox row) happen inside ONE
     * database transaction. Either both commit or neither does — no partial state.
     * A background dispatcher later reads committed outbox rows and publishes them
     * to RabbitMQ. The publish only happens after the DB commit, so we can never
     * have a job published without a submission row.
     *
     * WHAT IF RABBIT OR THE DISPATCHER IS DOWN?
     * The outbox row sits in the table until a later poll succeeds. The
     * submission stays PENDING until the worker processes it — no data is lost
     * as long as the database commit succeeded.
     */
    @Transactional
    public UUID submit(int problemId, String userId, String language, String code) {
        Submission submission = ImmutableSubmission.builder()
            .problemId(problemId)
            .userId(Objects.requireNonNull(userId))
            .language(Objects.requireNonNull(language))
            .code(Objects.requireNonNull(code))
            .status("PENDING")
            .build();

        UUID id = submissionRepository.insert(submission);
        outboxRepository.insert(id, new EvalJob(id.toString(), problemId, language, code));
        return id;
    }

    public Submission getById(UUID id) {
        return submissionRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND, "Submission " + id + " not found"
            ));
    }
}
