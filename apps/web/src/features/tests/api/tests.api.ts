import { apiClient, extractErrorMessage } from '@/services/api';
import type {
  ApiResponse,
  Test,
  CreateTestPayload,
  GenerateTestDraftPayload,
  ReviewTestPayload,
  TestAssignment,
  TestAssignmentWithTest,
  CreateAssignmentPayload,
  TestForCandidate,
  StartTestAttemptResult,
  StartTestPayload,
  SendAccessCodePayload,
  TestAttempt,
  SubmitAnswerPayload,
  LogViolationPayload,
  LogViolationResult,
  TestAttemptReview,
  RunCodePayload,
  RunCodeResult,
  SubmitCodePayload,
  SubmitCodeResult,
  MarkViewedPayload,
  TestResultAnalysis,
  TestMonitor,
  TestHeartbeatResult,
} from '@placementos/types';

const BASE = '/tests';
// Run / Submit code / final submit wait on Judge0, which can queue on a busy instance — the
// server allows up to 90s per batch, so the client must outwait that.
const JUDGE_TIMEOUT_MS = 150_000;

// The candidate's per-tab test session id — sent on every attempt call so the server can hold
// the one-session-per-attempt lock (see setAttemptSession / TestTakingPage).
let attemptSession = '';
export const setAttemptSession = (id: string) => { attemptSession = id; };

// The candidate's public IP as the internet sees it. Behind localhost, a campus LAN or a dev proxy
// the server only sees a private/loopback address (e.g. `::1`), so the browser looks up its own
// and sends it along — the server prefers a real public socket address whenever it has one.
let clientIp = '';
let clientIpLookup: Promise<string> | null = null;
export function lookupClientIp(): Promise<string> {
  clientIpLookup ??= fetch('https://api64.ipify.org?format=json', { signal: AbortSignal.timeout(4000) })
    .then((r) => r.json() as Promise<{ ip?: string }>)
    .then((d) => (clientIp = d.ip ?? ''))
    .catch(() => fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(4000) }).then((r) => r.json() as Promise<{ ip?: string }>).then((d) => (clientIp = d.ip ?? '')))
    .catch(() => '');
  return clientIpLookup;
}

const sessionCfg = (extra: { timeout?: number } = {}) => ({
  ...extra,
  headers: { 'X-Attempt-Session': attemptSession, ...(clientIp ? { 'X-Client-Ip': clientIp } : {}) },
});

export const testsApi = {
  // ── Faculty / TPO ──────────────────────────────────────────────────────────
  async create(payload: CreateTestPayload): Promise<Test> {
    try {
      const res = await apiClient.post<ApiResponse<Test>>(BASE, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  /** The ready-made 10 MCQ + 5 coding assessment, to prefill the builder with. */
  async getSampleTemplate(): Promise<CreateTestPayload> {
    try {
      const res = await apiClient.get<ApiResponse<CreateTestPayload>>(`${BASE}/templates/sample`);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async list(): Promise<Test[]> {
    try {
      const res = await apiClient.get<ApiResponse<Test[]>>(BASE);
      return res.data.data ?? [];
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async generateDraft(payload: GenerateTestDraftPayload): Promise<Test> {
    try {
      const res = await apiClient.post<ApiResponse<Test>>(`${BASE}/generate-draft`, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async setMediaRequirements(id: string, payload: { requireCamera?: boolean; requireScreenShare?: boolean }): Promise<Test> {
    try {
      const res = await apiClient.patch<ApiResponse<Test>>(`${BASE}/${id}/media-requirements`, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async update(id: string, payload: Partial<CreateTestPayload>): Promise<Test> {
    try {
      const res = await apiClient.patch<ApiResponse<Test>>(`${BASE}/${id}`, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async submitForApproval(id: string): Promise<Test> {
    try {
      const res = await apiClient.patch<ApiResponse<Test>>(`${BASE}/${id}/submit-for-approval`);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async review(id: string, payload: ReviewTestPayload): Promise<Test> {
    try {
      const res = await apiClient.patch<ApiResponse<Test>>(`${BASE}/${id}/review`, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async createAssignment(testId: string, payload: CreateAssignmentPayload): Promise<TestAssignment> {
    try {
      const res = await apiClient.post<ApiResponse<TestAssignment>>(`${BASE}/${testId}/assignments`, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async listAssignments(testId: string): Promise<TestAssignment[]> {
    try {
      const res = await apiClient.get<ApiResponse<TestAssignment[]>>(`${BASE}/${testId}/assignments`);
      return res.data.data ?? [];
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async listAllAssignments(): Promise<TestAssignmentWithTest[]> {
    try {
      const res = await apiClient.get<ApiResponse<TestAssignmentWithTest[]>>(`${BASE}/assignments`);
      return res.data.data ?? [];
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async sendAssignmentAccessCode(assignmentId: string, payload: SendAccessCodePayload): Promise<{ sentCount: number }> {
    try {
      const res = await apiClient.post<ApiResponse<{ sentCount: number }>>(`${BASE}/assignments/${assignmentId}/send-access-code`, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async closeAssignment(assignmentId: string): Promise<TestAssignment> {
    try {
      const res = await apiClient.patch<ApiResponse<TestAssignment>>(`${BASE}/assignments/${assignmentId}/close`);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async remove(id: string): Promise<void> {
    try {
      await apiClient.delete(`${BASE}/${id}`);
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async getReview(id: string): Promise<TestAttemptReview[]> {
    try {
      const res = await apiClient.get<ApiResponse<TestAttemptReview[]>>(`${BASE}/${id}/review`);
      return res.data.data ?? [];
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async getResultAnalysis(testId: string, attemptId: string): Promise<TestResultAnalysis> {
    try {
      const res = await apiClient.get<ApiResponse<TestResultAnalysis>>(`${BASE}/${testId}/attempts/${attemptId}/analysis`);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  // ── Candidate ────────────────────────────────────────────────────────────
  async listMine(): Promise<TestForCandidate[]> {
    try {
      const res = await apiClient.get<ApiResponse<TestForCandidate[]>>(`${BASE}/mine`);
      return res.data.data ?? [];
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async getMyResult(assignmentId: string): Promise<TestResultAnalysis> {
    try {
      const res = await apiClient.get<ApiResponse<TestResultAnalysis>>(`${BASE}/assignments/${assignmentId}/my-result`);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async start(assignmentId: string, payload: StartTestPayload): Promise<StartTestAttemptResult> {
    try {
      const res = await apiClient.post<ApiResponse<StartTestAttemptResult>>(`${BASE}/assignments/${assignmentId}/start`, payload, sessionCfg());
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async submitAnswer(attemptId: string, payload: SubmitAnswerPayload): Promise<TestAttempt> {
    try {
      const res = await apiClient.post<ApiResponse<TestAttempt>>(`${BASE}/attempts/${attemptId}/answers`, payload, sessionCfg());
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async logViolation(attemptId: string, payload: LogViolationPayload): Promise<LogViolationResult> {
    try {
      const res = await apiClient.post<ApiResponse<LogViolationResult>>(`${BASE}/attempts/${attemptId}/violations`, payload, sessionCfg());
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async submit(attemptId: string): Promise<TestAttempt> {
    try {
      const res = await apiClient.post<ApiResponse<TestAttempt>>(`${BASE}/attempts/${attemptId}/submit`, undefined, sessionCfg({ timeout: JUDGE_TIMEOUT_MS }));
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async runCode(attemptId: string, questionIndex: number, payload: RunCodePayload): Promise<RunCodeResult> {
    try {
      const res = await apiClient.post<ApiResponse<RunCodeResult>>(`${BASE}/attempts/${attemptId}/run`, { questionIndex, ...payload }, sessionCfg({ timeout: JUDGE_TIMEOUT_MS }));
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async submitCode(attemptId: string, questionIndex: number, payload: SubmitCodePayload): Promise<SubmitCodeResult> {
    try {
      const res = await apiClient.post<ApiResponse<SubmitCodeResult>>(`${BASE}/attempts/${attemptId}/submit-code`, { questionIndex, ...payload }, sessionCfg({ timeout: JUDGE_TIMEOUT_MS }));
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async markViewed(attemptId: string, payload: MarkViewedPayload): Promise<void> {
    try {
      await apiClient.post(`${BASE}/attempts/${attemptId}/viewed`, payload, sessionCfg());
    } catch {
      // Best-effort telemetry — a failed call here shouldn't disrupt the candidate's attempt.
    }
  },

  /** Throws the raw axios error (not a re-wrapped Error) so the caller can read the status —
   *  a 409 means another window/device has taken over this attempt. */
  async heartbeat(attemptId: string): Promise<TestHeartbeatResult> {
    const res = await apiClient.post<ApiResponse<TestHeartbeatResult>>(`${BASE}/attempts/${attemptId}/heartbeat`, undefined, sessionCfg());
    return res.data.data!;
  },

  // ── Staff: live monitor ──────────────────────────────────────────────────
  async getMonitor(testId: string): Promise<TestMonitor> {
    try {
      const res = await apiClient.get<ApiResponse<TestMonitor>>(`${BASE}/${testId}/monitor`);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async allowNewDevice(attemptId: string): Promise<void> {
    try {
      await apiClient.post(`${BASE}/attempts/${attemptId}/allow-new-device`);
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async forceSubmit(attemptId: string): Promise<void> {
    try {
      await apiClient.post(`${BASE}/attempts/${attemptId}/force-submit`);
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },
};
