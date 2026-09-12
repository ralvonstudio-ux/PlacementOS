import { apiClient, extractErrorMessage } from '@/services/api';
import type { ApiResponse, CandidateProfile, SaveCandidateProfilePayload, LeetCodeStats } from '@placementos/types';

const BASE = '/candidate-profile';

export const candidateProfileApi = {
  async getMine(): Promise<CandidateProfile | null> {
    try {
      const res = await apiClient.get<ApiResponse<CandidateProfile | null>>(`${BASE}/me`);
      return res.data.data ?? null;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async saveMine(payload: SaveCandidateProfilePayload): Promise<CandidateProfile> {
    try {
      const res = await apiClient.put<ApiResponse<CandidateProfile>>(`${BASE}/me`, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async uploadResume(file: File): Promise<CandidateProfile> {
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await apiClient.post<ApiResponse<CandidateProfile>>(`${BASE}/me/resume`, form);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async getMyLeetCodeStats(): Promise<LeetCodeStats> {
    try {
      const res = await apiClient.get<ApiResponse<LeetCodeStats>>(`${BASE}/me/leetcode`);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },
};
