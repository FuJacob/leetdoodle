package com.leetcanvas.leetcode.seeder;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.leetcanvas.leetcode.model.ImmutableProblem;
import com.leetcanvas.leetcode.model.ImmutableTestCase;
import com.leetcanvas.leetcode.model.Problem;
import com.leetcanvas.leetcode.model.TestCase;
import com.leetcanvas.leetcode.repository.ProblemRepository;
import com.leetcanvas.leetcode.repository.TagRepository;
import com.leetcanvas.leetcode.repository.TestCaseRepository;
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
     * - Too small (1): 3879 round-trips to Postgres. Each INSERT is its
     * own transaction commit → lots of fsync overhead.
     * - Too large (all 3879): one transaction holding write locks for a long
     * time. If it fails, everything rolls back.
     * - Middle ground (200): amortises per-transaction overhead while
     * limiting blast radius if one row is malformed.
     */
    private static final int BATCH_SIZE = 200;

    @Value("${leetcode.seeder.json-path}")
    private String jsonPath;

    @Value("${leetcode.seeder.dataset-path:classpath:test-cases.jsonl}")
    private String datasetPath;

    private final ProblemRepository problemRepository;
    private final TagRepository tagRepository;
    private final TestCaseRepository testCaseRepository;
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
     * ctx.getBean(DataSeeder.class).seedBatch(...)
     * Now Spring intercepts the call and opens a real transaction.
     */
    private final ApplicationContext ctx;

    public DataSeeder(
            ProblemRepository problemRepository,
            TagRepository tagRepository,
            TestCaseRepository testCaseRepository,
            ObjectMapper objectMapper,
            ApplicationContext ctx) {
        this.problemRepository = problemRepository;
        this.tagRepository = tagRepository;
        this.testCaseRepository = testCaseRepository;
        this.objectMapper = objectMapper;
        this.ctx = ctx;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        // Idempotency guard: if problems already exist, skip this run entirely.
        long existing = problemRepository.count();
        if (existing > 0) {
            log.info("Database already contains {} problems — skipping seed.", existing);
            return;
        }

        // ── Phase 0: load source datasets (fail fast if anything is malformed) ──
        List<RawItem> officialItems = loadOfficialItems();
        Map<String, RawQuestion> testCasesByTaskId = loadTestCaseDataset();

        // ── Phase 1: seed tags ───────────────────────────────────────────────
        Map<String, Integer> tagNameToId = seedTags(officialItems);

        // ── Phase 2: seed problems (+ matching test cases) ───────────────────
        int total = seedProblemsInBatches(officialItems, tagNameToId, testCasesByTaskId);
        log.info("Seeding complete. {} problems inserted.", total);
    }

    private List<RawItem> loadOfficialItems() throws Exception {
        Resource officialResource = ctx.getResource(jsonPath);
        log.info("Loading official problems from {}", officialResource.getDescription());

        List<RawItem> officialItems = objectMapper.readValue(
                officialResource.getInputStream(),
                new TypeReference<>() {
                });
        log.info("Parsed {} official problems", officialItems.size());
        return officialItems;
    }

    private Map<String, RawQuestion> loadTestCaseDataset() throws Exception {
        // JSONL dataset with test cases.
        // If duplicated task_id rows exist, later rows overwrite earlier rows.
        Map<String, RawQuestion> testCasesByTaskId = new LinkedHashMap<>();

        Resource datasetResource = ctx.getResource(datasetPath);
        log.info("Loading test-case dataset from {}", datasetResource.getDescription());
        loadJsonlDataset(datasetResource, testCasesByTaskId);
        log.info("Loaded {} problems from dataset", testCasesByTaskId.size());

        if (testCasesByTaskId.isEmpty()) {
            throw new IllegalStateException("No test cases loaded from dataset file. Seeder aborting.");
        }

        return testCasesByTaskId;
    }

    private Map<String, Integer> seedTags(List<RawItem> officialItems) {
        Set<String> tagNames = new LinkedHashSet<>();
        for (RawItem item : officialItems) {
            List<RawTag> rawTags = item.data().question().topicTags();
            if (rawTags != null) {
                rawTags.forEach(t -> tagNames.add(t.name()));
            }
        }

        tagRepository.insertAll(tagNames);
        Map<String, Integer> tagNameToId = tagRepository.findAllAsNameToIdMap();
        log.info("Inserted {} tags", tagNameToId.size());
        return tagNameToId;
    }

    private int seedProblemsInBatches(
            List<RawItem> officialItems,
            Map<String, Integer> tagNameToId,
            Map<String, RawQuestion> testCasesByTaskId) {
        DataSeeder proxy = ctx.getBean(DataSeeder.class);

        List<RawQuestion> batch = new ArrayList<>(BATCH_SIZE);
        int total = 0;

        for (RawItem item : officialItems) {
            RawQuestion q = item.data().question();
            batch.add(q);

            if (batch.size() >= BATCH_SIZE) {
                proxy.seedBatch(batch, tagNameToId, testCasesByTaskId);
                total += batch.size();
                log.info("Inserted {}/{} problems", total, officialItems.size());
                batch.clear();
            }
        }
        if (!batch.isEmpty()) {
            proxy.seedBatch(batch, tagNameToId, testCasesByTaskId);
            total += batch.size();
        }

        return total;
    }

    /**
     * Load a JSONL file (newline-delimited JSON) and merge into testCasesByTaskId.
     * Later duplicates overwrite earlier ones.
     */
    private void loadJsonlDataset(Resource resource, Map<String, RawQuestion> dest) throws Exception {
        try (java.io.BufferedReader reader = new java.io.BufferedReader(
                new java.io.InputStreamReader(resource.getInputStream()))) {
            String line;
            int lineNo = 0;
            while ((line = reader.readLine()) != null) {
                lineNo++;
                if (line.trim().isEmpty())
                    continue;
                RawQuestion q;
                try {
                    q = objectMapper.readValue(line, RawQuestion.class);
                } catch (Exception e) {
                    throw new IllegalStateException(
                        "Failed to parse JSONL in " + resource.getDescription() + " at line " + lineNo, e);
                }

                if (q.taskId() == null || q.taskId().isBlank()) {
                    throw new IllegalStateException(
                        "Missing task_id in " + resource.getDescription() + " at line " + lineNo);
                }
                dest.put(q.taskId(), q);
            }
        }
    }

    /**
     * Insert one batch of problems inside a single transaction.
     * If any row fails, the whole batch rolls back — no partial writes.
     *
     * For each problem, if test cases exist in the dataset, insert them in bulk.
     */
    @Transactional
    public void seedBatch(
            List<RawQuestion> batch,
            Map<String, Integer> tagNameToId,
            Map<String, RawQuestion> testCasesByTaskId) {
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

            // Insert test cases if this problem has them in the dataset
            // Match by slug (URL path) since official API uses slug, dataset uses task_id
            String slug = extractSlug(q.url());
            if (slug != null && testCasesByTaskId.containsKey(slug)) {
                RawQuestion datasetQ = testCasesByTaskId.get(slug);
                if (datasetQ.inputOutput() != null && !datasetQ.inputOutput().isEmpty()) {
                    List<TestCase> testCases = new ArrayList<>();
                    int skipped = 0;

                    for (int i = 0; i < datasetQ.inputOutput().size(); i++) {
                        RawInputOutput io = datasetQ.inputOutput().get(i);
                        try {
                            if (io == null || io.input() == null || io.output() == null) {
                                skipped++;
                                log.warn("Skipping invalid test case for problem {} at index {} (null input/output)", slug, i);
                                continue;
                            }
                            testCases.add(ImmutableTestCase.builder()
                                    .problemId(problemId)
                                    .input(io.input())
                                    .output(io.output())
                                    .build());
                        } catch (Exception e) {
                            skipped++;
                            log.warn("Skipping test case for problem {} at index {} due to error: {}", slug, i, e.toString());
                        }
                    }

                    if (!testCases.isEmpty()) {
                        testCaseRepository.insertBatch(testCases);
                    }
                    log.info("Inserted {} test cases for problem {} (skipped {})", testCases.size(), slug, skipped);
                }
            } else if (slug != null) {
                log.debug("No test cases found for problem {} (slug: {}). Available: {}",
                    q.title(), slug, testCasesByTaskId.keySet().stream().limit(3).toList());
            }
        }
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    /** https://leetcode.com/problems/two-sum/ → "two-sum" */
    private static String extractSlug(String url) {
        if (url == null)
            return null;
        String trimmed = url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
        int last = trimmed.lastIndexOf('/');
        return last >= 0 ? trimmed.substring(last + 1) : null;
    }

    // ── mapping ──────────────────────────────────────────────────────────────

    private Problem mapToProblem(RawQuestion q) {
        return ImmutableProblem.builder()
                .questionId(Integer.parseInt(q.questionId()))
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
