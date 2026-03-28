package com.leetcanvas.leetcode.seeder;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

/*
 * These are plain Java records — immutable data carriers introduced in Java 16.
 * They're ideal for DTOs (Data Transfer Objects) because you get:
 *   - A constructor with all fields
 *   - getters (via field name, not getXxx)
 *   - equals, hashCode, toString for free
 *
 * @JsonIgnoreProperties(ignoreUnknown = true) tells Jackson to silently skip
 * any JSON fields we haven't declared here. Without it, Jackson throws on
 * unknown fields — too brittle for a third-party API response.
 */

@JsonIgnoreProperties(ignoreUnknown = true)
// package-private: only used within this package, so no `public` needed
record RawItem(RawData data) {}

@JsonIgnoreProperties(ignoreUnknown = true)
record RawData(RawQuestion question) {}

@JsonIgnoreProperties(ignoreUnknown = true)
record RawQuestion(
    // In the JSON, these IDs are strings ("1", "2") even though they're numbers.
    // We parse them to int in the seeder via Integer.parseInt().
    String questionId,
    String questionFrontendId,

    String title,
    String content,
    Integer likes,
    Integer dislikes,

    // stats and similarQuestions are JSON strings (the LeetCode API embeds
    // JSON inside a JSON string value — double-encoded). We store them as-is.
    String stats,
    String similarQuestions,

    String categoryTitle,
    List<String> hints,
    List<RawTag> topicTags,
    Object companyTags,         // always null in this dataset
    String difficulty,
    Boolean isPaidOnly,
    RawSolution solution,
    Boolean hasSolution,
    Boolean hasVideoSolution,
    String url
) {}

@JsonIgnoreProperties(ignoreUnknown = true)
record RawTag(String name) {}

@JsonIgnoreProperties(ignoreUnknown = true)
record RawSolution(Boolean canSeeDetail, String content) {}
