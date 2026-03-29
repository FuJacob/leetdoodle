package com.leetcanvas.worker.docker;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.dockerjava.api.command.ExecCreateCmdResponse;
import com.github.dockerjava.core.command.ExecStartResultCallback;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Runs submitted code against test cases inside a Docker container.
 *
 * EXECUTION MODEL (stdin/stdout):
 * We use the simplest possible harness: pipe test input to the process via
 * stdin, capture stdout, compare to expected output.
 * This matches competitive-programming conventions (HackerRank, Codeforces, etc.)
 * and avoids needing to know problem-specific function signatures.
 *
 * The tradeoff: problems that expect function calls (LeetCode's actual format)
 * need a wrapper script per language that parses input and calls the right function.
 * That's a future concern — the architecture here supports it without changes.
 */
@Component
public class EvalRunner {

    private static final Logger log = LoggerFactory.getLogger(EvalRunner.class);

    @Value("${worker.exec.timeout-seconds:10}")
    private int timeoutSeconds;

    private final ContainerPool pool;
    private final ObjectMapper  objectMapper = new ObjectMapper();

    public EvalRunner(ContainerPool pool) {
        this.pool = pool;
    }

    public record TestCase(String input, String expectedOutput) {}

    public record EvalResult(
        String status,          // ACCEPTED | WRONG_ANSWER | RUNTIME_ERROR | TIME_LIMIT_EXCEEDED
        int    passed,
        int    total,
        String failureDetail    // null on ACCEPTED
    ) {}

    /**
     * Run all test cases and return an aggregated result.
     *
     * We stop on first failure (fail-fast) — same behaviour as LeetCode.
     */
    public EvalResult run(String language, String code, List<TestCase> testCases) throws Exception {
        String containerId = pool.borrow(language);
        try {
            return runInContainer(containerId, language, code, testCases);
        } finally {
            // Always release — even on exception — so the pool doesn't drain
            pool.release(language, containerId);
        }
    }

    private EvalResult runInContainer(
            String containerId, String language,
            String code, List<TestCase> testCases) throws Exception {

        int passed = 0;
        for (TestCase tc : testCases) {
            String[] cmd = buildCmd(language, code, tc.input());
            ExecResult exec = execInContainer(containerId, cmd);

            if (!exec.timedOut && exec.exitCode == 0) {
                String actual   = exec.stdout.trim();
                String expected = tc.expectedOutput().trim();
                if (actual.equals(expected)) {
                    passed++;
                } else {
                    String detail = "Input: " + tc.input()
                        + "\nExpected: " + expected
                        + "\nActual:   " + actual;
                    return new EvalResult("WRONG_ANSWER", passed, testCases.size(), detail);
                }
            } else if (exec.timedOut) {
                return new EvalResult("TIME_LIMIT_EXCEEDED", passed, testCases.size(),
                    "Exceeded " + timeoutSeconds + "s limit");
            } else {
                return new EvalResult("RUNTIME_ERROR", passed, testCases.size(), exec.stderr);
            }
        }
        return new EvalResult("ACCEPTED", passed, testCases.size(), null);
    }

    /**
     * Build the shell command that runs the user's code with the given input.
     *
     * For now: write code to a temp file then pipe input to it.
     * python: echo "<input>" | python3 -c "<code>"
     * node:   echo "<input>" | node -e "<code>"
     *
     * This is intentionally minimal — a real harness would copy a wrapper
     * script into the container and pass code as a file, not an inline arg.
     */
    private String[] buildCmd(String language, String code, String input) {
        String escaped = code.replace("'", "'\\''"); // escape single quotes for shell
        String script = "echo '" + input + "' | " + runner(language) + " '" + escaped + "'";
        return new String[]{"sh", "-c", script};
    }

    private String runner(String language) {
        return switch (language) {
            case "python"     -> "python3 -c";
            case "javascript" -> "node -e";
            default -> throw new IllegalArgumentException("Unsupported language: " + language);
        };
    }

    private ExecResult execInContainer(String containerId, String[] cmd) throws Exception {
        ExecCreateCmdResponse exec = pool.docker()
            .execCreateCmd(containerId)
            .withAttachStdout(true)
            .withAttachStderr(true)
            .withCmd(cmd)
            .exec();

        var stdout = new ByteArrayOutputStream();
        var stderr = new ByteArrayOutputStream();

        boolean finished = pool.docker()
            .execStartCmd(exec.getId())
            .exec(new ExecStartResultCallback(stdout, stderr))
            .awaitCompletion(timeoutSeconds, TimeUnit.SECONDS);

        Long exitCode = pool.docker()
            .inspectExecCmd(exec.getId())
            .exec()
            .getExitCodeLong();

        return new ExecResult(
            stdout.toString(),
            stderr.toString(),
            exitCode != null ? exitCode.intValue() : -1,
            !finished
        );
    }

    private record ExecResult(String stdout, String stderr, int exitCode, boolean timedOut) {}
}
