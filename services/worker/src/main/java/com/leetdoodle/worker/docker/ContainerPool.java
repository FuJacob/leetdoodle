package com.leetdoodle.worker.docker;

import com.github.dockerjava.api.DockerClient;
import com.github.dockerjava.api.exception.NotFoundException;
import com.github.dockerjava.api.model.HostConfig;
import com.github.dockerjava.core.DefaultDockerClientConfig;
import com.github.dockerjava.core.DockerClientImpl;
import com.github.dockerjava.core.command.PullImageResultCallback;
import com.github.dockerjava.zerodep.ZerodepDockerHttpClient;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.time.Duration;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.*;

/**
 * Maintains a pool of pre-warmed Docker containers per language.
 *
 * WHY PRE-WARM?
 * Cold-starting a container (docker run) takes ~1-2 seconds: image layer
 * decompression, namespace setup, process init. At our scale that's fine,
 * but pre-warming eliminates that latency entirely — a warm container just
 * needs a docker exec to run code, which is ~50ms.
 *
 * POOL DESIGN — single-use containers:
 * Each container is used exactly once, then destroyed. This gives us
 * strong isolation: code from submission A can't pollute the filesystem,
 * environment, or process state seen by submission B.
 * After destruction we immediately spin up a replacement to refill the pool.
 *
 * RESOURCE LIMITS:
 * Each container is created with CPU and memory caps so a runaway submission
 * can't starve the host or other containers.
 */
@Component
public class ContainerPool {

    private static final Logger log = LoggerFactory.getLogger(ContainerPool.class);

    // Language → Docker image mapping
    private static final Map<String, String> IMAGES = Map.of(
            "python", "python:3.12-alpine");

    @Value("${worker.docker.host:unix:///var/run/docker.sock}")
    private String dockerHost;

    @Value("${worker.pool.size:1}")
    private int poolSize;

    private DockerClient docker;

    // One blocking queue per language — acts as the pool
    private final Map<String, BlockingQueue<String>> pools = new ConcurrentHashMap<>();

    // Background thread pool for async container replacement
    private final ExecutorService refillExecutor = Executors.newCachedThreadPool();

    @PostConstruct
    public void init() {
        String resolvedDockerHost = Objects.requireNonNull(dockerHost);
        // WHY SET dockerHost IN BOTH PLACES?
        // DefaultDockerClientConfig reads DOCKER_HOST from the environment,
        // which silently overrides whatever URI we pass to the HTTP client builder.
        // Pinning the same value in the config too ensures the library agrees
        // on which socket to use, regardless of what's in the environment.
        var config = DefaultDockerClientConfig.createDefaultConfigBuilder()
                .withDockerHost(resolvedDockerHost)
                .build();
        docker = DockerClientImpl.getInstance(
                config,
                new ZerodepDockerHttpClient.Builder()
                        .dockerHost(URI.create(resolvedDockerHost))
                        .connectionTimeout(Duration.ofSeconds(10))
                        .build());

        // Pre-warm containers for each supported language
        for (var entry : IMAGES.entrySet()) {
            String language = entry.getKey();
            String image = entry.getValue();
            ensureImageAvailable(image);
            var queue = new LinkedBlockingQueue<String>(poolSize);
            pools.put(language, queue);
            for (int i = 0; i < poolSize; i++) {
                queue.add(createAndStart(language, image));
            }
            log.info("Pool ready: {} × {} containers for {}", poolSize, image, language);
        }
    }

    /**
     * Ensures the Docker image is present locally before pre-warming containers.
     * This prevents startup failures on fresh machines where the runtime image
     * hasn't been pulled yet.
     */
    @SuppressWarnings("deprecation")
    private void ensureImageAvailable(String image) {
        String resolvedImage = Objects.requireNonNull(image);
        try {
            docker.inspectImageCmd(resolvedImage).exec();
        } catch (NotFoundException ignored) {
            log.info("Image {} not found locally; pulling...", resolvedImage);
            try {
                docker.pullImageCmd(resolvedImage)
                        .exec(new PullImageResultCallback())
                        .awaitCompletion();
                log.info("Pulled image {}", resolvedImage);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new RuntimeException("Interrupted while pulling image " + resolvedImage, e);
            }
        }
    }

    /**
     * Borrow a container for the given language.
     * Blocks up to 30 seconds if all containers are busy.
     *
     * BACK PRESSURE: if the pool is empty (all containers in use), this
     * blocks the consumer thread. Combined with RabbitMQ prefetch=1, this
     * means the broker will stop delivering new jobs until a container frees
     * up — natural rate limiting without a separate throttle.
     */
    public String borrow(String language) throws InterruptedException {
        var queue = pools.get(language);
        if (queue == null)
            throw new IllegalArgumentException("Unsupported language: " + language);
        int availableBefore = queue.size();
        long startedAt = System.currentTimeMillis();
        String containerId = queue.poll(30, TimeUnit.SECONDS);
        long waitedMs = System.currentTimeMillis() - startedAt;
        if (containerId == null) {
            log.error("pool.borrow.timeout language={} waitedMs={} availableBefore={} availableAfter={}",
                    language, waitedMs, availableBefore, queue.size());
            throw new RuntimeException("Timed out waiting for a container");
        }
        log.info("pool.borrow.ok language={} container={} waitedMs={} availableBefore={} availableAfter={}",
                language, shortId(containerId), waitedMs, availableBefore, queue.size());
        return containerId;
    }

    /**
     * Destroy a used container and asynchronously spin up a replacement.
     *
     * We destroy synchronously (can't reuse a container that ran arbitrary code),
     * but create the replacement on a background thread so the consumer isn't
     * blocked waiting for a new container to warm up.
     */
    public void release(String language, String containerId) {
        int availableBefore = pools.get(language).size();
        destroyContainer(containerId);
        log.info("pool.release.destroyed language={} container={} availableBefore={}",
                language, shortId(containerId), availableBefore);

        String image = IMAGES.get(language);
        refillExecutor.submit(() -> {
            try {
                String replacement = createAndStart(language, image);
                pools.get(language).add(replacement);
                log.info("pool.release.refilled language={} replacement={} availableNow={}",
                        language, shortId(replacement), pools.get(language).size());
            } catch (Exception e) {
                log.error("Failed to refill pool for {}", language, e);
            }
        });
    }

    private String createAndStart(String language, String image) {
        String id = docker.createContainerCmd(Objects.requireNonNull(image))
                .withCmd("sleep", "infinity") // idle container waiting for exec
                .withNetworkDisabled(true) // no outbound network from submitted code
                .withHostConfig(HostConfig.newHostConfig()
                        .withMemory(256 * 1024 * 1024L) // 256 MB RAM cap
                        .withCpuPeriod(100_000L)
                        .withCpuQuota(50_000L)) // 50% of one CPU core
                .exec()
                .getId();

        docker.startContainerCmd(Objects.requireNonNull(id)).exec();
        log.debug("Started container {} for {}", id.substring(0, 12), language);
        return id;
    }

    private void destroyContainer(String id) {
        try {
            docker.removeContainerCmd(Objects.requireNonNull(id)).withForce(true).exec();
        } catch (Exception e) {
            log.warn("Failed to remove container {}: {}", shortId(id), e.getMessage());
        }
    }

    private String shortId(String value) {
        if (value == null || value.isBlank())
            return "unknown";
        return value.length() <= 12 ? value : value.substring(0, 12);
    }

    @PreDestroy
    public void shutdown() {
        refillExecutor.shutdownNow();
        pools.values().forEach(queue -> queue.forEach(this::destroyContainer));
    }

    public DockerClient docker() {
        return docker;
    }
}
