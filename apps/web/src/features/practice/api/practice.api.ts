import { apiClient, extractErrorMessage } from '@/services/api';
import type {
  ApiResponse,
  PaginatedResponse,
  PracticeQuestion,
  CreatePracticeQuestionPayload,
  UpdatePracticeQuestionPayload,
  PracticeQuestionListOptions,
  PracticeSheet,
  CreatePracticeSheetPayload,
} from '@placementos/types';

const BASE = '/practice';

export const practiceApi = {
  async listQuestions(opts: PracticeQuestionListOptions = {}): Promise<PaginatedResponse<PracticeQuestion>> {
    try {
      const res = await apiClient.get<PaginatedResponse<PracticeQuestion>>(`${BASE}/questions`, { params: opts });
      return res.data;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async listCompanies(): Promise<string[]> {
    try {
      const res = await apiClient.get<ApiResponse<{ companies: string[] }>>(`${BASE}/companies`);
      return res.data.data?.companies ?? [];
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async createQuestion(payload: CreatePracticeQuestionPayload): Promise<PracticeQuestion> {
    try {
      const res = await apiClient.post<ApiResponse<PracticeQuestion>>(`${BASE}/questions`, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async updateQuestion(id: string, payload: UpdatePracticeQuestionPayload): Promise<PracticeQuestion> {
    try {
      const res = await apiClient.patch<ApiResponse<PracticeQuestion>>(`${BASE}/questions/${id}`, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async deleteQuestion(id: string): Promise<void> {
    try {
      await apiClient.delete(`${BASE}/questions/${id}`);
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async createSheet(payload: CreatePracticeSheetPayload): Promise<PracticeSheet> {
    try {
      const res = await apiClient.post<ApiResponse<PracticeSheet>>(`${BASE}/sheets`, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async listSheets(): Promise<PracticeSheet[]> {
    try {
      const res = await apiClient.get<ApiResponse<PracticeSheet[]>>(`${BASE}/sheets`);
      return res.data.data ?? [];
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async deleteSheet(id: string): Promise<void> {
    try {
      await apiClient.delete(`${BASE}/sheets/${id}`);
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async listMySheets(): Promise<PracticeSheet[]> {
    try {
      const res = await apiClient.get<ApiResponse<PracticeSheet[]>>(`${BASE}/my-sheets`);
      return res.data.data ?? [];
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async getMySheetQuestions(sheetId: string): Promise<PracticeQuestion[]> {
    try {
      const res = await apiClient.get<ApiResponse<PracticeQuestion[]>>(`${BASE}/my-sheets/${sheetId}/questions`);
      return res.data.data ?? [];
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },
};
