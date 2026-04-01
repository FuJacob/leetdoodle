package com.leetcanvas.leetcode.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.leetcanvas.leetcode.model.ImmutableProblem;
import com.leetcanvas.leetcode.model.Problem;
import com.leetcanvas.leetcode.model.Tag;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.*;

@Repository
public class ProblemRepository {

    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public ProblemRepository(NamedParameterJdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    // ── Reads ────────────────────────────────────────────────────────────────

    public long count() {
        Long c = jdbc.queryForObject("SELECT count(*) FROM problems", Map.of(), Long.class);
        return c != null ? c : 0;
    }

    public Optional<Problem> findBySlug(String slug) {
        List<Problem> results = jdbc.query(
            "SELECT * FROM problems WHERE slug = :slug",
            Map.of("slug", slug),
            (rs, rowNum) -> mapRow(rs)
        );
        if (results.isEmpty()) return Optional.empty();
        return Optional.of(loadTags(results).getFirst());
    }

    /**
     * Paginated list with optional filters.
     *
     * We build the SQL dynamically — adding WHERE clauses only when filters
     * are present. This is the JDBC equivalent of JPA's Specification pattern,
     * but explicit: you see every line of SQL that runs.
     *
     * The tag filter requires a JOIN through the problem_tags junction table.
     * DISTINCT is needed because a problem with multiple tags would otherwise
     * appear once per tag in the result set.
     */
    public List<Problem> findAll(String difficulty, String tag, int offset, int limit) {
        var sql = new StringBuilder("""
            SELECT DISTINCT p.* FROM problems p
            """);
        var params = new MapSqlParameterSource();
        appendFilters(sql, params, difficulty, tag);
        sql.append(" ORDER BY p.frontend_id ASC LIMIT :limit OFFSET :offset");
        params.addValue("limit", limit);
        params.addValue("offset", offset);

        List<Problem> problems = jdbc.query(sql.toString(), params, (rs, rowNum) -> mapRow(rs));
        return loadTags(problems);
    }

    public long countAll(String difficulty, String tag) {
        var sql = new StringBuilder("SELECT count(DISTINCT p.id) FROM problems p ");
        var params = new MapSqlParameterSource();
        appendFilters(sql, params, difficulty, tag);
        Long c = jdbc.queryForObject(sql.toString(), params, Long.class);
        return c != null ? c : 0;
    }

    // ── Writes (used by the seeder) ──────────────────────────────────────────

    /**
     * Insert a single problem and return its generated id.
     *
     * Postgres RETURNING clause gives us the auto-generated id in the same
     * round-trip as the INSERT — no need for a second SELECT or a KeyHolder.
     * This is Postgres-specific SQL (not standard ANSI), but we're already
     * committed to Postgres for JSONB anyway.
     */
    public int insert(Problem p) {
        String hintsJson = writeJson(p.hints());

        Integer id = jdbc.queryForObject("""
            INSERT INTO problems (
                question_id, slug, title, content, difficulty,
                likes, dislikes, category, is_paid_only,
                has_solution, has_video_solution, url, solution_content,
                hints, similar_questions, stats, company_tags,
                prompt, entry_point
            ) VALUES (
                :questionId, :slug, :title, :content, :difficulty,
                :likes, :dislikes, :category, :isPaidOnly,
                :hasSolution, :hasVideoSolution, :url, :solutionContent,
                CAST(:hints AS jsonb), :similarQuestions, :stats, :companyTags,
                :prompt, :entryPoint
            ) RETURNING id
            """,
            new MapSqlParameterSource()
                .addValue("questionId",       p.questionId())
                .addValue("slug",             p.slug())
                .addValue("title",            p.title())
                .addValue("content",          p.content())
                .addValue("difficulty",       p.difficulty())
                .addValue("likes",            p.likes())
                .addValue("dislikes",         p.dislikes())
                .addValue("category",         p.category())
                .addValue("isPaidOnly",       p.isPaidOnly())
                .addValue("hasSolution",      p.hasSolution())
                .addValue("hasVideoSolution", p.hasVideoSolution())
                .addValue("url",              p.url())
                .addValue("solutionContent",  p.solutionContent())
                .addValue("hints",            hintsJson)
                .addValue("similarQuestions",  p.similarQuestions())
                .addValue("stats",            p.stats())
                .addValue("companyTags",      p.companyTags())
                .addValue("prompt",           p.prompt())
                .addValue("entryPoint",       p.entryPoint()),
            Integer.class
        );

        return id;
    }

    /**
     * Batch-insert rows into the problem_tags junction table.
     *
     * This is a classic many-to-many write: one problem can have many tags,
     * one tag belongs to many problems, and the junction table stores each
     * (problem_id, tag_id) pair. We batch the INSERTs to avoid N round-trips.
     */
    public void insertProblemTags(int problemId, Collection<Integer> tagIds) {
        SqlParameterSource[] batch = tagIds.stream()
            .map(tagId -> new MapSqlParameterSource()
                .addValue("problemId", problemId)
                .addValue("tagId", tagId))
            .toArray(SqlParameterSource[]::new);

        jdbc.batchUpdate(
            "INSERT INTO problem_tags (problem_id, tag_id) VALUES (:problemId, :tagId)",
            batch
        );
    }

    // ── Internal helpers ─────────────────────────────────────────────────────

    private void appendFilters(StringBuilder sql, MapSqlParameterSource params,
                               String difficulty, String tag) {
        if (tag != null && !tag.isBlank()) {
            sql.append("JOIN problem_tags pt ON pt.problem_id = p.id ");
            sql.append("JOIN tags t ON t.id = pt.tag_id ");
        }
        List<String> where = new ArrayList<>();
        if (difficulty != null && !difficulty.isBlank()) {
            where.add("p.difficulty = :difficulty");
            params.addValue("difficulty", difficulty);
        }
        if (tag != null && !tag.isBlank()) {
            where.add("t.name = :tag");
            params.addValue("tag", tag);
        }
        if (!where.isEmpty()) {
            sql.append("WHERE ").append(String.join(" AND ", where)).append(" ");
        }
    }

    /**
     * Maps a single result-set row to a Problem (without tags).
     * Tags are loaded in a second query by loadTags() — this is the
     * "two-query" pattern that avoids the N+1 problem:
     *   - N+1: 1 query for problems + N queries for each problem's tags
     *   - Two-query: 1 query for problems + 1 query for ALL their tags
     */
    private Problem mapRow(ResultSet rs) throws SQLException {
        String hintsJson = rs.getString("hints");
        List<String> hints = hintsJson != null ? readJson(hintsJson) : List.of();

        return ImmutableProblem.builder()
            .id(rs.getInt("id"))
            .questionId(rs.getInt("question_id"))
            .slug(rs.getString("slug"))
            .title(rs.getString("title"))
            .content(rs.getString("content"))
            .difficulty(rs.getString("difficulty"))
            .likes(rs.getInt("likes"))
            .dislikes(rs.getInt("dislikes"))
            .category(rs.getString("category"))
            .isPaidOnly(rs.getBoolean("is_paid_only"))
            .hasSolution(rs.getBoolean("has_solution"))
            .hasVideoSolution(rs.getBoolean("has_video_solution"))
            .url(rs.getString("url"))
            .solutionContent(rs.getString("solution_content"))
            .hints(hints)
            .similarQuestions(rs.getString("similar_questions"))
            .stats(rs.getString("stats"))
            .companyTags(rs.getString("company_tags"))
            .prompt(rs.getString("prompt"))
            .entryPoint(rs.getString("entry_point"))
            .build();
    }

    /**
     * Enriches a list of problems with their tags in a single query.
     *
     * Uses the IN clause to fetch all tags for all problem IDs at once,
     * groups them by problem_id in Java, then creates a new Problem with
     * the tags set via Immutables' withTags() copy method.
     */
    private List<Problem> loadTags(List<Problem> problems) {
        if (problems.isEmpty()) return problems;

        List<Integer> ids = problems.stream().map(Problem::id).toList();
        Map<Integer, List<Tag>> tagsByProblemId = new HashMap<>();

        jdbc.query("""
            SELECT pt.problem_id, t.id AS tag_id, t.name AS tag_name
            FROM problem_tags pt
            JOIN tags t ON t.id = pt.tag_id
            WHERE pt.problem_id IN (:ids)
            ORDER BY t.name
            """,
            Map.of("ids", ids),
            (rs, rowNum) -> {
                int pid = rs.getInt("problem_id");
                tagsByProblemId
                    .computeIfAbsent(pid, k -> new ArrayList<>())
                    .add(TagRepository.mapRow(rs));
                return null;
            }
        );

        // Cast to Problem: Java generics are invariant, so List<ImmutableProblem>
        // is not a List<Problem> even though ImmutableProblem implements Problem.
        return problems.stream()
            .map(p -> (Problem) ImmutableProblem.copyOf(p)
                .withTags(tagsByProblemId.getOrDefault(p.id(), List.of())))
            .toList();
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialise JSON", e);
        }
    }

    private List<String> readJson(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to parse JSON hints", e);
        }
    }
}
