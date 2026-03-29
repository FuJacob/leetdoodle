import type {
  TestResultsCase,
  TestResultsRunState,
} from "../../shared/nodes";

export interface RunStubResult {
  runState: Extract<
    TestResultsRunState,
    "accepted" | "wrong_answer" | "runtime_error"
  >;
  runtimeMs: number;
  cases: TestResultsCase[];
  errorMessage?: string;
  lastExecutedInput?: string;
}

const SAMPLE_CASES: Array<{ input: string; expected: string }> = [
  { input: "n = 39", expected: "3" },
  { input: "n = 12", expected: "2" },
  { input: "n = 1", expected: "0" },
];

function withDelay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function runCodeStub(
  _problemId: string,
  code: string,
): Promise<RunStubResult> {
  await withDelay(500);

  if (code.includes("opsasd") || code.includes("NameError")) {
    return {
      runState: "runtime_error",
      runtimeMs: 0,
      errorMessage:
        "NameError: name 'opsasd' is not defined\n  return opsasd\nLine 18 in minOperations (Solution.py)\nLine 45 in _driver (Solution.py)",
      lastExecutedInput: SAMPLE_CASES[0].input,
      cases: SAMPLE_CASES.map((sample, idx) => ({
        input: sample.input,
        expected: sample.expected,
        output: idx === 0 ? null : sample.expected,
        passed: idx !== 0,
        error: idx === 0 ? "Runtime Error" : null,
      })),
    };
  }

  if (code.includes("return -1") || code.includes("WRONG_ANSWER")) {
    return {
      runState: "wrong_answer",
      runtimeMs: 1,
      cases: SAMPLE_CASES.map((sample, idx) => ({
        input: sample.input,
        expected: sample.expected,
        output: idx === 1 ? "999" : sample.expected,
        passed: idx !== 1,
      })),
    };
  }

  return {
    runState: "accepted",
    runtimeMs: 0,
    cases: SAMPLE_CASES.map((sample) => ({
      input: sample.input,
      expected: sample.expected,
      output: sample.expected,
      passed: true,
    })),
  };
}
