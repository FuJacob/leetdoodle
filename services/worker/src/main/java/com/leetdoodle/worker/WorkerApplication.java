package com.leetdoodle.worker;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Entry point for the worker service.
 *
 * <p>The worker consumes evaluation jobs, executes user code in containers, and writes results
 * back to the submissions database.
 */
@SpringBootApplication
public class WorkerApplication {
    /**
     * Bootstraps the worker Spring application.
     *
     * @param args standard JVM startup arguments
     */
    public static void main(String[] args) {
        SpringApplication.run(WorkerApplication.class, args);
    }
}
