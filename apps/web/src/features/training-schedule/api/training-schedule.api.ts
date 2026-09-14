import { apiClient, extractErrorMessage } from '@/services/api';
import type {
  ApiResponse,
  TrainingScheduleEntry,
  PaginatedResponse,
  PeriodSlot,
  CreatePeriodSlotPayload,
  UpdatePeriodSlotPayload,
  ConflictInfo,
  MasterGridQuery,
  MasterGridResponse,
  SetMasterGridCellPayload,
  TimetableSubstitute,
  CreateSubstitutePayload,
  UpdateSubstitutePayload,
  NeedsSubstituteEntry,
  SubstituteSuggestion,
} from '@placementos/types';

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

  async update(id: string, payload: Partial<Omit<TrainingScheduleEntry, '_id' | 'instituteId' | 'createdAt' | 'updatedAt'>>): Promise<TrainingScheduleEntry> {
    try {
      const res = await apiClient.patch<ApiResponse<TrainingScheduleEntry>>(`${BASE}/${id}`, payload);
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

  // ── Period slots (bell schedule) ──────────────────────────────────────────
  async listPeriods(): Promise<PeriodSlot[]> {
    try {
      const res = await apiClient.get<ApiResponse<PeriodSlot[]>>(`${BASE}/periods`);
      return res.data.data ?? [];
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async createPeriod(payload: CreatePeriodSlotPayload): Promise<PeriodSlot> {
    try {
      const res = await apiClient.post<ApiResponse<PeriodSlot>>(`${BASE}/periods`, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async updatePeriod(id: string, payload: UpdatePeriodSlotPayload): Promise<PeriodSlot> {
    try {
      const res = await apiClient.patch<ApiResponse<PeriodSlot>>(`${BASE}/periods/${id}`, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async deletePeriod(id: string): Promise<void> {
    try {
      await apiClient.delete(`${BASE}/periods/${id}`);
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async reorderPeriods(orderedIds: string[]): Promise<void> {
    try {
      await apiClient.patch(`${BASE}/periods/reorder`, { orderedIds });
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  // ── Conflicts & master grid ─────────────────────────────────────────────────
  async getConflicts(placementYear: string): Promise<ConflictInfo[]> {
    try {
      const res = await apiClient.get<ApiResponse<ConflictInfo[]>>(`${BASE}/conflicts`, { params: { placementYear } });
      return res.data.data ?? [];
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async getMasterGrid(query: MasterGridQuery): Promise<MasterGridResponse> {
    try {
      const res = await apiClient.get<ApiResponse<MasterGridResponse>>(`${BASE}/master-grid`, { params: query });
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async setMasterGridCell(payload: SetMasterGridCellPayload): Promise<TrainingScheduleEntry> {
    try {
      const res = await apiClient.patch<ApiResponse<TrainingScheduleEntry>>(`${BASE}/master-grid/cell`, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  // ── Substitutes ────────────────────────────────────────────────────────────
  async listSubstitutes(opts: { date?: string; status?: string; facultyId?: string } = {}): Promise<TimetableSubstitute[]> {
    try {
      const res = await apiClient.get<PaginatedResponse<TimetableSubstitute>>(`${BASE}/substitutes`, { params: { limit: 200, ...opts } });
      return res.data.data ?? [];
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async createSubstitute(payload: CreateSubstitutePayload): Promise<TimetableSubstitute> {
    try {
      const res = await apiClient.post<ApiResponse<TimetableSubstitute>>(`${BASE}/substitutes`, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async updateSubstitute(id: string, payload: UpdateSubstitutePayload): Promise<TimetableSubstitute> {
    try {
      const res = await apiClient.patch<ApiResponse<TimetableSubstitute>>(`${BASE}/substitutes/${id}`, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async removeSubstitute(id: string): Promise<void> {
    try {
      await apiClient.delete(`${BASE}/substitutes/${id}`);
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async getNeedsSubstitute(date: string): Promise<NeedsSubstituteEntry[]> {
    try {
      const res = await apiClient.get<ApiResponse<NeedsSubstituteEntry[]>>(`${BASE}/substitutes/needed`, { params: { date } });
      return res.data.data ?? [];
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async suggestSubstituteTeachers(track: string, dayOfWeek: number, excludeFacultyId?: string): Promise<SubstituteSuggestion[]> {
    try {
      const res = await apiClient.get<ApiResponse<SubstituteSuggestion[]>>(`${BASE}/substitutes/suggest-teachers`, {
        params: { track, dayOfWeek, excludeFacultyId },
      });
      return res.data.data ?? [];
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },
};
