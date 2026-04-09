package com.leetdoodle.canvas.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.leetdoodle.canvas.model.CanvasOperationType;
import com.leetdoodle.canvas.model.CommittedCanvasOperation;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.io.UncheckedIOException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository for the ordered recent structural change log.
 */
@Repository
public class CanvasOperationRepository {

    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public CanvasOperationRepository(NamedParameterJdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    public CommittedCanvasOperation insert(CommittedCanvasOperation operation) {
        String sql = """
            INSERT INTO canvas.canvas_ops (
                canvas_id, version, client_operation_id, actor_user_id, operation_type, payload
            ) VALUES (
                :canvasId, :version, :clientOperationId, :actorUserId, :operationType, CAST(:payload AS jsonb)
            )
            RETURNING id, created_at
            """;

        var params = new MapSqlParameterSource()
            .addValue("canvasId", operation.canvasId())
            .addValue("version", operation.version())
            .addValue("clientOperationId", operation.clientOperationId())
            .addValue("actorUserId", operation.actorUserId())
            .addValue("operationType", operation.operationType().name())
            .addValue("payload", writeJson(operation.payload()));

        return jdbc.queryForObject(sql, params, (rs, rowNum) -> new CommittedCanvasOperation(
            rs.getObject("id", UUID.class),
            operation.canvasId(),
            operation.version(),
            operation.clientOperationId(),
            operation.actorUserId(),
            operation.operationType(),
            operation.payload(),
            rs.getTimestamp("created_at").toInstant()
        ));
    }

    public Optional<CommittedCanvasOperation> findByClientOperationId(String canvasId, String clientOperationId) {
        String sql = """
            SELECT id, canvas_id, version, client_operation_id, actor_user_id,
                   operation_type, payload, created_at
            FROM canvas.canvas_ops
            WHERE canvas_id = :canvasId
              AND client_operation_id = :clientOperationId
            """;
        var rows = jdbc.query(sql, Map.of(
            "canvasId", canvasId,
            "clientOperationId", clientOperationId
        ), (rs, rowNum) -> mapRow(rs));
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.getFirst());
    }

    public List<CommittedCanvasOperation> findAfterVersion(String canvasId, long afterVersion, int limit) {
        String sql = """
            SELECT id, canvas_id, version, client_operation_id, actor_user_id,
                   operation_type, payload, created_at
            FROM canvas.canvas_ops
            WHERE canvas_id = :canvasId
              AND version > :afterVersion
            ORDER BY version ASC
            LIMIT :limit
            """;
        return jdbc.query(sql, Map.of(
            "canvasId", canvasId,
            "afterVersion", afterVersion,
            "limit", limit
        ), (rs, rowNum) -> mapRow(rs));
    }

    private CommittedCanvasOperation mapRow(ResultSet rs) throws SQLException {
        Timestamp createdAt = rs.getTimestamp("created_at");
        return new CommittedCanvasOperation(
            rs.getObject("id", UUID.class),
            rs.getString("canvas_id"),
            rs.getLong("version"),
            rs.getString("client_operation_id"),
            rs.getString("actor_user_id"),
            CanvasOperationType.valueOf(rs.getString("operation_type")),
            readJson(rs.getString("payload")),
            createdAt != null ? createdAt.toInstant() : Instant.EPOCH
        );
    }

    private JsonNode readJson(String rawJson) {
        try {
            return objectMapper.readTree(rawJson);
        } catch (JsonProcessingException exception) {
            throw new UncheckedIOException(exception);
        }
    }

    private String writeJson(JsonNode json) {
        try {
            return objectMapper.writeValueAsString(json);
        } catch (JsonProcessingException exception) {
            throw new UncheckedIOException(exception);
        }
    }
}
