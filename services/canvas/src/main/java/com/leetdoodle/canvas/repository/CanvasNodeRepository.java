package com.leetdoodle.canvas.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.leetdoodle.canvas.model.CanvasNodeRecord;
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

/**
 * JDBC repository for the materialized canvas node table.
 */
@Repository
public class CanvasNodeRepository {

    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public CanvasNodeRepository(NamedParameterJdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    public void insert(CanvasNodeRecord node) {
        String sql = """
            INSERT INTO canvas.canvas_nodes (
                canvas_id, node_id, node_type, x, y, width, height, data,
                created_version, updated_version
            ) VALUES (
                :canvasId, :nodeId, :nodeType, :x, :y, :width, :height, CAST(:data AS jsonb),
                :createdVersion, :updatedVersion
            )
            """;

        jdbc.update(sql, paramsFor(node));
    }

    public Optional<CanvasNodeRecord> findById(String canvasId, String nodeId) {
        String sql = """
            SELECT canvas_id, node_id, node_type, x, y, width, height, data,
                   created_version, updated_version, created_at, updated_at
            FROM canvas.canvas_nodes
            WHERE canvas_id = :canvasId AND node_id = :nodeId
            """;
        var rows = jdbc.query(sql, Map.of("canvasId", canvasId, "nodeId", nodeId), (rs, rowNum) -> mapRow(rs));
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.getFirst());
    }

    public List<CanvasNodeRecord> findByCanvasId(String canvasId) {
        String sql = """
            SELECT canvas_id, node_id, node_type, x, y, width, height, data,
                   created_version, updated_version, created_at, updated_at
            FROM canvas.canvas_nodes
            WHERE canvas_id = :canvasId
            ORDER BY created_version ASC, node_id ASC
            """;
        return jdbc.query(sql, Map.of("canvasId", canvasId), (rs, rowNum) -> mapRow(rs));
    }

    public int updatePosition(String canvasId, String nodeId, long version, double x, double y) {
        String sql = """
            UPDATE canvas.canvas_nodes
            SET x = :x,
                y = :y,
                updated_version = :version,
                updated_at = now()
            WHERE canvas_id = :canvasId
              AND node_id = :nodeId
            """;
        return jdbc.update(sql, Map.of(
            "canvasId", canvasId,
            "nodeId", nodeId,
            "version", version,
            "x", x,
            "y", y
        ));
    }

    public int updateNode(CanvasNodeRecord node) {
        String sql = """
            UPDATE canvas.canvas_nodes
            SET node_type = :nodeType,
                x = :x,
                y = :y,
                width = :width,
                height = :height,
                data = CAST(:data AS jsonb),
                updated_version = :updatedVersion,
                updated_at = now()
            WHERE canvas_id = :canvasId
              AND node_id = :nodeId
            """;
        return jdbc.update(sql, paramsFor(node));
    }

    public int delete(String canvasId, String nodeId) {
        String sql = """
            DELETE FROM canvas.canvas_nodes
            WHERE canvas_id = :canvasId
              AND node_id = :nodeId
            """;
        return jdbc.update(sql, Map.of("canvasId", canvasId, "nodeId", nodeId));
    }

    private MapSqlParameterSource paramsFor(CanvasNodeRecord node) {
        return new MapSqlParameterSource()
            .addValue("canvasId", node.canvasId())
            .addValue("nodeId", node.nodeId())
            .addValue("nodeType", node.nodeType())
            .addValue("x", node.x())
            .addValue("y", node.y())
            .addValue("width", node.width())
            .addValue("height", node.height())
            .addValue("data", writeJson(node.data()))
            .addValue("createdVersion", node.createdVersion())
            .addValue("updatedVersion", node.updatedVersion());
    }

    private CanvasNodeRecord mapRow(ResultSet rs) throws SQLException {
        Timestamp createdAt = rs.getTimestamp("created_at");
        Timestamp updatedAt = rs.getTimestamp("updated_at");
        return new CanvasNodeRecord(
            rs.getString("canvas_id"),
            rs.getString("node_id"),
            rs.getString("node_type"),
            rs.getDouble("x"),
            rs.getDouble("y"),
            rs.getDouble("width"),
            rs.getDouble("height"),
            readJson(rs.getString("data")),
            rs.getLong("created_version"),
            rs.getLong("updated_version"),
            createdAt != null ? createdAt.toInstant() : Instant.EPOCH,
            updatedAt != null ? updatedAt.toInstant() : Instant.EPOCH
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
