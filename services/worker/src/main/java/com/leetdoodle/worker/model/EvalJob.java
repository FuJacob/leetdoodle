package com.leetdoodle.worker.model;

/** Mirrors com.leetdoodle.submissions.model.EvalJob — same JSON shape on the wire. */
public record EvalJob(
    String submissionId,
    int    problemId,
    String language,
    String code,
    ExecutionMode executionMode
) {}
