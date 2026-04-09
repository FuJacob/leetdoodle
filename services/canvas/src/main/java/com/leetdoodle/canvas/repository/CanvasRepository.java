package com.leetdoodle.canvas.repository;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.Map;
import java.util.OptionalLong;

/**
 * Repository for canvas-level metadata such as the monotonic committed head
 * version.
 */
@Repository
public class CanvasRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public CanvasRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Ensure the canvas metadata row exists.
     *
     * <p>INSERT .. ON CONFLICT DO NOTHING is the simplest idempotent pattern for
     * lazily creating a room the first time someone writes to it.
     */
    public void ensureCanvasExists(String canvasId) {
        String sql = """
            INSERT INTO canvas.canvases (id)
            VALUES (:canvasId)
            ON CONFLICT (id) DO NOTHING
            """;
        jdbc.update(sql, Map.of("canvasId", canvasId));
    }

    /**
     * Atomically reserve and return the next committed structural version.
     */
    public long reserveNextVersion(String canvasId) {
        ensureCanvasExists(canvasId);

        String sql = """
            UPDATE canvas.canvases
            SET head_version = head_version + 1,
                updated_at = now()
            WHERE id = :canvasId
            RETURNING head_version
            """;
        return jdbc.queryForObject(sql, Map.of("canvasId", canvasId), Long.class);
    }

    /**
     * Read the committed head version if the canvas already exists.
     */
    public OptionalLong findHeadVersion(String canvasId) {
        String sql = """
            SELECT head_version
            FROM canvas.canvases
            WHERE id = :canvasId
            """;
        var rows = jdbc.query(sql, Map.of("canvasId", canvasId), (rs, rowNum) -> rs.getLong("head_version"));
        return rows.isEmpty() ? OptionalLong.empty() : OptionalLong.of(rows.getFirst());
    }
}
