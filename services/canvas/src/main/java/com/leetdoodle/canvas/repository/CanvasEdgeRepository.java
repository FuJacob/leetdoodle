package com.leetdoodle.canvas.repository;

import com.leetdoodle.canvas.model.CanvasEdgeRecord;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * JDBC repository for the materialized canvas edge table.
 */
@Repository
public class CanvasEdgeRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public CanvasEdgeRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(CanvasEdgeRecord edge) {
        String sql = """
            INSERT INTO canvas.canvas_edges (
                canvas_id, edge_id, from_node_id, to_node_id, created_version, updated_version
            ) VALUES (
                :canvasId, :edgeId, :fromNodeId, :toNodeId, :createdVersion, :updatedVersion
            )
            """;
        jdbc.update(sql, paramsFor(edge));
    }

    public Optional<CanvasEdgeRecord> findById(String canvasId, String edgeId) {
        String sql = """
            SELECT canvas_id, edge_id, from_node_id, to_node_id,
                   created_version, updated_version, created_at, updated_at
            FROM canvas.canvas_edges
            WHERE canvas_id = :canvasId
              AND edge_id = :edgeId
            """;
        var rows = jdbc.query(sql, Map.of("canvasId", canvasId, "edgeId", edgeId), (rs, rowNum) -> mapRow(rs));
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.getFirst());
    }

    public List<CanvasEdgeRecord> findByCanvasId(String canvasId) {
        String sql = """
            SELECT canvas_id, edge_id, from_node_id, to_node_id,
                   created_version, updated_version, created_at, updated_at
            FROM canvas.canvas_edges
            WHERE canvas_id = :canvasId
            ORDER BY created_version ASC, edge_id ASC
            """;
        return jdbc.query(sql, Map.of("canvasId", canvasId), (rs, rowNum) -> mapRow(rs));
    }

    public int delete(String canvasId, String edgeId) {
        String sql = """
            DELETE FROM canvas.canvas_edges
            WHERE canvas_id = :canvasId
              AND edge_id = :edgeId
            """;
        return jdbc.update(sql, Map.of("canvasId", canvasId, "edgeId", edgeId));
    }

    private MapSqlParameterSource paramsFor(CanvasEdgeRecord edge) {
        return new MapSqlParameterSource()
            .addValue("canvasId", edge.canvasId())
            .addValue("edgeId", edge.edgeId())
            .addValue("fromNodeId", edge.fromNodeId())
            .addValue("toNodeId", edge.toNodeId())
            .addValue("createdVersion", edge.createdVersion())
            .addValue("updatedVersion", edge.updatedVersion());
    }

    private CanvasEdgeRecord mapRow(ResultSet rs) throws SQLException {
        Timestamp createdAt = rs.getTimestamp("created_at");
        Timestamp updatedAt = rs.getTimestamp("updated_at");
        return new CanvasEdgeRecord(
            rs.getString("canvas_id"),
            rs.getString("edge_id"),
            rs.getString("from_node_id"),
            rs.getString("to_node_id"),
            rs.getLong("created_version"),
            rs.getLong("updated_version"),
            createdAt != null ? createdAt.toInstant() : Instant.EPOCH,
            updatedAt != null ? updatedAt.toInstant() : Instant.EPOCH
        );
    }
}
