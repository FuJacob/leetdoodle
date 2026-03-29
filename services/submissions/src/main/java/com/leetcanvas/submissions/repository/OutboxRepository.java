package com.leetcanvas.submissions.repository;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.leetcanvas.submissions.model.EvalJob;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.Map;
import java.util.UUID;

/**
 * Writes rows to the transactional outbox table.
 *
 * This repository is always called inside the same @Transactional boundary as
 * SubmissionRepository.insert(), so both writes commit or roll back together.
 * Debezium tails the WAL and publishes the outbox row to RabbitMQ only after
 * the transaction commits — solving the dual-write problem.
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
     * @param job          the payload Debezium will forward to RabbitMQ as-is
     */
    public void insert(UUID submissionId, EvalJob job) {
        try {
            String payloadJson = objectMapper.writeValueAsString(job);

            String sql = """
                INSERT INTO submissions.outbox (aggregate_id, event_type, payload)
                VALUES (:aggregateId, :eventType, :payload::jsonb)
                """;

            // event_type "eval" matches the routing key bound to eval.queue.
            // The Outbox Event Router SMT reads this column and uses it as the
            // RabbitMQ routing key, so we don't need to hard-code it in Debezium config.
            jdbc.update(sql, Map.of(
                "aggregateId", submissionId,
                "eventType",   "eval",
                "payload",     payloadJson
            ));
        } catch (Exception e) {
            throw new RuntimeException("Failed to insert outbox event", e);
        }
    }
}
