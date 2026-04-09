package com.leetdoodle.collab.canvas;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * Thin synchronous client from collab -> canvas-service.
 *
 * <p>Collab stays the websocket gateway, but durable structural writes now go
 * through canvas-service before we broadcast anything to peers. This client
 * keeps that dependency explicit and localised.
 */
@Component
public class CanvasServiceClient {

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final String baseUrl;

    public CanvasServiceClient(ObjectMapper objectMapper,
                               @Value("${canvas.service.base-url}") String baseUrl) {
        this.objectMapper = objectMapper;
        this.baseUrl = stripTrailingSlash(baseUrl);
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .build();
    }

    /**
     * Fetch the current durable materialized snapshot for one canvas.
     */
    public CanvasSnapshotResponse getSnapshot(String canvasId) {
        HttpRequest request = HttpRequest.newBuilder(uri("/api/canvases/" + encodePathSegment(canvasId)))
            .timeout(Duration.ofSeconds(5))
            .GET()
            .build();

        return send(request, CanvasSnapshotResponse.class);
    }

    /**
     * Commit one structural operation and return the committed versioned result.
     */
    public CommittedCanvasOperationResponse commitStructuralOperation(String canvasId,
                                                                     StructuralOperationRequest requestBody) {
        try {
            String body = objectMapper.writeValueAsString(requestBody);
            HttpRequest request = HttpRequest.newBuilder(uri("/api/canvases/" + encodePathSegment(canvasId) + "/ops"))
                .timeout(Duration.ofSeconds(5))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

            return send(request, CommittedCanvasOperationResponse.class);
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to serialize structural operation request", exception);
        }
    }

    private <T> T send(HttpRequest request, Class<T> responseType) {
        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                return objectMapper.readValue(response.body(), responseType);
            }

            throw new ResponseStatusException(
                HttpStatus.BAD_GATEWAY,
                "canvas-service returned HTTP " + response.statusCode()
            );
        } catch (IOException exception) {
            throw new ResponseStatusException(
                HttpStatus.BAD_GATEWAY,
                "Failed to reach canvas-service",
                exception
            );
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(
                HttpStatus.BAD_GATEWAY,
                "Interrupted while calling canvas-service",
                exception
            );
        }
    }

    private URI uri(String path) {
        return URI.create(baseUrl + path);
    }

    private String stripTrailingSlash(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private String encodePathSegment(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
