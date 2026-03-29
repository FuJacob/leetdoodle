package com.leetcanvas.leetcode.repository;

import com.leetcanvas.leetcode.model.ImmutableTestCase;
import com.leetcanvas.leetcode.model.TestCase;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * Manages test cases in the database.
 *
 * We use batch insert to load many test cases efficiently.
 */
@Repository
public class TestCaseRepository {
  private final NamedParameterJdbcTemplate jdbc;

  public TestCaseRepository(NamedParameterJdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  /**
   * Batch insert test cases for a problem.
   *
   * WHY BATCH INSERT?
   * Loading ~1000 test cases row-by-row would be 1000 round-trips to the database.
   * Batch insert (in the dataSeeder) groups them into one or a few round-trips,
   * reducing latency by orders of magnitude.
   */
  public void insertBatch(Collection<TestCase> testCases) {
    if (testCases.isEmpty()) return;

    String sql = "INSERT INTO test_cases (problem_id, input, output) VALUES (:problemId, :input, :output)";

    List<Map<String, Object>> batch = new ArrayList<>();
    for (TestCase tc : testCases) {
      batch.add(Map.of(
          "problemId", tc.problemId(),
          "input", tc.input(),
          "output", tc.output()
      ));
    }

    jdbc.batchUpdate(sql, batch.toArray(new Map[0]));
  }

  /**
   * Find all test cases for a given problem, ordered by ID.
   */
  public List<TestCase> findByProblemId(Integer problemId) {
    String sql = "SELECT id, problem_id, input, output FROM test_cases WHERE problem_id = :problemId ORDER BY id";
    return jdbc.query(
        sql,
        Map.of("problemId", problemId),
        (rs, rowNum) -> mapRow(rs)
    );
  }

  private TestCase mapRow(ResultSet rs) throws SQLException {
    return ImmutableTestCase.builder()
        .id(rs.getInt("id"))
        .problemId(rs.getInt("problem_id"))
        .input(rs.getString("input"))
        .output(rs.getString("output"))
        .build();
  }
}
