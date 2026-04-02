package com.leetdoodle.leetcode.repository;

import com.leetdoodle.leetcode.model.ImmutableTag;
import com.leetdoodle.leetcode.model.Tag;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

/**
 * JDBC repository for tag metadata and name-id resolution.
 */
@Repository
public class TagRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public TagRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Batch-insert tag names.
     *
     * ON CONFLICT DO NOTHING makes this idempotent — re-running the seeder
     * won't fail if tags already exist. You'll see this pattern everywhere
     * in distributed systems where "at least once" delivery is common
     * (e.g. a message queue retrying a failed batch).
     */
    public void insertAll(Collection<String> tagNames) {
        SqlParameterSource[] batch = tagNames.stream()
            .map(name -> new MapSqlParameterSource("name", name))
            .toArray(SqlParameterSource[]::new);

        jdbc.batchUpdate(
            "INSERT INTO tags (name) VALUES (:name) ON CONFLICT DO NOTHING",
            batch
        );
    }

    /**
     * Returns a name → id lookup map for resolving tags during seeding.
     * Loading the whole table into memory is fine — there are only ~60 tags.
     */
    public Map<String, Integer> findAllAsNameToIdMap() {
        Map<String, Integer> map = new HashMap<>();
        jdbc.query("SELECT id, name FROM tags", (rs, rowNum) -> {
            map.put(rs.getString("name"), rs.getInt("id"));
            return null;
        });
        return map;
    }

    /**
     * RowMapper for tags when JOINed from problem_tags.
     * Expects column aliases "tag_id" and "tag_name" in the result set.
     */
    static Tag mapRow(ResultSet rs) throws SQLException {
        return ImmutableTag.builder()
            .id(rs.getInt("tag_id"))
            .name(Objects.requireNonNull(rs.getString("tag_name")))
            .build();
    }
}
