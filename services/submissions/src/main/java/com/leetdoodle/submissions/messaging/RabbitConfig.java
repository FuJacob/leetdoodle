package com.leetdoodle.submissions.messaging;

import org.springframework.amqp.core.*;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Declares the exchange, queue, and binding in RabbitMQ.
 *
 * Spring AMQP calls these "admin beans" — they're idempotent declarations
 * that ensure the topology exists before any message is published. Even
 * though the submissions service no longer publishes directly (Debezium does),
 * we keep these declarations here so the queue exists when the worker starts.
 *
 * WHY KEEP THE TOPOLOGY IN SUBMISSIONS?
 * The submissions service owns the contract: it defines what an eval job looks
 * like and where it lands. The worker is a consumer — it shouldn't be
 * responsible for creating infrastructure it didn't design.
 */
@Configuration
public class RabbitConfig {

    public static final String EXCHANGE    = "eval";
    public static final String QUEUE       = "eval.queue";
    public static final String ROUTING_KEY = "eval";

    /**
     * Direct exchange: messages route to queues whose binding key matches
     * the routing key exactly.
     */
    @Bean
    public DirectExchange evalExchange() {
        return new DirectExchange(EXCHANGE);
    }

    /**
     * Durable queue: survives a RabbitMQ restart. Without durable=true,
     * unprocessed jobs would be lost if the broker goes down.
     */
    @Bean
    public Queue evalQueue() {
        return QueueBuilder.durable(QUEUE).build();
    }

    @Bean
    public Binding evalBinding(Queue evalQueue, DirectExchange evalExchange) {
        return BindingBuilder.bind(evalQueue).to(evalExchange).with(ROUTING_KEY);
    }

    @Bean
    public MessageConverter messageConverter() {
        return new Jackson2JsonMessageConverter();
    }
}
