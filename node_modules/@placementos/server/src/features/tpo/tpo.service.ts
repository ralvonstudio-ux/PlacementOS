import { tpoRepository } from './tpo.repository';
import { attendanceRepository } from '../attendance/attendance.repository';
import { leaveRequestRepository } from '../leave-requests/leave-request.repository';
import { Faculty } from '../faculty/faculty.model';
import { openaiProvider } from '../ai/providers/llm/openai.provider';
import { AppError } from '../../middlewares/errorHandler';
import { logger } from '../../lib/logger';
import type {
  TpoDashboardData, TpoAlert, TpoFacultySummaryData, TpoBriefingSummary, TpoAttendanceInsight,
} from '@placementos/types';

const ATTENDANCE_WARN_THRESHOLD = 85;
const ATTENDANCE_CRIT_THRESHOLD = 75;

function buildAlerts(data: Omit<TpoDashboardData, 'alerts' | 'generatedAt'>): TpoAlert[] {
  const alerts: TpoAlert[] = [];

  const rate = data.attendance.today.attendanceRate;
  if (data.attendance.today.total > 0) {
    if (rate < ATTENDANCE_CRIT_THRESHOLD) {
      alerts.push({
        id: 'alert_low_attendance_crit',
        type: 'low_attendance',
        severity: 'critical',
        title: 'Critically Low Attendance',
        message: `Today's attendance is ${rate}%, well below the ${ATTENDANCE_CRIT_THRESHOLD}% threshold.`,
        actionUrl: '/attendance',
      });
    } else if (rate < ATTENDANCE_WARN_THRESHOLD) {
      alerts.push({
        id: 'alert_low_attendance_warn',
        type: 'low_attendance',
        severity: 'warning',
        title: 'Low Attendance Today',
        message: `Today's attendance is ${rate}%, below the ${ATTENDANCE_WARN_THRESHOLD}% target.`,
        actionUrl: '/attendance',
      });
    }
  }

  if (data.pendingLeaveRequests > 0) {
    alerts.push({
      id: 'alert_pending_leave',
      type: 'pending_leave',
      severity: 'warning',
      title: 'Pending Leave Requests',
      message: `${data.pendingLeaveRequests} leave request${data.pendingLeaveRequests > 1 ? 's' : ''} awaiting your review.`,
      actionUrl: '/leave-requests',
    });
  }

  return alerts;
}

export const tpoService = {
  async getDashboard(instituteId: string): Promise<TpoDashboardData> {
    const today = attendanceRepository.todayString();

    const [candidates, faculty, todayAttendance, weeklyAttendance, trainingSchedule, pendingLeave] = await Promise.all([
      tpoRepository.getCandidateStats(instituteId),
      tpoRepository.getFacultyStats(instituteId),
      attendanceRepository.getSummary(instituteId, { dateFrom: today, dateTo: today }),
      attendanceRepository.getSummary(instituteId, { dateFrom: attendanceRepository.daysAgoString(6), dateTo: today }),
      tpoRepository.getTrainingScheduleStats(instituteId),
      leaveRequestRepository.findPending(instituteId),
    ]);

    logger.info('TPO dashboard aggregated', { instituteId });

    const partial = {
      candidates,
      faculty,
      attendance: { today: todayAttendance, weeklyAvgRate: weeklyAttendance.attendanceRate },
      trainingSchedule,
      pendingLeaveRequests: pendingLeave.length,
      // No events/calendar feature exists in PlacementOS yet — kept in the contract for parity
      // with the TpoDashboardData shape, always empty until that feature is built.
      upcomingEvents: [],
    };

    return {
      ...partial,
      alerts: buildAlerts(partial),
      generatedAt: new Date().toISOString(),
    };
  },

  /** On-demand only — turns the same structured dashboard snapshot into a short recap. Re-fetches
   *  server-side rather than trusting client-supplied numbers; never invents a figure. */
  async getBriefingSummary(instituteId: string): Promise<TpoBriefingSummary> {
    if (!openaiProvider.isAvailable()) {
      throw new AppError('AI Assistant is not configured. Please contact your administrator.', 503, 'AI_UNAVAILABLE');
    }

    const [dashboard, facultySummary] = await Promise.all([
      tpoService.getDashboard(instituteId),
      tpoService.getFacultySummary(instituteId),
    ]);

    const snapshot = {
      facultyAbsent: Math.max(0, facultySummary.total - facultySummary.presentCount),
      facultyTotal: facultySummary.total,
      candidatesTotal: dashboard.candidates.total,
      candidatesPlaced: dashboard.candidates.placed,
      attendanceRate: dashboard.attendance.today.attendanceRate,
      pendingLeaveRequests: dashboard.pendingLeaveRequests,
    };

    const systemPrompt =
      'You are summarizing today\'s Training & Placement Cell operations for the TPO. Given this JSON snapshot, ' +
      'write 2-3 short sentences in a calm, executive tone. Only use numbers present in the data — ' +
      'never speculate, predict, or invent a figure that is not in the JSON.';
    const userPrompt = `Data (JSON):\n${JSON.stringify(snapshot, null, 2)}`;

    const result = await openaiProvider.complete({ systemPrompt, userPrompt, temperature: 0.4, maxTokens: 200 });

    logger.info('TPO briefing summary generated', { instituteId });

    return { summary: result.content.trim(), generatedAt: new Date().toISOString() };
  },

  async getFacultySummary(instituteId: string, date?: string): Promise<TpoFacultySummaryData> {
    const targetDate = date ?? attendanceRepository.todayString();

    const [{ total, active }, approvedLeaves, faculty] = await Promise.all([
      tpoRepository.getFacultyStats(instituteId),
      leaveRequestRepository.findApprovedForDate(instituteId, targetDate),
      Faculty.find({ instituteId, isDeleted: false }).select('fullName').lean<{ _id: unknown; fullName: string }[]>(),
    ]);

    const facultyNameById = new Map(faculty.map((f) => [String(f._id), f.fullName]));
    const onLeave = approvedLeaves.map((l) => ({
      leaveRequestId: String((l as unknown as { _id: { toString(): string } })._id),
      facultyId: l.facultyId,
      facultyName: facultyNameById.get(l.facultyId) ?? 'Unknown',
      fromDate: l.fromDate,
      toDate: l.toDate,
    }));

    // "Present" = marked at least one attendance record today for a track they teach — the same
    // definition attendance.service.getFacultyOverview uses (no staff check-in/QR system exists).
    let presentCount = 0;
    for (const f of faculty) {
      const tracks = await attendanceRepository.findMarkedTracksByFacultyOnDate(instituteId, String(f._id), targetDate);
      if (tracks.length > 0) presentCount += 1;
    }

    return { date: targetDate, total, active, onLeave, presentCount };
  },

  /** Per-batch/track attendance rate over the last 7 days, lowest-first — powers AttendanceInsightsCard. */
  async getAttendanceInsights(instituteId: string): Promise<TpoAttendanceInsight[]> {
    const today = attendanceRepository.todayString();
    const rows = await attendanceRepository.getBatchTrackRatesInRange(instituteId, attendanceRepository.daysAgoString(6), today);

    return rows
      .map((r) => ({ batch: r.batch, track: r.track, total: r.total, rate: r.total > 0 ? Math.round((r.present / r.total) * 100) : 0 }))
      .sort((a, b) => a.rate - b.rate);
  },
};
