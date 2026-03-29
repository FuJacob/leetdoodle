package com.leetcanvas.submissions.model;

/**
 * Message published to RabbitMQ when a submission is created.
 *
 * WHY A RECORD?
 * EvalJob is a pure data carrier — no behaviour, no mutation. Java records
 * give us equals/hashCode/toString for free and signal intent clearly.
 * Immutables is overkill here because we don't need a builder or withX() copies.
 *
 * WHY NOT INCLUDE THE CODE DIRECTLY?
 * Code can be arbitrarily large. For now it's fine, but in production you'd
 * store the code in object storage (S3/Blob) and put only the reference in
 * the message — keeps the queue lean and avoids hitting RabbitMQ's message
 * size limits.
 */
public record EvalJob(
    String  submissionId,
    int     problemId,
    String  language,
    String  code
) {}
