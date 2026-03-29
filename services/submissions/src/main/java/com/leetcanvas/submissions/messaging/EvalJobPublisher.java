package com.leetcanvas.submissions.messaging;

import com.leetcanvas.submissions.model.EvalJob;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

@Component
public class EvalJobPublisher {

    private final RabbitTemplate rabbitTemplate;

    public EvalJobPublisher(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    /**
     * Publish an eval job to RabbitMQ.
     *
     * convertAndSend serialises the record to JSON (via Jackson2JsonMessageConverter)
     * and routes it to eval.queue through the eval exchange.
     *
     * This call is fire-and-forget from the HTTP handler's perspective —
     * the submission ID is already saved to Postgres before this runs, so
     * the client can start polling even if the broker is temporarily slow.
     */
    public void publish(EvalJob job) {
        rabbitTemplate.convertAndSend(RabbitConfig.EXCHANGE, RabbitConfig.ROUTING_KEY, job);
    }
}
