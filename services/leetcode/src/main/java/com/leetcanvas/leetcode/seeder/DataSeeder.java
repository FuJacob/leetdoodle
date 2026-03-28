package com.leetcanvas.leetcode.seeder;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.leetcanvas.leetcode.model.ImmutableProblem;
import com.leetcanvas.leetcode.model.Problem;
import com.leetcanvas.leetcode.repository.ProblemRepository;
import com.leetcanvas.leetcode.repository.TagRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ApplicationContext;
import org.springframework.core.io.Resource; 
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/*
 * ApplicationRunner: Spring calls run() once after the full context is ready
 * (all beans wired, DB connected, Flyway migrations applied).
 *
 * @ConditionalOnProperty: this bean only exists when
 * leetcode.seeder.enabled=true in application.properties.
 * Flip to false and the seeder is completely removed from the bean graph.
 */
@Component
@ConditionalOnProperty(name = "leetcode.seeder.enabled", havingValue = "true")
public class DataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    /*
     * Batch size trade-off (distributed systems concept):
     *   - Too small (1): 3879 round-trips to Postgres. Each INSERT is its
     *     own transaction commit → lots of fsync overhead.
     *   - Too large (all 3879): one transaction holding write locks for a long
     *     time. If it fails, everything rolls back.
     *   - Middle ground (200): amortises per-transaction overhead while
     *     limiting blast radius if one row is malformed.
     */
    private static final int BATCH_SIZE = 200;

    @Value("${leetcode.seeder.json-path}")
    private String jsonPath;

    private final ProblemRepository problemRepository;
    private final TagRepository tagRepository;
    private final ObjectMapper objectMapper;

    /*
     * We inject ApplicationContext to look up the Spring proxy for this bean.
     *
     * @Transactional works via a Spring proxy that wraps method calls in a
     * DB transaction. But calling your OWN @Transactional method as
     * this.seedBatch() bypasses the proxy — the method runs without a
     * transaction. Classic Spring gotcha.
     *
     * Fix: look up the proxy from the context and call through it:
     *   ctx.getBean(DataSeeder.class).seedBatch(...)
     * Now Spring intercepts the call and opens a real transaction.
     */
    private final ApplicationContext ctx;

    public DataSeeder(
        ProblemRepository problemRepository,
        TagRepository tagRepository,
        ObjectMapper objectMapper,
        ApplicationContext ctx
    ) {
        this.problemRepository = problemRepository;
        this.tagRepository     = tagRepository;
        this.objectMapper      = objectMapper;
        this.ctx               = ctx;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        // Idempotency guard: safe to leave seeder enabled across restarts.
        long existing = problemRepository.count();
        if (existing > 0) {
            log.info("Database already contains {} problems — skipping seed.", existing);
            return;
        }

        Resource resource = ctx.getResource(jsonPath);
        log.info("Loading problems from {}", resource.getDescription());

        List<RawItem> items = objectMapper.readValue(
            resource.getInputStream(),
            new TypeReference<>() {}
        );
        log.info("Parsed {} problems from JSON", items.size());

        // ── Phase 1: seed tags ───────────────────────────────────────────────
        // Collect every unique tag name across all problems, then batch-insert.
        Set<String> tagNames = new LinkedHashSet<>();
        for (RawItem item : items) {
            List<RawTag> rawTags = item.data().question().topicTags();
            if (rawTags != null) {
                rawTags.forEach(t -> tagNames.add(t.name()));
            }
        }
        tagRepository.insertAll(tagNames);
        Map<String, Integer> tagNameToId = tagRepository.findAllAsNameToIdMap();
        log.info("Inserted {} tags", tagNameToId.size());

        // ── Phase 2: seed problems in batches ────────────────────────────────
        DataSeeder proxy = ctx.getBean(DataSeeder.class);

        List<RawQuestion> batch = new ArrayList<>(BATCH_SIZE);
        int total = 0;

        for (RawItem item : items) {
            batch.add(item.data().question());

            if (batch.size() >= BATCH_SIZE) {
                proxy.seedBatch(batch, tagNameToId);
                total += batch.size();
                log.info("Inserted {}/{} problems", total, items.size());
                batch.clear();
            }
        }
        if (!batch.isEmpty()) {
            proxy.seedBatch(batch, tagNameToId);
            total += batch.size();
        }

        log.info("Seeding complete. {} problems inserted.", total);
    }

    /**
     * Insert one batch of problems inside a single transaction.
     * If any row fails, the whole batch rolls back — no partial writes.
     */
    @Transactional
    public void seedBatch(List<RawQuestion> batch, Map<String, Integer> tagNameToId) {
        for (RawQuestion q : batch) {
            Problem p = mapToProblem(q);
            int problemId = problemRepository.insert(p);

            // Resolve tag names → tag IDs and write junction rows
            if (q.topicTags() != null) {
                List<Integer> tagIds = q.topicTags().stream()
                    .map(RawTag::name)
                    .map(tagNameToId::get)
                    .filter(Objects::nonNull)
                    .toList();
                if (!tagIds.isEmpty()) {
                    problemRepository.insertProblemTags(problemId, tagIds);
                }
            }
        }
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    /** https://leetcode.com/problems/two-sum/  →  "two-sum" */
    private static String extractSlug(String url) {
        if (url == null) return null;
        String trimmed = url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
        int last = trimmed.lastIndexOf('/');
        return last >= 0 ? trimmed.substring(last + 1) : null;
    }

    // ── mapping ──────────────────────────────────────────────────────────────

    private Problem mapToProblem(RawQuestion q) {
        return ImmutableProblem.builder()
            .questionId(Integer.parseInt(q.questionId()))
            .frontendId(Integer.parseInt(q.questionFrontendId()))
            .title(q.title())
            .content(q.content())
            .difficulty(q.difficulty())
            .likes(q.likes() != null ? q.likes() : 0)
            .dislikes(q.dislikes() != null ? q.dislikes() : 0)
            .category(q.categoryTitle())
            .isPaidOnly(Boolean.TRUE.equals(q.isPaidOnly()))
            .hasSolution(Boolean.TRUE.equals(q.hasSolution()))
            .hasVideoSolution(Boolean.TRUE.equals(q.hasVideoSolution()))
            .slug(extractSlug(q.url()))
            .url(q.url())
            .solutionContent(q.solution() != null ? q.solution().content() : null)
            .hints(q.hints() != null ? q.hints() : List.of())
            .similarQuestions(q.similarQuestions())
            .stats(q.stats())
            .build();
    }
}
