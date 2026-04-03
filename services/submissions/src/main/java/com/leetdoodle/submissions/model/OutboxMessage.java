package com.leetdoodle.submissions.model;

import java.util.UUID;

/**
 * Claimed outbox row ready for publication to RabbitMQ.
 *
 * <p>The claim token acts like a lightweight lease identifier. It lets the
 * dispatcher mark success or failure only for the claim attempt that currently
 * owns the row.
 */
public record OutboxMessage(
    UUID id,
    String eventType,
    String payloadJson,
    UUID claimToken,
    int attemptCount
) {}
