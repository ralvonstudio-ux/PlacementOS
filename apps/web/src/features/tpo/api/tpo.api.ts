import { apiClient, extractErrorMessage } from '@/services/api';
import type {
  ApiResponse,
  TpoDashboardData,
  TpoFacultySummaryData,
  TpoBriefingSummary,
  TpoAttendanceInsight,
  Faculty,
} from '@placementos/types';

export const tpoApi = {
  async getDashboard(): Promise<TpoDashboardData> {
    try {
      const res = await apiClient.get<ApiResponse<TpoDashboardData>>('/tpo/dashboard');
      return res.data.data!;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  },

  async getFacultySummary(date?: string): Promise<TpoFacultySummaryData> {
    try {
      const res = await apiClient.get<ApiResponse<TpoFacultySummaryData>>('/tpo/faculty-summary', {
        params: date ? { date } : {},
      });
      return res.data.data!;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  },

  async getBriefingSummary(): Promise<TpoBriefingSummary> {
    try {
      const res = await apiClient.post<ApiResponse<TpoBriefingSummary>>('/tpo/briefing-summary');
      return res.data.data!;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  },

  /** Lowest-attendance batch/track pairs, lowest-first — backs AttendanceInsightsCard. */
  async getAttendanceInsights(): Promise<TpoAttendanceInsight[]> {
    try {
      const res = await apiClient.get<ApiResponse<TpoAttendanceInsight[]>>('/tpo/attendance-insights');
      return res.data.data ?? [];
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  },

  // ── Faculty directory (read-only for TPO — the faculty-workspace feature
  //    owns write access to a faculty's own record) ───────────────────────
  async getFacultyList(search?: string): Promise<Faculty[]> {
    try {
      const res = await apiClient.get<ApiResponse<Faculty[]>>('/faculty', {
        params: search ? { search } : {},
      });
      return res.data.data ?? [];
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  },

  async getFacultyById(id: string): Promise<Faculty> {
    try {
      const res = await apiClient.get<ApiResponse<Faculty>>(`/faculty/${id}`);
      return res.data.data!;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  },
};
