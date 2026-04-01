package com.leetcanvas.leetcode;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Entry point for the problem catalog service.
 *
 * <p>This service exposes REST and gRPC APIs that serve problems and test-case metadata.
 */
@SpringBootApplication
public class LeetcodeApplication {
    /**
     * Bootstraps the leetcode Spring application.
     *
     * @param args standard JVM startup arguments
     */
    public static void main(String[] args) {
        SpringApplication.run(LeetcodeApplication.class, args);
    }
}
