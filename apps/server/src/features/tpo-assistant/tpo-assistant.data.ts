import { attendanceRepository } from '../attendance/attendance.repository';
import { tpoService } from '../tpo/tpo.service';
import { AuthContext } from '../../lib/auth-context';

// ── Granular data fetchers ────────────────────────────────────────────────────
// Each function fetches only what it needs from the existing attendance/tpo services — the
// backend does every calculation here. OpenAI never sees anything but the plain JSON these return.

export interface CandidateCounts {
  date: string;
  candidatesPresent: number;
  candidatesAbsent: number;
  candidatesExcused: number;
  candidatesTotal: number;
  attendanceRate: number;
}

export interface FacultyCounts {
  date: string;
  facultyPresent: number;
  facultyAbsent: number;
  facultyTotal: number;
}

export interface BatchTrackExtremes {
  date: string;
  highestAttendanceBatchTrack: { batch: string; track: string; percentage: number } | null;
  lowestAttendanceBatchTrack: { batch: string; track: string; percentage: number } | null;
}

export type FullAttendanceSummary = CandidateCounts & FacultyCounts & BatchTrackExtremes;

export interface BatchTrackAttendanceListItem {
  batch: string;
  track: string;
  present: number;
  absent: number;
  total: number;
}

export interface BatchTrackAttendanceList {
  date: string;
  batches: BatchTrackAttendanceListItem[];
}

export const tpoAssistantData = {
  async getCandidateCounts(ctx: AuthContext): Promise<CandidateCounts> {
    const today = attendanceRepository.todayString();
    const summary = await attendanceRepository.getSummary(ctx.instituteId, { dateFrom: today, dateTo: today });

    return {
      date: today,
      candidatesPresent: summary.present + summary.late,
      candidatesAbsent: summary.absent,
      candidatesExcused: summary.excused,
      candidatesTotal: summary.total,
      attendanceRate: summary.attendanceRate,
    };
  },

  async getFacultyCounts(ctx: AuthContext): Promise<FacultyCounts> {
    const today = attendanceRepository.todayString();
    const faculty = await tpoService.getFacultySummary(ctx.instituteId, today);

    return {
      date: today,
      facultyPresent: faculty.presentCount,
      facultyAbsent: Math.max(0, faculty.total - faculty.presentCount),
      facultyTotal: faculty.total,
    };
  },

  async getBatchTrackExtremes(ctx: AuthContext): Promise<BatchTrackExtremes> {
    const today = attendanceRepository.todayString();
    const breakdown = (await attendanceRepository.getBatchBreakdown(ctx.instituteId, today)).filter((b) => b.total > 0);
    const rated = breakdown.map((b) => ({ ...b, rate: Math.round((b.present / b.total) * 100) }));

    const highest = rated.length ? rated.reduce((a, b) => (b.rate > a.rate ? b : a)) : null;
    const lowest = rated.length ? rated.reduce((a, b) => (b.rate < a.rate ? b : a)) : null;

    return {
      date: today,
      highestAttendanceBatchTrack: highest ? { batch: highest.batch, track: highest.track, percentage: highest.rate } : null,
      lowestAttendanceBatchTrack: lowest ? { batch: lowest.batch, track: lowest.track, percentage: lowest.rate } : null,
    };
  },

  /** Batch-by-batch present/absent breakdown for today — used to answer the "candidates" branch
   *  of the attendance-scope follow-up question tersely, without an LLM formatting pass. */
  async getBatchTrackAttendanceList(ctx: AuthContext): Promise<BatchTrackAttendanceList> {
    const today = attendanceRepository.todayString();
    const breakdown = (await attendanceRepository.getBatchBreakdown(ctx.instituteId, today)).filter((b) => b.total > 0);

    return {
      date: today,
      batches: breakdown
        .map((b) => ({ batch: b.batch, track: b.track, present: b.present, absent: b.total - b.present, total: b.total }))
        .sort((a, b) => a.batch.localeCompare(b.batch, undefined, { numeric: true }) || a.track.localeCompare(b.track)),
    };
  },

  /** Used by ATTENDANCE_SUMMARY — the only intent that needs everything at once. */
  async getFullSummary(ctx: AuthContext): Promise<FullAttendanceSummary> {
    const [candidates, faculty, batches] = await Promise.all([
      tpoAssistantData.getCandidateCounts(ctx),
      tpoAssistantData.getFacultyCounts(ctx),
      tpoAssistantData.getBatchTrackExtremes(ctx),
    ]);
    return { ...candidates, ...faculty, ...batches };
  },
};
