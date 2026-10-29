import { env } from '../config/env';
import { isJudge0Configured, runBatchOnJudge0 } from './judge0';
import { isOnlineCompilerConfigured, runBatchOnOnlineCompiler } from './onlinecompiler';
import type { CodingLanguage } from '../features/tests/test.model';

// The one entry point test.service uses to compile/run candidate code. Two backends share the
// same contract — OnlineCompiler.io (hosted, current compilers) and Judge0 (RapidAPI, public or
// self-hosted). CODE_RUNNER picks one explicitly; left unset, OnlineCompiler wins whenever its
// key is present, otherwise Judge0, otherwise execution is "not configured".

export interface CodeRunBatchOptions {
  code: string;
  language: CodingLanguage;
  /** One run per entry, each fed this stdin. */
  stdins: string[];
  /** CPU time limit per run, in seconds. */
  timeoutSeconds?: number;
}

export interface CodeRunResult {
  stdout: string;
  stderr: string;
  /** Populated only for a compile-time failure (statusId 6). */
  compileOutput: string;
  /** Human-readable status, e.g. "Accepted", "Runtime Error", "Time Limit Exceeded". */
  status: string;
  /** Judge0-style status id: 3 = ran to completion, 6 = compile error, > 3 = failed run. */
  statusId: number;
  /** Run time in seconds, as the backend reports it. */
  time?: string;
}

export type CodeRunnerName = 'onlinecompiler' | 'judge0';

export function activeCodeRunner(): CodeRunnerName | null {
  if (env.CODE_RUNNER === 'onlinecompiler') return isOnlineCompilerConfigured() ? 'onlinecompiler' : null;
  if (env.CODE_RUNNER === 'judge0') return isJudge0Configured() ? 'judge0' : null;
  if (isOnlineCompilerConfigured()) return 'onlinecompiler';
  if (isJudge0Configured()) return 'judge0';
  return null;
}

export const isCodeRunnerConfigured = () => activeCodeRunner() !== null;

export function runCodeBatch(opts: CodeRunBatchOptions): Promise<CodeRunResult[]> {
  const runner = activeCodeRunner();
  if (runner === 'onlinecompiler') return runBatchOnOnlineCompiler(opts);
  if (runner === 'judge0') return runBatchOnJudge0(opts);
  throw new Error('No code runner is configured (set ONLINECOMPILER_API_KEY or JUDGE0_API_URL)');
}
