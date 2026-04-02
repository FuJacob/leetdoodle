package com.leetdoodle.leetcode.seeder;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.leetdoodle.leetcode.model.ImmutableProblem;
import com.leetdoodle.leetcode.model.ImmutableTestCase;
import com.leetdoodle.leetcode.model.Problem;
import com.leetdoodle.leetcode.model.TestCase;
import com.leetdoodle.leetcode.repository.ProblemRepository;
import com.leetdoodle.leetcode.repository.TagRepository;
import com.leetdoodle.leetcode.repository.TestCaseRepository;
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

/**
 * One-time bootstrap seeder for problems, tags, and test cases.
 *
 * <p>Runs after startup only when {@code leetcode.seeder.enabled=true}. The seeder is intentionally
 * idempotent at the table level and batches writes to balance throughput with rollback blast radius.
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

    @Value("${leetcode.seeder.official-questions-path}")
    private String officialQuestionsPath;

    @Value("${leetcode.seeder.eval-metadata-path}")
    private String evalMetadataPath;

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
        List<RawItem> officialQuestionItems = loadOfficialQuestionItems();
        Map<String, RawQuestion> evalMetadataBySlug = loadEvalMetadataBySlug();

        // ── Phase 1: seed tags ───────────────────────────────────────────────
        Map<String, Integer> tagNameToId = seedTags(officialQuestionItems);

        // ── Phase 2: seed problems (+ matching test cases) ───────────────────
        int total = seedProblemsInBatches(officialQuestionItems, tagNameToId, evalMetadataBySlug);
        log.info("Seeding complete. {} problems inserted.", total);
    }

    private List<RawItem> loadOfficialQuestionItems() throws Exception {
        Resource officialResource = ctx.getResource(officialQuestionsPath);
        log.info("Loading official questions from {}", officialResource.getDescription());

        List<RawItem> officialItems = objectMapper.readValue(
                officialResource.getInputStream(),
                new TypeReference<>() {
                });
        log.info("Parsed {} official questions", officialItems.size());
        return officialItems;
    }

    private Map<String, RawQuestion> loadEvalMetadataBySlug() throws Exception {
        // JSONL dataset with eval metadata (prompt + entry_point + test cases).
        // If duplicated task_id rows exist, later rows overwrite earlier rows.
        Map<String, RawQuestion> evalMetadataBySlug = new LinkedHashMap<>();

        Resource evalMetadataResource = ctx.getResource(evalMetadataPath);
        log.info("Loading eval metadata dataset from {}", evalMetadataResource.getDescription());
        loadJsonlDataset(evalMetadataResource, evalMetadataBySlug);
        log.info("Loaded eval metadata for {} problems", evalMetadataBySlug.size());

        if (evalMetadataBySlug.isEmpty()) {
            throw new IllegalStateException("No eval metadata loaded from dataset file. Seeder aborting.");
        }

        return evalMetadataBySlug;
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
            Map<String, RawQuestion> evalMetadataBySlug) {
        DataSeeder proxy = ctx.getBean(DataSeeder.class);

        List<RawQuestion> batch = new ArrayList<>(BATCH_SIZE);
        int total = 0;

        for (RawItem item : officialItems) {
            RawQuestion q = item.data().question();
            batch.add(q);

            if (batch.size() >= BATCH_SIZE) {
                proxy.seedBatch(batch, tagNameToId, evalMetadataBySlug);
                total += batch.size();
                log.info("Inserted {}/{} problems", total, officialItems.size());
                batch.clear();
            }
        }
        if (!batch.isEmpty()) {
            proxy.seedBatch(batch, tagNameToId, evalMetadataBySlug);
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
     * For each problem, if eval metadata exists in the dataset, populate
     * prompt/entry_point + insert test cases in bulk.
     */
    @Transactional
    public void seedBatch(
            List<RawQuestion> batch,
            Map<String, Integer> tagNameToId,
            Map<String, RawQuestion> evalMetadataBySlug) {
        for (RawQuestion q : batch) {
            // Match by slug (URL path) since official API uses URL + slug, dataset uses task_id.
            String slug = extractSlug(q.url());
            RawQuestion evalMetadata = slug != null ? evalMetadataBySlug.get(slug) : null;

            Problem p = mapToProblem(q, evalMetadata);
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

            // Insert test cases if this problem has them in eval metadata JSONL.
            if (evalMetadata != null) {
                if (evalMetadata.inputOutput() != null && !evalMetadata.inputOutput().isEmpty()) {
                    List<TestCase> testCases = new ArrayList<>();
                    int skipped = 0;

                    for (int i = 0; i < evalMetadata.inputOutput().size(); i++) {
                        RawInputOutput io = evalMetadata.inputOutput().get(i);
                        try {
                            if (io == null || io.input() == null || io.output() == null) {
                                skipped++;
                                log.warn("Skipping invalid test case for problem {} at index {} (null input/output)", slug, i);
                                continue;
                            }
                            testCases.add(ImmutableTestCase.builder()
                                    .problemId(problemId)
                                    .input(Objects.requireNonNull(io.input()))
                                    .output(Objects.requireNonNull(io.output()))
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
                log.debug("No eval metadata found for problem {} (slug: {}). Available keys sample: {}",
                    q.title(), slug, evalMetadataBySlug.keySet().stream().limit(3).toList());
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

    private Problem mapToProblem(RawQuestion officialQuestion, RawQuestion evalMetadata) {
        String prompt = firstNonBlank(
                evalMetadata != null ? evalMetadata.prompt() : null,
                officialQuestion.prompt()
        );
        String entryPoint = firstNonBlank(
                evalMetadata != null ? evalMetadata.entryPoint() : null,
                officialQuestion.entryPoint()
        );
        // starter_code only exists in the JSONL eval metadata, never in the official API
        String starterCode = evalMetadata != null ? evalMetadata.starterCode() : null;

        return ImmutableProblem.builder()
                .questionId(Integer.parseInt(Objects.requireNonNull(officialQuestion.questionId())))
                .title(Objects.requireNonNull(officialQuestion.title()))
                .content(officialQuestion.content())
                .difficulty(Objects.requireNonNull(officialQuestion.difficulty()))
                .likes(officialQuestion.likes() != null ? officialQuestion.likes() : 0)
                .dislikes(officialQuestion.dislikes() != null ? officialQuestion.dislikes() : 0)
                .category(officialQuestion.categoryTitle())
                .isPaidOnly(Boolean.TRUE.equals(officialQuestion.isPaidOnly()))
                .hasSolution(Boolean.TRUE.equals(officialQuestion.hasSolution()))
                .hasVideoSolution(Boolean.TRUE.equals(officialQuestion.hasVideoSolution()))
                .slug(extractSlug(officialQuestion.url()))
                .url(officialQuestion.url())
                .solutionContent(officialQuestion.solution() != null ? officialQuestion.solution().content() : null)
                .hints(Objects.requireNonNull(officialQuestion.hints() != null ? officialQuestion.hints() : List.of()))
                .similarQuestions(officialQuestion.similarQuestions())
                .stats(officialQuestion.stats())
                .prompt(prompt)
                .entryPoint(entryPoint)
                .starterCode(starterCode)
                .build();
    }

    private static String firstNonBlank(String preferred, String fallback) {
        if (preferred != null && !preferred.isBlank()) {
            return preferred;
        }
        if (fallback != null && !fallback.isBlank()) {
            return fallback;
        }
        return null;
    }
}
