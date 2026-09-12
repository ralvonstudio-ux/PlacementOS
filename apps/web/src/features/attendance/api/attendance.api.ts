import { apiClient, extractErrorMessage } from '@/services/api';
import type {
  AttendanceRecord,
  AttendanceSummary,
  MarkAttendancePayload,
  BulkAttendancePayload,
  UpdateAttendancePayload,
  AttendanceListOptions,
  CandidateHistoryOptions,
  AttendanceSummaryOptions,
  PaginatedResponse,
  BatchAttendanceOverview,
  FacultyAttendanceOverview,
} from '@placementos/types';

const BASE = '/attendance';

export const attendanceApi = {
  markSingle: async (payload: MarkAttendancePayload): Promise<AttendanceRecord> => {
    try {
      const res = await apiClient.post<{ data: AttendanceRecord }>(BASE, payload);
      return res.data.data;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  bulkMark: async (payload: BulkAttendancePayload): Promise<AttendanceRecord[]> => {
    try {
      const res = await apiClient.post<{ data: AttendanceRecord[] }>(`${BASE}/bulk`, payload);
      return res.data.data;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  list: async (opts: AttendanceListOptions = {}): Promise<PaginatedResponse<AttendanceRecord>> => {
    try {
      const res = await apiClient.get<PaginatedResponse<AttendanceRecord>>(BASE, { params: opts });
      return res.data;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  getById: async (id: string): Promise<AttendanceRecord> => {
    try {
      const res = await apiClient.get<{ data: AttendanceRecord }>(`${BASE}/${id}`);
      return res.data.data;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  update: async (id: string, payload: UpdateAttendancePayload): Promise<AttendanceRecord> => {
    try {
      const res = await apiClient.patch<{ data: AttendanceRecord }>(`${BASE}/${id}`, payload);
      return res.data.data;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  deleteRecord: async (id: string): Promise<void> => {
    try {
      await apiClient.delete(`${BASE}/${id}`);
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  getBatchAttendance: async (batch: string, track: string, date?: string): Promise<AttendanceRecord[]> => {
    try {
      const res = await apiClient.get<{ data: AttendanceRecord[] }>(
        `${BASE}/batch/${encodeURIComponent(batch)}/${encodeURIComponent(track)}`,
        { params: date ? { date } : {} },
      );
      return res.data.data;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  getCandidateHistory: async (
    candidateId: string,
    opts: CandidateHistoryOptions = {},
  ): Promise<PaginatedResponse<AttendanceRecord>> => {
    try {
      const res = await apiClient.get<PaginatedResponse<AttendanceRecord>>(
        `${BASE}/candidate/${candidateId}`,
        { params: opts },
      );
      return res.data;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  getSummary: async (opts: AttendanceSummaryOptions = {}): Promise<AttendanceSummary> => {
    try {
      const res = await apiClient.get<{ data: AttendanceSummary }>(`${BASE}/summary`, { params: opts });
      return res.data.data;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  getBatchOverview: async (date?: string): Promise<BatchAttendanceOverview> => {
    try {
      const res = await apiClient.get<{ data: BatchAttendanceOverview }>(
        `${BASE}/batch-overview`, { params: date ? { date } : {} },
      );
      return res.data.data;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  getFacultyOverview: async (date?: string): Promise<FacultyAttendanceOverview> => {
    try {
      const res = await apiClient.get<{ data: FacultyAttendanceOverview }>(
        `${BASE}/faculty-overview`, { params: date ? { date } : {} },
      );
      return res.data.data;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },
};
