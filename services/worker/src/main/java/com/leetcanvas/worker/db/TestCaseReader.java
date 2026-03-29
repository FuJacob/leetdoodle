package com.leetcanvas.worker.db;

import com.leetcanvas.worker.docker.EvalRunner.TestCase;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Reads test cases from the public schema owned by leetcode-service.
 *
 * WHY DIRECT DB ACCESS instead of calling the leetcode-service HTTP API?
 * - Fewer moving parts during evaluation (no HTTP failure mode)
 * - Lower latency — one DB query vs a network round-trip
 * The downside is tight coupling to the schema. If leetcode-service renames
 * the test_cases table, this breaks silently. For now that's an acceptable
 * tradeoff; we'd switch to HTTP if the services ever ran on separate databases.
 */
@Component
public class TestCaseReader {

    private final NamedParameterJdbcTemplate jdbc;

    public TestCaseReader(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<TestCase> findByProblemId(int problemId) {
        String sql = """
            SELECT input, output
            FROM test_cases
            WHERE problem_id = :problemId
            ORDER BY id
            """;
        return jdbc.query(
            sql,
            Map.of("problemId", problemId),
            (rs, n) -> new TestCase(rs.getString("input"), rs.getString("output"))
        );
    }
}
