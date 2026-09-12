import { apiClient, extractErrorMessage } from '@/services/api';
import type { ApiResponse, PaginatedResponse, Candidate, CreateCandidateLoginPayload } from '@placementos/types';

const BASE = '/candidates';

export interface CandidateListOptions {
  page?: number;
  limit?: number;
  search?: string;
  batch?: string;
  department?: string;
  placementYear?: string;
  status?: Candidate['status'];
}

export interface CreateCandidatePayload {
  fullName: string;
  rollNumber: string;
  batch: string;
  department: string;
  email?: string;
  phone?: string;
  placementYear: string;
  status?: Candidate['status'];
}

export const candidatesApi = {
  async list(opts: CandidateListOptions = {}): Promise<PaginatedResponse<Candidate>> {
    try {
      const res = await apiClient.get<PaginatedResponse<Candidate>>(BASE, { params: opts });
      return res.data;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async listByBatch(batch: string, track?: string): Promise<Candidate[]> {
    try {
      const res = await apiClient.get<PaginatedResponse<Candidate>>(BASE, { params: { batch, track, status: 'active', limit: 300 } });
      return res.data.data ?? [];
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async create(payload: CreateCandidatePayload): Promise<Candidate> {
    try {
      const res = await apiClient.post<ApiResponse<Candidate>>(BASE, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async update(id: string, payload: Partial<CreateCandidatePayload>): Promise<Candidate> {
    try {
      const res = await apiClient.patch<ApiResponse<Candidate>>(`${BASE}/${id}`, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async remove(id: string): Promise<void> {
    try {
      await apiClient.delete(`${BASE}/${id}`);
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async createLogin(id: string, payload: CreateCandidateLoginPayload): Promise<{ email: string }> {
    try {
      const res = await apiClient.post<ApiResponse<{ email: string }>>(`${BASE}/${id}/login`, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },
};
