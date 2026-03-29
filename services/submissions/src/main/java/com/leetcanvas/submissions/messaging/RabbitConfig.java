package com.leetcanvas.submissions.messaging;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitConfig {

    public static final String EXCHANGE    = "eval";
    public static final String QUEUE       = "eval.queue";
    public static final String ROUTING_KEY = "eval";

    /**
     * Direct exchange: messages route to queues whose binding key matches
     * the routing key exactly. Simple and predictable — good default for
     * task queues. (Topic exchange would let us add routing patterns like
     * "eval.python.*" later if we want per-language queues.)
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

    /**
     * Use Jackson for message serialisation so EvalJob records become JSON
     * on the wire. Both the publisher and the worker share this convention —
     * the worker's RabbitConfig must use the same converter to deserialise.
     */
    @Bean
    public MessageConverter messageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory cf) {
        RabbitTemplate t = new RabbitTemplate(cf);
        t.setMessageConverter(messageConverter());
        return t;
    }
}
