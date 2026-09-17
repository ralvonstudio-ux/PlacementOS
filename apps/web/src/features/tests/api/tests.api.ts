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
} from '@placementos/types';

const BASE = '/tests';

export const testsApi = {
  // ── Faculty / TPO ──────────────────────────────────────────────────────────
  async create(payload: CreateTestPayload): Promise<Test> {
    try {
      const res = await apiClient.post<ApiResponse<Test>>(BASE, payload);
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

  // ── Candidate ────────────────────────────────────────────────────────────
  async listMine(): Promise<TestForCandidate[]> {
    try {
      const res = await apiClient.get<ApiResponse<TestForCandidate[]>>(`${BASE}/mine`);
      return res.data.data ?? [];
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async start(assignmentId: string, payload: StartTestPayload): Promise<StartTestAttemptResult> {
    try {
      const res = await apiClient.post<ApiResponse<StartTestAttemptResult>>(`${BASE}/assignments/${assignmentId}/start`, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async submitAnswer(attemptId: string, payload: SubmitAnswerPayload): Promise<TestAttempt> {
    try {
      const res = await apiClient.post<ApiResponse<TestAttempt>>(`${BASE}/attempts/${attemptId}/answers`, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async logViolation(attemptId: string, payload: LogViolationPayload): Promise<LogViolationResult> {
    try {
      const res = await apiClient.post<ApiResponse<LogViolationResult>>(`${BASE}/attempts/${attemptId}/violations`, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async submit(attemptId: string): Promise<TestAttempt> {
    try {
      const res = await apiClient.post<ApiResponse<TestAttempt>>(`${BASE}/attempts/${attemptId}/submit`);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async runCode(attemptId: string, questionIndex: number, payload: RunCodePayload): Promise<RunCodeResult> {
    try {
      const res = await apiClient.post<ApiResponse<RunCodeResult>>(`${BASE}/attempts/${attemptId}/run`, { questionIndex, ...payload });
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },
};
