package com.leetcanvas.leetcode.seeder;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Top-level item wrapper in the imported JSONL corpus.
 *
 * <p>These package-private records exist only for seeding. They intentionally keep the payload
 * close to source shape and ignore unknown fields for compatibility with upstream schema changes.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
record RawItem(RawData data) {}

/**
 * Wrapper around question payload used in dataset entries.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
record RawData(RawQuestion question) {}

/**
 * Source question payload used by {@link DataSeeder}.
 *
 * @param questionId legacy source question id
 * @param title display title
 * @param content rich problem statement
 * @param likes upvote count
 * @param dislikes downvote count
 * @param stats serialized acceptance/submission statistics
 * @param similarQuestions serialized similar-question payload
 * @param categoryTitle broad category from source
 * @param hints hint list
 * @param topicTags source tags
 * @param companyTags source company tags payload
 * @param difficulty source difficulty
 * @param isPaidOnly premium-gated flag
 * @param solution source solution metadata
 * @param hasSolution whether a solution is available
 * @param hasVideoSolution whether a video solution exists
 * @param url source URL
 * @param taskId alternate dataset id format
 * @param problemDescription alternate plain-text statement
 * @param inputOutput alternate test-case payload
 * @param prompt hidden execution scaffold prepended by the worker
 * @param entryPoint invocation expression used by worker runtime
 * @param starterCode editor-visible starter template
 */
@JsonIgnoreProperties(ignoreUnknown = true)
record RawQuestion(
    // Old API format fields (from LeetCode's official API)
    // Supports both "questionId" (official payload) and "question_id" (JSONL dataset).
    @JsonAlias("question_id")
    String questionId,

    String title,
    String content,
    Integer likes,
    Integer dislikes,

    String stats,
    String similarQuestions,

    String categoryTitle,
    List<String> hints,
    List<RawTag> topicTags,
    Object companyTags,
    String difficulty,
    Boolean isPaidOnly,
    RawSolution solution,
    Boolean hasSolution,
    Boolean hasVideoSolution,
    String url,

    // New dataset format fields (from train/test JSONL files)
    @JsonProperty("task_id")
    String taskId,
    @JsonProperty("problem_description")
    String problemDescription,
    @JsonProperty("input_output")
    List<RawInputOutput> inputOutput,  // test cases

    // Eval fields: used to build per-case execution scripts in the worker.
    // prompt = Python boilerplate (imports, ListNode, TreeNode, etc.)
    // entry_point = how to call the solution, e.g. "Solution().twoSum"
    @JsonProperty("prompt")
    String prompt,
    @JsonProperty("entry_point")
    String entryPoint,

    // Function stub shown in the code editor, e.g. "class Solution:\n    def twoSum(...):"
    @JsonProperty("starter_code")
    String starterCode
) {}

/**
 * Raw topic tag from source payload.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
record RawTag(String name) {}

/**
 * Raw solution metadata from source payload.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
record RawSolution(Boolean canSeeDetail, String content) {}

/**
 * Raw test case pair from source payload.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
record RawInputOutput(String input, String output) {}
