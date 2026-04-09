package com.leetdoodle.canvas;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Entry point for the canvas service.
 *
 * <p>This service owns durable structural canvas state: nodes, edges, and the
 * ordered log of committed structural operations. The collab service can remain
 * focused on low-latency fan-out for ephemeral multiplayer signals.
 */
@SpringBootApplication
public class CanvasApplication {

    /**
     * Bootstraps the Spring application.
     */
    public static void main(String[] args) {
        SpringApplication.run(CanvasApplication.class, args);
    }
}
