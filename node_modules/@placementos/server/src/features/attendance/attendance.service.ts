import { attendanceRepository, PaginatedAttendance, AttendanceSummary } from './attendance.repository';
import { IAttendance } from './attendance.model';
import {
  singleAttendanceSchema,
  bulkAttendanceSchema,
  updateAttendanceSchema,
  listAttendanceSchema,
  candidateHistorySchema,
  batchAttendanceSchema,
  summarySchema,
  overviewSchema,
} from './attendance.validation';
import { NotFoundError, ValidationError, ForbiddenError } from '../../middlewares/errorHandler';
import { AuthContext } from '../../lib/auth-context';
import { candidateRepository } from '../candidates/candidate.repository';
import { trainingScheduleRepository } from '../training-schedule/training-schedule.repository';
import { Faculty } from '../faculty/faculty.model';
import { assertFacultyCanAccessQuestionBank, resolveFacultyId } from '../training-schedule/training-schedule.service';
import type { BatchAttendanceOverview, FacultyAttendanceOverview } from '@placementos/types';

// Faculty may only mark/edit attendance for the current day — past dates are
// permanently view-only (no backfilling) and future dates are not yet in
// session. Admin/TPO are exempt.
function assertAttendanceEditableForFaculty(ctx: AuthContext, date: string): void {
  if (ctx.role !== 'faculty') return;
  const today = attendanceRepository.todayString();
  if (date !== today) {
    throw new ValidationError('Attendance can only be marked or edited for today — past attendance is view-only and future dates are not allowed.');
  }
}

/** Attendance.markedBy is keyed on Faculty._id (not User._id) so it lines up with the same
 *  Faculty-id join getFacultyOverview/Training Schedule use everywhere else. Admin/TPO marking on
 *  a faculty member's behalf have no Faculty profile, so they fall back to their own user id. */
async function resolveMarkedBy(ctx: AuthContext): Promise<string> {
  if (ctx.role !== 'faculty') return ctx.userId;
  return resolveFacultyId(ctx);
}

export const attendanceService = {
  async markSingle(rawInput: unknown, ctx: AuthContext): Promise<IAttendance> {
    const data = singleAttendanceSchema.parse(rawInput);

    assertAttendanceEditableForFaculty(ctx, data.date);
    await assertFacultyCanAccessQuestionBank(ctx, data.batch, data.track);

    const candidate = await candidateRepository.findById(data.candidateId, ctx.instituteId);
    if (!candidate) throw new NotFoundError('Candidate');

    const markedBy = await resolveMarkedBy(ctx);
    return attendanceRepository.upsert({
      candidateId: data.candidateId,
      batch: data.batch,
      track: data.track,
      date: data.date,
      status: data.status,
      note: data.note,
      instituteId: ctx.instituteId,
      markedBy,
    });
  },

  async bulkMark(rawInput: unknown, ctx: AuthContext): Promise<IAttendance[]> {
    const data = bulkAttendanceSchema.parse(rawInput);

    assertAttendanceEditableForFaculty(ctx, data.date);
    await assertFacultyCanAccessQuestionBank(ctx, data.batch, data.track);

    const markedBy = await resolveMarkedBy(ctx);
    return attendanceRepository.bulkUpsert(
      data.records.map((r) => ({
        candidateId: r.candidateId,
        instituteId: ctx.instituteId,
        batch: data.batch,
        track: data.track,
        date: data.date,
        status: r.status,
        note: r.note,
        markedBy,
      }))
    );
  },

  async getById(id: string, ctx: AuthContext): Promise<IAttendance> {
    const record = await attendanceRepository.findById(id, ctx.instituteId);
    if (!record) throw new NotFoundError('Attendance record');
    await assertFacultyCanAccessQuestionBank(ctx, record.batch, record.track);
    return record;
  },

  async update(id: string, rawInput: unknown, ctx: AuthContext): Promise<IAttendance> {
    const data = updateAttendanceSchema.parse(rawInput);
    if (!data.status && data.note === undefined) throw new ValidationError('No fields to update');

    const existing = await attendanceRepository.findById(id, ctx.instituteId);
    if (!existing) throw new NotFoundError('Attendance record');

    assertAttendanceEditableForFaculty(ctx, existing.date);
    await assertFacultyCanAccessQuestionBank(ctx, existing.batch, existing.track);

    const record = await attendanceRepository.update(id, ctx.instituteId, data);
    if (!record) throw new NotFoundError('Attendance record');
    return record;
  },

  async deleteRecord(id: string, ctx: AuthContext): Promise<void> {
    const existing = await attendanceRepository.findById(id, ctx.instituteId);
    if (!existing) throw new NotFoundError('Attendance record');

    const deleted = await attendanceRepository.softDelete(id, ctx.instituteId, ctx.displayName);
    if (!deleted) throw new NotFoundError('Attendance record');
  },

  async getBatchAttendance(batch: string, track: string, rawQuery: unknown, ctx: AuthContext): Promise<IAttendance[]> {
    const { date } = batchAttendanceSchema.parse(rawQuery);
    const targetDate = date ?? attendanceRepository.todayString();
    await assertFacultyCanAccessQuestionBank(ctx, batch, track);
    return attendanceRepository.findByBatchTrackDate(ctx.instituteId, batch, track, targetDate);
  },

  async getCandidateHistory(candidateId: string, rawQuery: unknown, ctx: AuthContext): Promise<PaginatedAttendance> {
    const candidate = await candidateRepository.findById(candidateId, ctx.instituteId);
    if (!candidate) throw new NotFoundError('Candidate');

    const opts = candidateHistorySchema.parse(rawQuery);
    return attendanceRepository.findByCandidate(ctx.instituteId, candidateId, {
      page: opts.page ?? 1,
      limit: opts.limit ?? 50,
      dateFrom: opts.dateFrom,
      dateTo: opts.dateTo,
      status: opts.status,
    });
  },

  async listAll(rawQuery: unknown, ctx: AuthContext): Promise<PaginatedAttendance> {
    const opts = listAttendanceSchema.parse(rawQuery);
    // No required batch/track in the URL — a faculty user could otherwise omit
    // or swap the batch/track query params to pull every batch's records.
    if (ctx.role === 'faculty') {
      if (!opts.batch || !opts.track) {
        throw new ForbiddenError('Specify a batch and track to view attendance — use the batch-scoped view.');
      }
      await assertFacultyCanAccessQuestionBank(ctx, opts.batch, opts.track);
    }
    return attendanceRepository.findAll(ctx.instituteId, opts);
  },

  async getSummary(rawQuery: unknown, ctx: AuthContext): Promise<AttendanceSummary> {
    const opts = summarySchema.parse(rawQuery);
    if (ctx.role === 'faculty') {
      if (!opts.batch || !opts.track) {
        throw new ForbiddenError('Specify a batch and track to view attendance summary — use the batch-scoped view.');
      }
      await assertFacultyCanAccessQuestionBank(ctx, opts.batch, opts.track);
    }
    return attendanceRepository.getSummary(ctx.instituteId, opts);
  },

  /** TPO Attendance page — Batches tab. Every batch/track scheduled in Training
   *  Schedule, with present/absent counts for the given date. */
  async getBatchOverview(rawQuery: unknown, ctx: AuthContext): Promise<BatchAttendanceOverview> {
    const { date } = overviewSchema.parse(rawQuery);
    const targetDate = date ?? attendanceRepository.todayString();

    const [schedule, breakdown] = await Promise.all([
      trainingScheduleRepository.findAll(ctx.instituteId, { limit: 1000 }),
      attendanceRepository.getBatchBreakdown(ctx.instituteId, targetDate),
    ]);

    const key = (batch: string, track: string) => `${batch.toLowerCase()}||${track.toLowerCase()}`;
    const facultyByKey = new Map<string, string>();
    const facultyIds = [...new Set(schedule.data.map((e) => e.facultyId))];
    const facultyDocs = facultyIds.length
      ? await Faculty.find({ _id: { $in: facultyIds }, isDeleted: false }).select('fullName').lean<{ _id: unknown; fullName: string }[]>()
      : [];
    const facultyNameById = new Map(facultyDocs.map((f) => [String(f._id), f.fullName]));
    for (const entry of schedule.data) {
      facultyByKey.set(key(entry.batch, entry.track), facultyNameById.get(entry.facultyId) ?? '');
    }

    const presentMap = new Map(breakdown.map((b) => [key(b.batch, b.track), b]));
    const seen = new Set<string>();
    const rows = schedule.data
      .filter((entry) => {
        const k = key(entry.batch, entry.track);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((entry) => {
        const k = key(entry.batch, entry.track);
        const breakdownRow = presentMap.get(k);
        const totalCandidates = breakdownRow?.total ?? 0;
        const present = breakdownRow?.present ?? 0;
        return {
          batch: entry.batch,
          track: entry.track,
          facultyName: facultyByKey.get(k) || undefined,
          totalCandidates,
          present,
          absent: Math.max(totalCandidates - present, 0),
        };
      });

    rows.sort((a, b) => a.batch.localeCompare(b.batch, undefined, { numeric: true }) || a.track.localeCompare(b.track));

    const totals = rows.reduce(
      (acc, r) => {
        acc.totalBatches += 1;
        acc.totalPresent += r.present;
        acc.totalAbsent += r.absent;
        return acc;
      },
      { totalBatches: 0, totalPresent: 0, totalAbsent: 0 }
    );

    return { date: targetDate, batches: rows, totals };
  },

  /** TPO Attendance page — Faculty tab. Every active faculty member, marked
   *  "present" if they submitted at least one attendance record that day for
   *  a track they're scheduled to teach, otherwise "not_marked". */
  async getFacultyOverview(rawQuery: unknown, ctx: AuthContext): Promise<FacultyAttendanceOverview> {
    const { date } = overviewSchema.parse(rawQuery);
    const targetDate = date ?? attendanceRepository.todayString();

    const faculty = await Faculty.find({ instituteId: ctx.instituteId, isDeleted: false })
      .select('fullName department')
      .lean<{ _id: unknown; fullName: string; department?: string }[]>();

    const rows = await Promise.all(
      faculty.map(async (f) => {
        const facultyId = String(f._id);
        const markedTracks = await attendanceRepository.findMarkedTracksByFacultyOnDate(ctx.instituteId, facultyId, targetDate);
        return {
          facultyId,
          fullName: f.fullName,
          department: f.department,
          status: (markedTracks.length > 0 ? 'present' : 'not_marked') as 'present' | 'not_marked',
        };
      })
    );

    rows.sort((a, b) => a.fullName.localeCompare(b.fullName));
    const present = rows.filter((r) => r.status === 'present').length;

    return {
      date: targetDate,
      faculty: rows,
      totals: { totalFaculty: rows.length, present, absent: rows.length - present },
    };
  },
};
