package com.leetcanvas.submissions.service;

import com.leetcanvas.submissions.model.EvalJob;
import com.leetcanvas.submissions.model.ImmutableSubmission;
import com.leetcanvas.submissions.model.Submission;
import com.leetcanvas.submissions.repository.OutboxRepository;
import com.leetcanvas.submissions.repository.SubmissionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

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
     * Debezium then reads the outbox row out of the Postgres WAL *after* commit
     * and publishes it to RabbitMQ. The publish only happens when the DB has
     * already committed, so we can never have a job published without a submission
     * row, and we can never have a submission row without a job eventually published.
     *
     * WHAT IF DEBEZIUM IS DOWN?
     * The outbox row sits in the table. When Debezium restarts, it replays from
     * its last WAL offset (stored in the debezium-data volume) and picks up the
     * missed rows. The submission stays PENDING until the worker processes it —
     * no data is lost.
     */
    @Transactional
    public UUID submit(int problemId, String userId, String language, String code) {
        Submission submission = ImmutableSubmission.builder()
            .problemId(problemId)
            .userId(userId)
            .language(language)
            .code(code)
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
