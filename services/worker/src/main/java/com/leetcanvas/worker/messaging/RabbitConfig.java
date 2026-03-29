package com.leetcanvas.worker.messaging;

import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitConfig {

    public static final String QUEUE = "eval.queue";

    @Bean
    public MessageConverter messageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    /**
     * Configure the listener container.
     *
     * prefetchCount=1 means the worker fetches one job at a time from the queue.
     * Without this, RabbitMQ would push all queued messages to the consumer at
     * once — a fast queue + slow worker would overwhelm the worker's memory.
     * With prefetch=1, each message is only delivered after the previous ACK,
     * giving us natural back pressure.
     *
     * acknowledgeMode=MANUAL would give full control over ACK timing, but
     * AUTO (default) ACKs after the listener method returns without throwing —
     * good enough for now.
     */
    @Bean
    public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
            ConnectionFactory cf) {
        var factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(cf);
        factory.setMessageConverter(messageConverter());
        factory.setPrefetchCount(1);
        return factory;
    }
}
