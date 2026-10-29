import axios, { isAxiosError } from 'axios';
import { env } from '../config/env';
import { logger } from './logger';
import { AppError } from '../middlewares/errorHandler';
import type { CodingLanguage } from '../features/tests/test.model';
import type { CodeRunBatchOptions, CodeRunResult } from './code-runner';

// OnlineCompiler.io (https://onlinecompiler.io) — hosted, sandboxed code execution with current
// compilers. We use its run-tests endpoint: one request runs the same program against many
// stdins and returns each run's output, so a whole question's test cases cost one round-trip.
// Output comparison stays in test.service (normalizeOutput), exactly as with Judge0 — every test
// is sent as visible with an empty expected output, purely to get each run's stdout back.

const COMPILERS: Record<CodingLanguage, string> = {
  python: 'python-3.14',
  java: 'openjdk-25',
  c: 'gcc-15',
  cpp: 'g++-15',
  javascript: 'nodejs-24',
};

/** What the student sees as the runtime for each language (shown next to the language picker). */
export const ONLINECOMPILER_RUNTIME_LABELS: Record<CodingLanguage, string> = {
  python: 'Python 3.14',
  java: 'Java (OpenJDK 25)',
  c: 'C (GCC 15)',
  cpp: 'C++ (G++ 15)',
  javascript: 'JavaScript (Node.js 24)',
};

// The per-request budget is 60 s and no test starts after 45 s, so a chunk's tests × time limit
// has to fit in that — a long chunk gets a shorter per-test limit rather than a 400.
const REQUEST_RUN_BUDGET_S = 45;
// 429 means "every slot is busy" (or a per-minute cap) — nothing ran, so it's safe to retry.
const RETRY_DEADLINE_MS = 60_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const unavailable = () => new AppError('Code execution service is currently unavailable — please try again shortly.', 503, 'CODE_EXECUTION_UNAVAILABLE');

export function isOnlineCompilerConfigured(): boolean {
  return !!env.ONLINECOMPILER_API_KEY;
}

type Verdict =
  | 'accepted' | 'wrong_answer' | 'compilation_error' | 'runtime_error' | 'time_limit_exceeded'
  | 'memory_limit_exceeded' | 'output_limit_exceeded' | 'internal_error' | 'skipped';

interface RunTestsResponse {
  verdict: string;
  compile_error: string | null;
  tests: Array<{ verdict: Verdict; output?: string; error?: string; time?: string }>;
}

/** OnlineCompiler verdicts → the Judge0-style status test.service already understands
 *  (3 = ran to completion, 6 = compile error, anything above 3 = a failed run). */
const STATUS: Record<Verdict, { id: number; label: string }> = {
  accepted: { id: 3, label: 'Accepted' },
  // We never send a real expected output, so "wrong answer" just means "ran fine".
  wrong_answer: { id: 3, label: 'Accepted' },
  compilation_error: { id: 6, label: 'Compilation Error' },
  time_limit_exceeded: { id: 5, label: 'Time Limit Exceeded' },
  runtime_error: { id: 11, label: 'Runtime Error' },
  memory_limit_exceeded: { id: 11, label: 'Memory Limit Exceeded' },
  output_limit_exceeded: { id: 11, label: 'Output Limit Exceeded' },
  internal_error: { id: 13, label: 'Internal Error' },
  skipped: { id: 13, label: 'Not run' },
};

async function postWithRetry(body: unknown): Promise<RunTestsResponse> {
  const deadline = Date.now() + RETRY_DEADLINE_MS;
  for (let attempt = 0; ; attempt += 1) {
    try {
      const { data } = await axios.post<RunTestsResponse>(`${env.ONLINECOMPILER_API_URL}/api/run-tests/`, body, {
        headers: { Authorization: env.ONLINECOMPILER_API_KEY!, 'Content-Type': 'application/json' },
        timeout: 75_000,
      });
      return data;
    } catch (err) {
      const status = isAxiosError(err) ? err.response?.status : undefined;
      if (status === 429 && Date.now() < deadline) {
        // Exponential backoff with jitter, so a lab full of students doesn't retry in lockstep.
        await sleep(Math.min(8_000, 500 * 2 ** attempt) + Math.random() * 500);
        continue;
      }
      const detail = isAxiosError(err) ? (err.response?.data as { error?: string } | undefined)?.error ?? err.message : String(err);
      logger.error('OnlineCompiler request failed', { status, detail });
      throw unavailable();
    }
  }
}

/** Same contract as runBatchOnJudge0: one result per stdin, in order. A compile error or a
 *  failing program is a normal result; only a transport failure or exhausted retries throws. */
export async function runBatchOnOnlineCompiler({ code, language, stdins, timeoutSeconds = 5 }: CodeRunBatchOptions): Promise<CodeRunResult[]> {
  if (!isOnlineCompilerConfigured()) throw new Error('OnlineCompiler is not configured (missing ONLINECOMPILER_API_KEY)');
  if (stdins.length === 0) return [];

  const chunkSize = Math.max(1, env.ONLINECOMPILER_MAX_TESTS);
  const results: CodeRunResult[] = [];

  for (let start = 0; start < stdins.length; start += chunkSize) {
    const chunk = stdins.slice(start, start + chunkSize);
    const timeLimit = Math.max(1, Math.min(timeoutSeconds, Math.floor(REQUEST_RUN_BUDGET_S / chunk.length)));
    const data = await postWithRetry({
      compiler: COMPILERS[language],
      code,
      tests: chunk.map((input) => ({ input, expected_output: '' })),
      time_limit: timeLimit,
      checker: 'trim',
      scoring: 'percent',
      stop_on_failure: false,
    });

    if (data.compile_error) {
      // Compilation fails identically for every input — report it once per run and stop.
      return stdins.map(() => ({ stdout: '', stderr: '', compileOutput: data.compile_error!, status: 'Compilation Error', statusId: 6 }));
    }

    chunk.forEach((_, i) => {
      const t = data.tests[i];
      const s = (t && STATUS[t.verdict]) ?? STATUS.internal_error;
      results.push({ stdout: t?.output ?? '', stderr: t?.error ?? '', compileOutput: '', status: s.label, statusId: s.id, time: t?.time });
    });
  }
  return results;
}
