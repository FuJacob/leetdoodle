package com.leetdoodle.submissions.service;

import com.leetdoodle.submissions.messaging.RabbitConfig;
import com.leetdoodle.submissions.model.OutboxMessage;
import com.leetdoodle.submissions.repository.OutboxRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;

/**
 * Polls the transactional outbox and forwards committed jobs to RabbitMQ.
 *
 * <p>This is an application-owned bridge from durable DB state to RabbitMQ.
 * The tradeoff is deliberate: we accept at-least-once publication semantics in
 * exchange for much simpler operations.
 */
@Component
public class OutboxDispatcher {

    private static final Logger log = LoggerFactory.getLogger(OutboxDispatcher.class);

    private final OutboxRepository outboxRepository;
    private final RabbitTemplate rabbitTemplate;
    private final int batchSize;
    private final Duration claimTtl;

    public OutboxDispatcher(
        OutboxRepository outboxRepository,
        RabbitTemplate rabbitTemplate,
        @Value("${submissions.outbox.dispatcher.batch-size:25}") int batchSize,
        @Value("${submissions.outbox.dispatcher.claim-ttl-seconds:30}") long claimTtlSeconds
    ) {
        this.outboxRepository = outboxRepository;
        this.rabbitTemplate = rabbitTemplate;
        this.batchSize = batchSize;
        this.claimTtl = Duration.ofSeconds(claimTtlSeconds);
    }

    /**
     * Drain a small batch each tick so queue dispatch is prompt without
     * monopolising the database.
     */
    @Scheduled(
        fixedDelayString = "${submissions.outbox.dispatcher.fixed-delay-ms:1000}",
        initialDelayString = "${submissions.outbox.dispatcher.initial-delay-ms:1000}"
    )
    public void dispatchPendingMessages() {
        List<OutboxMessage> messages = outboxRepository.claimBatch(batchSize, claimTtl);
        if (messages.isEmpty()) {
            return;
        }

        for (OutboxMessage message : messages) {
            publishOne(message);
        }
    }

    private void publishOne(OutboxMessage message) {
        try {
            rabbitTemplate.send(
                RabbitConfig.EXCHANGE,
                message.eventType(),
                buildRabbitMessage(message)
            );
            outboxRepository.markPublished(message);
            log.info("outbox.publish.ok id={} attempt={}", message.id(), message.attemptCount());
        } catch (Exception e) {
            String errorSummary = truncate(e.getMessage());
            outboxRepository.releaseClaim(message, errorSummary);
            log.error("outbox.publish.failed id={} attempt={} error={}",
                message.id(), message.attemptCount(), errorSummary, e);
        }
    }

    private Message buildRabbitMessage(OutboxMessage message) {
        MessageProperties properties = new MessageProperties();
        properties.setContentType(MessageProperties.CONTENT_TYPE_JSON);
        properties.setContentEncoding(StandardCharsets.UTF_8.name());
        properties.setDeliveryMode(MessageDeliveryMode.PERSISTENT);
        properties.setMessageId(message.id().toString());
        properties.setHeader("x-outbox-id", message.id().toString());
        properties.setHeader("x-outbox-attempt", message.attemptCount());

        return new Message(message.payloadJson().getBytes(StandardCharsets.UTF_8), properties);
    }

    private String truncate(String message) {
        if (message == null || message.isBlank()) {
            return "Unknown publish failure";
        }
        return message.length() <= 500 ? message : message.substring(0, 500);
    }
}
