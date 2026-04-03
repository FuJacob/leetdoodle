package com.leetdoodle.submissions.repository;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.leetdoodle.submissions.model.EvalJob;
import com.leetdoodle.submissions.model.OutboxMessage;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Writes rows to the transactional outbox table.
 *
 * This repository is always called inside the same @Transactional boundary as
 * SubmissionRepository.insert(), so both writes commit or roll back together.
 * A scheduler later claims committed rows and publishes them to RabbitMQ —
 * solving the dual-write problem without introducing a separate CDC runtime.
 */
@Repository
public class OutboxRepository {

    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public OutboxRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Insert one outbox event for the given EvalJob.
     *
     * @param submissionId the submission UUID — becomes aggregate_id so the
     *                     worker can correlate the message back to a submission
     * @param job          the payload the submissions dispatcher will forward to RabbitMQ as-is
     */
    public void insert(UUID submissionId, EvalJob job) {
        try {
            String payloadJson = objectMapper.writeValueAsString(job);

            String sql = """
                INSERT INTO submissions.outbox (aggregate_id, event_type, payload)
                VALUES (:aggregateId, :eventType, :payload::jsonb)
                """;

            // event_type "eval" matches the routing key bound to eval.queue.
            // Keeping the routing key in the row means the dispatcher can stay
            // generic if we add more event types later.
            jdbc.update(sql, Map.of(
                "aggregateId", submissionId,
                "eventType",   "eval",
                "payload",     payloadJson
            ));
        } catch (Exception e) {
            throw new RuntimeException("Failed to insert outbox event", e);
        }
    }

    /**
     * Claim a batch of unpublished rows for one dispatcher loop.
     *
     * <p>We use a lease instead of holding a DB transaction open during RabbitMQ
     * network I/O. If the process crashes mid-dispatch, another poller can
     * reclaim the row once the lease expires.
     */
    public List<OutboxMessage> claimBatch(int batchSize, Duration claimTtl) {
        UUID claimToken = UUID.randomUUID();

        String sql = """
            WITH candidates AS (
                SELECT id
                FROM submissions.outbox
                WHERE published_at IS NULL
                  AND (claim_expires_at IS NULL OR claim_expires_at < now())
                ORDER BY created_at
                FOR UPDATE SKIP LOCKED
                LIMIT :batchSize
            )
            UPDATE submissions.outbox AS outbox
            SET claim_token      = :claimToken,
                claim_expires_at = now() + (:claimTtlSeconds * INTERVAL '1 second'),
                attempt_count    = attempt_count + 1,
                last_error       = NULL
            FROM candidates
            WHERE outbox.id = candidates.id
            RETURNING outbox.id,
                      outbox.event_type,
                      outbox.payload::text AS payload_json,
                      outbox.claim_token,
                      outbox.attempt_count
            """;

        return jdbc.query(sql, Map.of(
            "batchSize",       Math.max(1, batchSize),
            "claimToken",      claimToken,
            "claimTtlSeconds", Math.max(1L, claimTtl.toSeconds())
        ), (rs, rowNum) -> new OutboxMessage(
            rs.getObject("id", UUID.class),
            rs.getString("event_type"),
            rs.getString("payload_json"),
            rs.getObject("claim_token", UUID.class),
            rs.getInt("attempt_count")
        ));
    }

    /**
     * Mark a claimed row as successfully published.
     *
     * <p>The claim token prevents a stale dispatcher instance from mutating a row
     * that has already been reclaimed by another instance.
     */
    public void markPublished(OutboxMessage message) {
        String sql = """
            UPDATE submissions.outbox
            SET published_at     = now(),
                claim_token      = NULL,
                claim_expires_at = NULL,
                last_error       = NULL
            WHERE id = :id
              AND claim_token = :claimToken
              AND published_at IS NULL
            """;

        jdbc.update(sql, Map.of(
            "id",         message.id(),
            "claimToken", message.claimToken()
        ));
    }

    /**
     * Release a failed claim so the row can be retried on the next poll.
     */
    public void releaseClaim(OutboxMessage message, String errorSummary) {
        String sql = """
            UPDATE submissions.outbox
            SET claim_token      = NULL,
                claim_expires_at = NULL,
                last_error       = :lastError
            WHERE id = :id
              AND claim_token = :claimToken
              AND published_at IS NULL
            """;

        jdbc.update(sql, Map.of(
            "id",         message.id(),
            "claimToken", message.claimToken(),
            "lastError",  errorSummary
        ));
    }
}
