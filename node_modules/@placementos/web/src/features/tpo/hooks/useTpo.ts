import { useQuery, useMutation } from '@tanstack/react-query';
import { tpoApi } from '../api/tpo.api';
import type {
  TpoDashboardData,
  TpoFacultySummaryData,
  TpoBriefingSummary,
  TpoAttendanceInsight,
  Faculty,
} from '@placementos/types';

export const tpoKeys = {
  all: ['tpo'] as const,
  dashboard: () => [...tpoKeys.all, 'dashboard'] as const,
  facultySummary: (date?: string) => [...tpoKeys.all, 'faculty-summary', date ?? ''] as const,
  attendanceInsights: () => [...tpoKeys.all, 'attendance-insights'] as const,
  facultyList: (search?: string) => [...tpoKeys.all, 'faculty-list', search ?? ''] as const,
  facultyDetail: (id: string) => [...tpoKeys.all, 'faculty-detail', id] as const,
};

export const useTpoDashboard = () =>
  useQuery<TpoDashboardData, Error>({
    queryKey: tpoKeys.dashboard(),
    queryFn: tpoApi.getDashboard,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    // Candidate attendance is marked by faculty throughout the day while a
    // TPO may keep this dashboard open the whole time — poll to stay live.
    refetchInterval: 30 * 1000,
  });

export const useFacultySummary = (date?: string) =>
  useQuery<TpoFacultySummaryData, Error>({
    queryKey: tpoKeys.facultySummary(date),
    queryFn: () => tpoApi.getFacultySummary(date),
  });

// On-demand action (not a query) — the daily briefing's "Summarize with AI"
// button calls this explicitly rather than on every dashboard load.
export const useBriefingSummary = () =>
  useMutation<TpoBriefingSummary, Error, void>({
    mutationFn: tpoApi.getBriefingSummary,
  });

export const useAttendanceInsights = () =>
  useQuery<TpoAttendanceInsight[], Error>({
    queryKey: tpoKeys.attendanceInsights(),
    queryFn: tpoApi.getAttendanceInsights,
  });

export const useFacultyList = (search?: string) =>
  useQuery<Faculty[], Error>({
    queryKey: tpoKeys.facultyList(search),
    queryFn: () => tpoApi.getFacultyList(search),
  });

export const useFacultyDetail = (id: string | null) =>
  useQuery<Faculty, Error>({
    queryKey: tpoKeys.facultyDetail(id ?? ''),
    queryFn: () => tpoApi.getFacultyById(id!),
    enabled: !!id,
  });
