package com.leetcanvas.submissions.service;

import com.leetcanvas.submissions.messaging.EvalJobPublisher;
import com.leetcanvas.submissions.model.EvalJob;
import com.leetcanvas.submissions.model.ImmutableSubmission;
import com.leetcanvas.submissions.model.Submission;
import com.leetcanvas.submissions.repository.SubmissionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@Service
public class SubmissionService {

    private final SubmissionRepository repository;
    private final EvalJobPublisher publisher;

    public SubmissionService(SubmissionRepository repository, EvalJobPublisher publisher) {
        this.repository = repository;
        this.publisher  = publisher;
    }

    /**
     * Create a submission and enqueue it for evaluation.
     *
     * ORDER MATTERS here — we write to Postgres first, then publish to Rabbit.
     * If the publish fails, the submission row exists with status=PENDING and
     * we can re-enqueue it later (a dead-letter queue or a cron job scanning
     * stuck PENDING rows would handle recovery in production).
     *
     * The reverse order (publish first, then DB) would be worse: if the DB
     * write fails, the worker would try to update a row that doesn't exist.
     *
     * This is a classic distributed systems problem — achieving atomicity
     * across two systems (DB + message broker) without a distributed
     * transaction. The "outbox pattern" solves this properly at scale:
     * write the job to a DB table as part of the same transaction, then
     * a separate process reads and publishes it. We're keeping it simple here.
     */
    public UUID submit(int problemId, String userId, String language, String code) {
        Submission submission = ImmutableSubmission.builder()
            .problemId(problemId)
            .userId(userId)
            .language(language)
            .code(code)
            .status("PENDING")
            .build();

        UUID id = repository.insert(submission);
        publisher.publish(new EvalJob(id.toString(), problemId, language, code));
        return id;
    }

    public Submission getById(UUID id) {
        return repository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND, "Submission " + id + " not found"
            ));
    }
}
