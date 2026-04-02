package com.leetdoodle.submissions;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Entry point for the submissions API service.
 *
 * <p>This service accepts code submissions, persists them, and publishes eval jobs through
 * the transactional outbox workflow.
 */
@SpringBootApplication
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
