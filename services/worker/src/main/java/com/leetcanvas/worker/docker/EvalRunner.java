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

    /**
     * Per-case result: every test case produces one of these regardless of outcome.
     *
     * WHY ALWAYS RUN ALL CASES (for wrong answers)?
     * Fail-fast hides how many cases actually passed. Showing every result lets
     * the user see the full picture — which inputs failed and which didn't.
     * We still stop early on a hard runtime error or TLE because there's no
     * meaningful output to report for subsequent cases in those scenarios.
     *
     * actual / error are null for cases that were never reached (i.e. the ones
     * after a runtime error or TLE stopped execution).
     */
    public record CaseResult(
        String  input,
        String  expected,
        String  actual,   // null if not executed (stopped due to prior error/TLE)
        boolean passed,
        String  error     // null unless this specific case produced a runtime/TLE error
    ) {}

    public record EvalResult(
        String           status,       // ACCEPTED | WRONG_ANSWER | RUNTIME_ERROR | TIME_LIMIT_EXCEEDED
        List<CaseResult> cases,
        String           errorMessage  // null on ACCEPTED/WRONG_ANSWER; error detail otherwise
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

        List<CaseResult> cases = new ArrayList<>();

        for (int i = 0; i < testCases.size(); i++) {
            TestCase tc  = testCases.get(i);
            String[] cmd = buildCmd(language, code, tc.input());
            ExecResult exec = execInContainer(containerId, cmd);

            if (exec.timedOut()) {
                // Hard stop — remaining cases never ran, include them as not-run
                String msg = "Exceeded " + timeoutSeconds + "s limit";
                cases.add(new CaseResult(tc.input(), tc.expectedOutput(), null, false, msg));
                addNotRunCases(cases, testCases, i + 1);
                return new EvalResult("TIME_LIMIT_EXCEEDED", cases, msg);
            }

            if (exec.exitCode() != 0) {
                // Process crashed — remaining cases never ran
                String err = exec.stderr();
                cases.add(new CaseResult(tc.input(), tc.expectedOutput(), null, false, err));
                addNotRunCases(cases, testCases, i + 1);
                return new EvalResult("RUNTIME_ERROR", cases, err);
            }

            // Process exited cleanly — compare output
            String actual   = exec.stdout().trim();
            String expected = tc.expectedOutput().trim();
            // Wrong answer: record the failure but keep running remaining cases
            cases.add(new CaseResult(tc.input(), expected, actual, actual.equals(expected), null));
        }

        boolean allPassed = cases.stream().allMatch(CaseResult::passed);
        return new EvalResult(allPassed ? "ACCEPTED" : "WRONG_ANSWER", cases, null);
    }

    /**
     * Appends placeholder entries for test cases that were never executed.
     * This happens when a runtime error or TLE stops evaluation mid-run.
     * The frontend still shows these cases (with null output) so the user
     * can see the full picture of what was and wasn't tested.
     */
    private void addNotRunCases(List<CaseResult> cases, List<TestCase> testCases, int fromIndex) {
        for (int j = fromIndex; j < testCases.size(); j++) {
            TestCase tc = testCases.get(j);
            cases.add(new CaseResult(tc.input(), tc.expectedOutput(), null, false, null));
        }
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
