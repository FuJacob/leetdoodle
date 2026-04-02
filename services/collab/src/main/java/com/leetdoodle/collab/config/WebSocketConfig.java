package com.leetdoodle.collab.config;

import com.leetdoodle.collab.handler.CanvasWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import java.util.Objects;

/**
 * Registers our WebSocket handler with Spring.
 *
 * WebSocket is a protocol upgrade from HTTP. The client sends a normal HTTP
 * request with an "Upgrade: websocket" header. If the server agrees, the
 * connection is promoted to a persistent, full-duplex TCP channel — both sides
 * can send at any time, unlike HTTP where the client always initiates.
 *
 * This config class tells Spring: "when a client hits /ws, hand the connection
 * to CanvasWebSocketHandler". Everything after the handshake is our code.
 */
@Configuration
@EnableWebSocket // activates Spring's WebSocket support
public class WebSocketConfig implements WebSocketConfigurer {

    // Spring injects this automatically because CanvasWebSocketHandler is @Component.
    // This pattern is called Dependency Injection (DI) — instead of calling
    // `new CanvasWebSocketHandler()` ourselves, we declare what we need and
    // Spring creates and provides it. Makes testing much easier.
    private final @NonNull CanvasWebSocketHandler handler;

    public WebSocketConfig(@NonNull CanvasWebSocketHandler handler) {
        this.handler = handler;
    }

    @Override
    public void registerWebSocketHandlers(@NonNull WebSocketHandlerRegistry registry) {
        registry.addHandler(Objects.requireNonNull(handler), "/ws")
                // CORS (Cross-Origin Resource Sharing): browsers block WebSocket
                // connections from a different origin by default. Our frontend
                // runs on localhost:5173, the backend on localhost:8080 — different
                // origins. "*" allows any origin. In production you'd restrict this
                // to your actual frontend domain (e.g., "https://leetdoodle.com").
                .setAllowedOriginPatterns("*");
    }
}
