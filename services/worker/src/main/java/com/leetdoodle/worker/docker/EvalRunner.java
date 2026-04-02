package com.leetdoodle.worker.docker;

import com.github.dockerjava.api.command.ExecCreateCmdResponse;
import com.github.dockerjava.core.command.ExecStartResultCallback;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.TimeUnit;

/**
 * Runs submitted code against test cases inside a Docker container.
 *
 * EXECUTION MODEL (LeetCode-style):
 * For each test case we build a self-contained Python script:
 *
 *   {prompt}          ← boilerplate: imports, ListNode, TreeNode, etc.
 *
 *   {user_code}       ← the user's Solution class
 *
 *   print(repr({entry_point}({input})))
 *                     ← calls the function and prints its repr() output
 *
 * We compare stdout.trim() against test_cases.output (already repr()-format).
 *
 * SCRIPT DELIVERY (base64):
 * We base64-encode the full script and decode it inside the container:
 *   sh -c 'echo "<BASE64>" | base64 -d > /tmp/s.py && python3 /tmp/s.py'
 * This avoids all shell-quoting issues — base64 output contains only
 * [A-Za-z0-9+/=] so it's always safe inside single quotes.
 */
@Component
public class EvalRunner {

    private static final Logger log = LoggerFactory.getLogger(EvalRunner.class);

    @Value("${worker.exec.timeout-seconds:10}")
    private int timeoutSeconds;

    private final ContainerPool pool;

    public EvalRunner(ContainerPool pool) {
        this.pool = pool;
    }

    public record TestCase(String input, String expectedOutput) {}

    /**
     * Eval spec: everything needed to build the per-case execution script.
     * Fetched from the leetcode-service via gRPC before eval starts.
     */
    public record EvalSpec(String prompt, String entryPoint) {}

    /**
     * Per-case result — shape is unchanged so SubmissionResultWriter
     * and the frontend need no updates.
     *
     * We still run all cases on WRONG_ANSWER (to show the full picture)
     * and stop early on RUNTIME_ERROR or TLE.
     */
    public record CaseResult(
        String  input,
        String  expected,
        String  actual,   // null if not executed
        boolean passed,
        String  error     // null unless this case produced a runtime/TLE error
    ) {}

    public record EvalResult(
        String           status,       // ACCEPTED | WRONG_ANSWER | RUNTIME_ERROR | TIME_LIMIT_EXCEEDED
        List<CaseResult> cases,
        String           errorMessage
    ) {}

    public EvalResult run(String submissionId, String code, List<TestCase> testCases, EvalSpec spec)
            throws Exception {
        // Python is the only supported language — the dataset only provides Python evals.
        String containerId = pool.borrow("python");
        log.info("eval.docker.start submission={} container={} testCases={}",
            submissionId, shortId(containerId), testCases.size());
        try {
            EvalResult result = runInContainer(submissionId, containerId, code, testCases, spec);
            log.info("eval.docker.finish submission={} container={} status={}",
                submissionId, shortId(containerId), result.status());
            return result;
        } finally {
            pool.release("python", containerId);
            log.info("eval.docker.release submission={} container={}",
                submissionId, shortId(containerId));
        }
    }

    private EvalResult runInContainer(
            String submissionId, String containerId,
            String code, List<TestCase> testCases, EvalSpec spec) throws Exception {

        List<CaseResult> cases = new ArrayList<>();

        for (int i = 0; i < testCases.size(); i++) {
            TestCase tc  = testCases.get(i);
            String[] cmd = buildCmd(code, tc.input(), spec);
            ExecResult exec = execInContainer(containerId, cmd);

            if (exec.timedOut()) {
                String msg = "Exceeded " + timeoutSeconds + "s limit";
                log.warn("eval.case.timeout submission={} container={} caseIndex={}",
                    submissionId, shortId(containerId), i);
                cases.add(new CaseResult(tc.input(), tc.expectedOutput(), null, false, msg));
                addNotRunCases(cases, testCases, i + 1);
                return new EvalResult("TIME_LIMIT_EXCEEDED", cases, msg);
            }

            if (exec.exitCode() != 0) {
                String err = exec.stderr();
                log.warn("eval.case.runtime_error submission={} container={} caseIndex={} exitCode={}",
                    submissionId, shortId(containerId), i, exec.exitCode());
                cases.add(new CaseResult(tc.input(), tc.expectedOutput(), null, false, err));
                addNotRunCases(cases, testCases, i + 1);
                return new EvalResult("RUNTIME_ERROR", cases, err);
            }

            String actual   = exec.stdout().trim();
            String expected = tc.expectedOutput().trim();
            cases.add(new CaseResult(tc.input(), expected, actual, actual.equals(expected), null));
        }

        boolean allPassed = cases.stream().allMatch(CaseResult::passed);
        return new EvalResult(allPassed ? "ACCEPTED" : "WRONG_ANSWER", cases, null);
    }

    private void addNotRunCases(List<CaseResult> cases, List<TestCase> testCases, int fromIndex) {
        for (int j = fromIndex; j < testCases.size(); j++) {
            TestCase tc = testCases.get(j);
            cases.add(new CaseResult(tc.input(), tc.expectedOutput(), null, false, null));
        }
    }

    /**
     * Build a per-case execution script and deliver it via base64.
     *
     * The script:
     *   {prompt}
     *
     *   {user_code}
     *
     *   print(repr({entry_point}({input})))
     *
     * Base64 encoding means we never have to worry about single quotes,
     * backslashes, or any other special characters in the user's code or
     * the problem's prompt — base64 output is always URL-safe alphanumeric.
     */
    private String[] buildCmd(String code, String input, EvalSpec spec) {
        String script = spec.prompt()
            + "\n\n"
            + code
            + "\n\nprint(repr("
            + spec.entryPoint()
            + "("
            + input
            + ")))\n";

        String b64 = Base64.getEncoder().encodeToString(script.getBytes(StandardCharsets.UTF_8));
        String sh  = "echo '" + b64 + "' | base64 -d > /tmp/s.py && python3 /tmp/s.py";
        return new String[]{"sh", "-c", sh};
    }

    @SuppressWarnings("deprecation")
    private ExecResult execInContainer(String containerId, String[] cmd) throws Exception {
        ExecCreateCmdResponse exec = pool.docker()
            .execCreateCmd(Objects.requireNonNull(containerId))
            .withAttachStdout(true)
            .withAttachStderr(true)
            .withCmd(cmd)
            .exec();
        String execId = Objects.requireNonNull(exec.getId());

        var stdout = new ByteArrayOutputStream();
        var stderr = new ByteArrayOutputStream();
        long startedAt = System.currentTimeMillis();

        boolean finished = pool.docker()
            .execStartCmd(execId)
            .exec(new ExecStartResultCallback(stdout, stderr))
            .awaitCompletion(timeoutSeconds, TimeUnit.SECONDS);

        Long exitCode = pool.docker()
            .inspectExecCmd(execId)
            .exec()
            .getExitCodeLong();

        long elapsedMs = System.currentTimeMillis() - startedAt;
        log.debug("eval.exec.complete container={} execId={} elapsedMs={} finished={} exitCode={}",
            shortId(containerId), shortId(execId), elapsedMs, finished, exitCode);

        return new ExecResult(
            stdout.toString(),
            stderr.toString(),
            exitCode != null ? exitCode.intValue() : -1,
            !finished
        );
    }

    private String shortId(String value) {
        if (value == null || value.isBlank()) return "unknown";
        return value.length() <= 12 ? value : value.substring(0, 12);
    }

    private record ExecResult(String stdout, String stderr, int exitCode, boolean timedOut) {}
}
