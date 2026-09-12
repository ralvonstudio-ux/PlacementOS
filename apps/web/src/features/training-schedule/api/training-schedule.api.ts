import { apiClient, extractErrorMessage } from '@/services/api';
import type { ApiResponse, TrainingScheduleEntry, PaginatedResponse } from '@placementos/types';

const BASE = '/training-schedule';

export interface TrainingScheduleListOptions {
  batch?: string;
  track?: string;
  facultyId?: string;
  dayOfWeek?: number;
  placementYear?: string;
  page?: number;
  limit?: number;
}

export const trainingScheduleApi = {
  /** With no facultyId, the server auto-scopes to the calling faculty member's own schedule. */
  async list(opts: TrainingScheduleListOptions = {}): Promise<TrainingScheduleEntry[]> {
    try {
      const res = await apiClient.get<PaginatedResponse<TrainingScheduleEntry>>(BASE, { params: { limit: 200, ...opts } });
      return res.data.data ?? [];
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  },

  async create(payload: Omit<TrainingScheduleEntry, '_id' | 'instituteId' | 'createdAt' | 'updatedAt'>): Promise<TrainingScheduleEntry> {
    try {
      const res = await apiClient.post<ApiResponse<TrainingScheduleEntry>>(BASE, payload);
      return res.data.data!;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  },

  async remove(id: string): Promise<void> {
    try {
      await apiClient.delete(`${BASE}/${id}`);
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  },
};
