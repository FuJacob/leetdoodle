package com.leetcanvas.worker.model;

/** Mirrors com.leetcanvas.submissions.model.EvalJob — same JSON shape on the wire. */
public record EvalJob(
    String submissionId,
    int    problemId,
    String language,
    String code
) {}
