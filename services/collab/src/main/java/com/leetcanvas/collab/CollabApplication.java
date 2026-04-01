package com.leetcanvas.collab;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Entry point for the collaboration relay service.
 *
 * <p>This service owns WebSocket fan-out for canvas presence, cursor, and node events.
 */
@SpringBootApplication
public class CollabApplication {
    /**
     * Bootstraps the collab Spring application.
     *
     * @param args standard JVM startup arguments
     */
    public static void main(String[] args) {
        SpringApplication.run(CollabApplication.class, args);
    }
}
