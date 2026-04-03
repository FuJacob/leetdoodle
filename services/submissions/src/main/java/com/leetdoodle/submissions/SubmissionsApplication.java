package com.leetdoodle.submissions;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Entry point for the submissions API service.
 *
 * <p>This service accepts code submissions, persists them, and drains the transactional outbox
 * to RabbitMQ with an in-process scheduler.
 */
@SpringBootApplication
@EnableScheduling
public class SubmissionsApplication {
    /**
     * Bootstraps the submissions Spring application.
     *
     * @param args standard JVM startup arguments
     */
    public static void main(String[] args) {
        SpringApplication.run(SubmissionsApplication.class, args);
    }
}
