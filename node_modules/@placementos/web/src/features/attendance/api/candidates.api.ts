import { apiClient, extractErrorMessage } from '@/services/api';
import type { Candidate, PaginatedResponse } from '@placementos/types';

/**
 * Minimal candidate lookup used only by the attendance feature to build a
 * batch roster to mark. There is no dedicated `candidates` feature folder in
 * this task's scope yet — this hits a best-guess `/candidates` endpoint
 * (not yet in MAPPING.md's route table). TODO: replace with the real
 * candidates API client once a `features/candidates` folder exists, and
 * confirm the actual route/query params with the backend.
 */
export const candidatesApi = {
  listByBatch: async (batch: string, track?: string): Promise<Candidate[]> => {
    try {
      const res = await apiClient.get<PaginatedResponse<Candidate>>('/candidates', {
        params: { batch, track, status: 'active', limit: 300 },
      });
      return res.data.data ?? [];
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },
};
