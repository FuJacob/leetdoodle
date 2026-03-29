package com.leetcanvas.worker.messaging;

import com.leetcanvas.worker.model.EvalJob;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.support.converter.DefaultClassMapper;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitConfig {

    public static final String QUEUE = "eval.queue";

    @Bean
    public MessageConverter messageConverter() {
        // WHY DefaultClassMapper?
        //
        // Normally, when the submissions-service published EvalJob directly via
        // Spring AMQP, it added a "__TypeId__" header to the message containing
        // the fully-qualified class name. Jackson2JsonMessageConverter uses that
        // header to know which Java class to deserialise the JSON into.
        //
        // Debezium doesn't know anything about our Java classes — it just
        // forwards the raw JSON payload from the outbox row. No "__TypeId__"
        // header. Without a type hint, Jackson2JsonMessageConverter falls back to
        // LinkedHashMap, and the @RabbitListener method gets a Map instead of
        // an EvalJob — a ClassCastException at runtime.
        //
        // DefaultClassMapper lets us register a default type. When the header is
        // absent, the converter uses this type instead. Since every message on
        // eval.queue is an EvalJob, this is safe and straightforward.
        var classMapper = new DefaultClassMapper();
        classMapper.setDefaultType(EvalJob.class);

        var converter = new Jackson2JsonMessageConverter();
        converter.setClassMapper(classMapper);
        return converter;
    }

    /**
     * Configure the listener container.
     *
     * prefetchCount=1 means the worker fetches one job at a time from the queue.
     * Without this, RabbitMQ would push all queued messages to the consumer at
     * once — a fast queue + slow worker would overwhelm the worker's memory.
     * With prefetch=1, each message is only delivered after the previous ACK,
     * giving us natural back pressure.
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
