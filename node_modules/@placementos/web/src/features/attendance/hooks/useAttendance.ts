import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { attendanceApi } from '../api/attendance.api';
import type {
  AttendanceListOptions,
  CandidateHistoryOptions,
  AttendanceSummaryOptions,
  MarkAttendancePayload,
  BulkAttendancePayload,
  UpdateAttendancePayload,
} from '@placementos/types';

// ── Query keys ────────────────────────────────────────────────────────────────

export const attendanceKeys = {
  all:              ['attendance']                        as const,
  lists:            ()  => [...attendanceKeys.all, 'list']      as const,
  list:             (o: AttendanceListOptions) => [...attendanceKeys.lists(), o] as const,
  detail:           (id: string) => [...attendanceKeys.all, 'detail', id] as const,
  batchDate:        (batch: string, track: string, date?: string) =>
                      [...attendanceKeys.all, 'batch', batch, track, date ?? 'today'] as const,
  candidateHistory: (id: string, o: CandidateHistoryOptions) =>
                      [...attendanceKeys.all, 'candidate', id, o] as const,
  summary:          (o: AttendanceSummaryOptions) => [...attendanceKeys.all, 'summary', o] as const,
  batchOverview:    (date?: string) => [...attendanceKeys.all, 'batch-overview', date ?? 'today'] as const,
  facultyOverview:  (date?: string) => [...attendanceKeys.all, 'faculty-overview', date ?? 'today'] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────────

export const useAttendanceList = (opts: AttendanceListOptions = {}) =>
  useQuery({
    queryKey: attendanceKeys.list(opts),
    queryFn:  () => attendanceApi.list(opts),
    placeholderData: keepPreviousData,
  });

export const useAttendance = (id: string) =>
  useQuery({
    queryKey: attendanceKeys.detail(id),
    queryFn:  () => attendanceApi.getById(id),
    enabled:  !!id,
  });

export const useBatchAttendance = (batch: string, track: string, date?: string) =>
  useQuery({
    queryKey: attendanceKeys.batchDate(batch, track, date),
    queryFn:  () => attendanceApi.getBatchAttendance(batch, track, date),
    enabled:  !!batch && !!track,
  });

export const useCandidateAttendanceHistory = (candidateId: string, opts: CandidateHistoryOptions = {}) =>
  useQuery({
    queryKey: attendanceKeys.candidateHistory(candidateId, opts),
    queryFn:  () => attendanceApi.getCandidateHistory(candidateId, opts),
    enabled:  !!candidateId,
    placeholderData: keepPreviousData,
  });

export const useAttendanceSummary = (opts: AttendanceSummaryOptions = {}, enabled = true) =>
  useQuery({
    queryKey: attendanceKeys.summary(opts),
    queryFn:  () => attendanceApi.getSummary(opts),
    enabled,
  });

export const useBatchAttendanceOverview = (date?: string) =>
  useQuery({
    queryKey: attendanceKeys.batchOverview(date),
    queryFn:  () => attendanceApi.getBatchOverview(date),
    placeholderData: keepPreviousData,
  });

export const useFacultyAttendanceOverview = (date?: string) =>
  useQuery({
    queryKey: attendanceKeys.facultyOverview(date),
    queryFn:  () => attendanceApi.getFacultyOverview(date),
    placeholderData: keepPreviousData,
  });

// ── Mutations ─────────────────────────────────────────────────────────────────

export const useMarkAttendance = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: MarkAttendancePayload) => attendanceApi.markSingle(payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey: attendanceKeys.all }),
  });
};

export const useBulkMarkAttendance = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: BulkAttendancePayload) => attendanceApi.bulkMark(payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey: attendanceKeys.all }),
  });
};

export const useUpdateAttendance = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateAttendancePayload) => attendanceApi.update(id, payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey: attendanceKeys.all }),
  });
};

export const useDeleteAttendance = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => attendanceApi.deleteRecord(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: attendanceKeys.all }),
  });
};
