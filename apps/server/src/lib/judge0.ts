import axios from 'axios';
import { env } from '../config/env';
import { logger } from './logger';
import { AppError } from '../middlewares/errorHandler';
import type { CodingLanguage } from '../features/tests/test.model';

// Judge0 (https://judge0.com) — used to actually compile/run a candidate's submitted code
// against test-case input/output for coding-type questions. We call the CE (Community Edition)
// REST API — either via RapidAPI (JUDGE0_API_URL + JUDGE0_API_KEY + JUDGE0_API_HOST), or any
// self-hosted / public instance that needs no key (JUDGE0_API_URL alone, e.g. the public
// https://ce.judge0.com, which is fine for development but rate-limited — use RapidAPI or your
// own instance in production). Leaving JUDGE0_API_URL blank disables execution: every function
// here degrades to `not_configured` rather than throwing, so the rest of the test still works.

// Judge0's language_id for each language's latest stable runtime as of writing. If Judge0 adds
// a newer id for one of these later, bump it here — nothing else needs to change.
const LANGUAGE_IDS: Record<CodingLanguage, number> = {
  python: 71, // Python 3.8.1
  java: 62, // OpenJDK 13.0.1
  c: 50, // GCC 9.2.0
  cpp: 54, // GCC 9.2.0 (C++17)
  javascript: 63, // Node.js 12.14.0
};

export interface Judge0BatchOptions {
  code: string;
  language: CodingLanguage;
  /** One run per entry, each fed this stdin. */
  stdins: string[];
  /** CPU time limit per run, in seconds. */
  timeoutSeconds?: number;
}

export interface Judge0RunResult {
  stdout: string;
  stderr: string;
  /** Populated only for a compile-time failure (status id 6). */
  compileOutput: string;
  /** Judge0 status description, e.g. "Accepted", "Runtime Error (NZEC)", "Time Limit Exceeded". */
  status: string;
  statusId: number;
  /** CPU time in seconds, as Judge0 reports it (e.g. "0.023"). */
  time?: string;
}

export function isJudge0Configured(): boolean {
  if (!env.JUDGE0_API_URL) return false;
  // .env.example ships the RapidAPI URL pre-filled with a blank key — that combination can
  // never succeed, so treat it as "not configured" rather than as a failing service.
  if (env.JUDGE0_API_URL.includes('rapidapi.com') && !env.JUDGE0_API_KEY) return false;
  return true;
}

// The RapidAPI headers only make sense (and are only sent) when a key is configured — a
// self-hosted or public instance rejects nothing for their absence.
function judge0Headers(): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (env.JUDGE0_API_KEY) {
    headers['X-RapidAPI-Key'] = env.JUDGE0_API_KEY;
    headers['X-RapidAPI-Host'] = env.JUDGE0_API_HOST;
  }
  return headers;
}

// Judge0 statuses 1 (In Queue) and 2 (Processing) are the only non-final ones.
const isFinal = (statusId: number) => statusId > 2;
const POLL_INTERVAL_MS = 800;
// Overall wall-clock budget for a batch, queueing included — a busy shared instance can sit on
// a submission for a while before it even starts running.
const BATCH_DEADLINE_MS = 90_000;

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const unb64 = (s: string | null | undefined) => (s ? Buffer.from(s, 'base64').toString('utf8') : '');
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const unavailable = () => new AppError('Code execution service is currently unavailable — please try again shortly.', 503, 'CODE_EXECUTION_UNAVAILABLE');

/** Runs the same code once per stdin as one Judge0 batch: a single submit, then polling until
 *  every run is final. Far fewer round-trips than one blocking `?wait=true` call per test case,
 *  and no per-request timeout to trip while a busy instance is still queueing. Everything is
 *  base64 in both directions, so non-UTF-8 output can't make Judge0 reject the result.
 *  Throws only on a genuine transport/HTTP failure or the overall deadline — a compile error or
 *  wrong answer is a normal result, since the caller needs to display it either way. */
export async function runBatchOnJudge0({ code, language, stdins, timeoutSeconds = 5 }: Judge0BatchOptions): Promise<Judge0RunResult[]> {
  if (!isJudge0Configured()) {
    throw new Error('Judge0 is not configured (missing JUDGE0_API_URL)');
  }
  if (stdins.length === 0) return [];

  try {
    const { data: created } = await axios.post<Array<{ token?: string; error?: string }>>(
      `${env.JUDGE0_API_URL}/submissions/batch`,
      {
        submissions: stdins.map((stdin) => ({
          source_code: b64(code),
          language_id: LANGUAGE_IDS[language],
          stdin: b64(stdin),
          cpu_time_limit: timeoutSeconds,
        })),
      },
      { params: { base64_encoded: 'true' }, headers: judge0Headers(), timeout: 20_000 }
    );
    const tokens = created.map((c) => c.token);
    if (tokens.some((t) => !t)) throw new Error(`Judge0 rejected a submission: ${JSON.stringify(created)}`);

    const deadline = Date.now() + BATCH_DEADLINE_MS;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      const { data } = await axios.get<{ submissions: Array<{ stdout?: string; stderr?: string; compile_output?: string; time?: string; status?: { id: number; description: string } }> }>(
        `${env.JUDGE0_API_URL}/submissions/batch`,
        {
          params: { tokens: tokens.join(','), base64_encoded: 'true', fields: 'stdout,stderr,compile_output,status,time' },
          headers: judge0Headers(),
          timeout: 20_000,
        }
      );
      const subs = data.submissions;
      if (subs.length === tokens.length && subs.every((sub) => isFinal(sub.status?.id ?? 0))) {
        return subs.map((sub) => ({
          stdout: unb64(sub.stdout),
          stderr: unb64(sub.stderr),
          compileOutput: unb64(sub.compile_output),
          status: sub.status?.description ?? 'Unknown',
          statusId: sub.status?.id ?? 0,
          time: sub.time ?? undefined,
        }));
      }
    }
    logger.error('Judge0 batch timed out', { tokens });
    throw unavailable();
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error('Judge0 request failed', { error: err instanceof Error ? err.message : err });
    throw unavailable();
  }
}

/** A single run — a batch of one. */
export async function runOnJudge0(opts: { code: string; language: CodingLanguage; stdin: string; timeoutSeconds?: number }): Promise<Judge0RunResult> {
  const [result] = await runBatchOnJudge0({ code: opts.code, language: opts.language, stdins: [opts.stdin], timeoutSeconds: opts.timeoutSeconds });
  return result;
}
