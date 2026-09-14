import axios from 'axios';
import { env } from '../config/env';
import { logger } from './logger';
import type { CodingLanguage } from '../features/tests/test.model';

// Judge0 (https://judge0.com) — used to actually compile/run a candidate's submitted code
// against test-case input/output for coding-type questions. We call the CE (Community Edition)
// REST API, most commonly reached via RapidAPI (JUDGE0_API_URL/JUDGE0_API_KEY/JUDGE0_API_HOST).
// Both keys are optional (see env.ts) — every function here degrades to `configured: false`
// rather than throwing, so the app boots and the rest of the test still works without a key.

// Judge0's language_id for each language's latest stable runtime as of writing. If Judge0 adds
// a newer id for one of these later, bump it here — nothing else needs to change.
const LANGUAGE_IDS: Record<CodingLanguage, number> = {
  python: 71, // Python 3.8.1
  java: 62, // OpenJDK 13.0.1
  c: 50, // GCC 9.2.0
  cpp: 54, // GCC 9.2.0 (C++17)
};

export interface Judge0RunOptions {
  code: string;
  language: CodingLanguage;
  stdin: string;
  /** Wall-clock timeout per run, in seconds. */
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
}

export function isJudge0Configured(): boolean {
  return Boolean(env.JUDGE0_API_URL && env.JUDGE0_API_KEY);
}

/** Submits one run and waits (via Judge0's synchronous `?wait=true`) for the result. Throws only
 *  on a genuine transport/HTTP failure — a compile error or wrong-answer is a normal result, not
 *  a thrown error, since the caller needs to display it either way. */
export async function runOnJudge0({ code, language, stdin, timeoutSeconds = 5 }: Judge0RunOptions): Promise<Judge0RunResult> {
  if (!isJudge0Configured()) {
    throw new Error('Judge0 is not configured (missing JUDGE0_API_URL / JUDGE0_API_KEY)');
  }

  try {
    const { data } = await axios.post(
      `${env.JUDGE0_API_URL}/submissions`,
      {
        source_code: code,
        language_id: LANGUAGE_IDS[language],
        stdin,
        cpu_time_limit: timeoutSeconds,
      },
      {
        params: { base64_encoded: 'false', wait: 'true' },
        headers: {
          'content-type': 'application/json',
          'X-RapidAPI-Key': env.JUDGE0_API_KEY,
          'X-RapidAPI-Host': env.JUDGE0_API_HOST,
        },
        timeout: (timeoutSeconds + 10) * 1000,
      }
    );

    return {
      stdout: data.stdout ?? '',
      stderr: data.stderr ?? '',
      compileOutput: data.compile_output ?? '',
      status: data.status?.description ?? 'Unknown',
      statusId: data.status?.id ?? 0,
    };
  } catch (err) {
    logger.error('Judge0 request failed', { error: err instanceof Error ? err.message : err });
    throw new Error('Code execution service is currently unavailable — please try again shortly.');
  }
}
