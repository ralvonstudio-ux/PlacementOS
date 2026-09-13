import { periodSlotRepository } from './training-schedule.period.repository';
import { substituteRepository, FindSubstituteOptions, PaginatedSubstitutes } from './training-schedule.substitute.repository';
import { trainingScheduleRepository } from './training-schedule.repository';
import {
  createPeriodSlotSchema,
  updatePeriodSlotSchema,
  reorderPeriodSlotsSchema,
  setMasterGridCellSchema,
  createSubstituteSchema,
  updateSubstituteSchema,
} from './training-schedule.validation';
import { NotFoundError, ValidationError } from '../../middlewares/errorHandler';
import { IPeriodSlot } from './training-schedule.period.model';
import { ITrainingScheduleEntry } from './training-schedule.model';
import { ITimetableSubstitute } from './training-schedule.substitute.model';
import { AuthContext } from '../../lib/auth-context';
import { Faculty } from '../faculty/faculty.model';
import { LeaveRequest } from '../leave-requests/leave-request.model';

interface ConflictInfo {
  type: 'faculty_double_booked' | 'room_double_booked';
  dayOfWeek: number;
  slotId?: string;
  startTime: string;
  endTime: string;
  entryIds: string[];
  facultyId?: string;
  facultyName?: string;
  room?: string;
  message: string;
}

async function facultyNameMap(instituteId: string, facultyIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(facultyIds)];
  if (unique.length === 0) return new Map();
  const faculty = await Faculty.find({ _id: { $in: unique }, instituteId }).select('fullName').lean<{ _id: unknown; fullName: string }[]>();
  return new Map(faculty.map((f) => [String(f._id), f.fullName]));
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// ── Period slots ────────────────────────────────────────────────────────────
export const periodSlotService = {
  async list(instituteId: string): Promise<IPeriodSlot[]> {
    return periodSlotRepository.findAll(instituteId);
  },

  async create(rawInput: unknown, ctx: AuthContext): Promise<IPeriodSlot> {
    const data = createPeriodSlotSchema.parse(rawInput);
    const existing = await periodSlotRepository.findAll(ctx.instituteId);
    return periodSlotRepository.create({
      ...data,
      instituteId: ctx.instituteId,
      orderIndex: existing.length,
      createdBy: ctx.userId,
    });
  },

  async update(id: string, rawInput: unknown, ctx: AuthContext): Promise<IPeriodSlot> {
    const data = updatePeriodSlotSchema.parse(rawInput);
    const slot = await periodSlotRepository.update(id, ctx.instituteId, { ...data, updatedBy: ctx.userId });
    if (!slot) throw new NotFoundError('Period slot');
    return slot;
  },

  async remove(id: string, ctx: AuthContext): Promise<void> {
    const deleted = await periodSlotRepository.softDelete(id, ctx.instituteId, ctx.userId);
    if (!deleted) throw new NotFoundError('Period slot');
  },

  async reorder(rawInput: unknown, ctx: AuthContext): Promise<void> {
    const { orderedIds } = reorderPeriodSlotsSchema.parse(rawInput);
    await periodSlotRepository.reorder(ctx.instituteId, orderedIds);
  },
};

// ── Conflicts ───────────────────────────────────────────────────────────────
/** Scans every entry for a placement year and flags any faculty member or
 *  room booked into two overlapping slots on the same day, regardless of
 *  batch — a faculty/room can only be in one place at a time. */
export async function detectConflicts(instituteId: string, placementYear: string): Promise<ConflictInfo[]> {
  const entries = await trainingScheduleRepository.findAllForPlacementYear(instituteId, placementYear);
  const names = await facultyNameMap(instituteId, entries.map((e) => e.facultyId));
  const conflicts: ConflictInfo[] = [];

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      if (a.dayOfWeek !== b.dayOfWeek) continue;
      if (!overlaps(a.startTime, a.endTime, b.startTime, b.endTime)) continue;

      if (a.facultyId === b.facultyId) {
        conflicts.push({
          type: 'faculty_double_booked',
          dayOfWeek: a.dayOfWeek,
          slotId: a.slotId,
          startTime: a.startTime,
          endTime: a.endTime,
          entryIds: [String(a._id), String(b._id)],
          facultyId: a.facultyId,
          facultyName: names.get(a.facultyId),
          message: `${names.get(a.facultyId) ?? 'Faculty'} is scheduled for ${a.batch}/${a.track} and ${b.batch}/${b.track} at the same time`,
        });
      }
      if (a.room && b.room && a.room === b.room) {
        conflicts.push({
          type: 'room_double_booked',
          dayOfWeek: a.dayOfWeek,
          slotId: a.slotId,
          startTime: a.startTime,
          endTime: a.endTime,
          entryIds: [String(a._id), String(b._id)],
          room: a.room,
          message: `Room ${a.room} is double-booked for ${a.batch}/${a.track} and ${b.batch}/${b.track}`,
        });
      }
    }
  }

  return conflicts;
}

// ── Master grid ─────────────────────────────────────────────────────────────
interface MasterGridCell {
  dayOfWeek: number;
  slotId: string;
  batch: string;
  entry?: Record<string, unknown>;
}

export async function getMasterGrid(instituteId: string, placementYear: string, batchFilter?: string) {
  const [slots, entries, conflicts] = await Promise.all([
    periodSlotRepository.findAll(instituteId),
    trainingScheduleRepository.findAllForPlacementYear(instituteId, placementYear),
    detectConflicts(instituteId, placementYear),
  ]);

  const names = await facultyNameMap(instituteId, entries.map((e) => e.facultyId));
  const scoped = batchFilter ? entries.filter((e) => e.batch === batchFilter) : entries;
  const batches = [...new Set(scoped.map((e) => e.batch))].sort();

  const cells: MasterGridCell[] = [];
  for (const batch of batches) {
    for (const slot of slots) {
      for (const day of slot.daysApplicable) {
        const entry = scoped.find((e) => e.batch === batch && e.dayOfWeek === day && e.slotId === String(slot._id));
        cells.push({
          dayOfWeek: day,
          slotId: String(slot._id),
          batch,
          entry: entry ? { ...entry, facultyName: names.get(entry.facultyId) } : undefined,
        });
      }
    }
  }

  return { slots, batches, cells, conflicts };
}

export async function setMasterGridCell(rawInput: unknown, ctx: AuthContext): Promise<ITrainingScheduleEntry> {
  const data = setMasterGridCellSchema.parse(rawInput);
  const slot = await periodSlotRepository.findById(data.slotId, ctx.instituteId);
  if (!slot) throw new NotFoundError('Period slot');

  const payload = {
    batch: data.batch,
    track: data.track,
    facultyId: data.facultyId,
    dayOfWeek: data.dayOfWeek,
    startTime: slot.startTime,
    endTime: slot.endTime,
    room: data.room,
    placementYear: data.placementYear,
    slotId: data.slotId,
  };

  if (data.entryId) {
    const updated = await trainingScheduleRepository.update(data.entryId, ctx.instituteId, { ...payload, updatedBy: ctx.userId });
    if (!updated) throw new NotFoundError('Training schedule entry');
    return updated;
  }

  return trainingScheduleRepository.create({ ...payload, instituteId: ctx.instituteId, createdBy: ctx.userId });
}

// ── Substitutes ─────────────────────────────────────────────────────────────
export const substituteService = {
  async list(instituteId: string, options: FindSubstituteOptions): Promise<PaginatedSubstitutes> {
    const result = await substituteRepository.findAll(instituteId, options);
    return result;
  },

  async create(rawInput: unknown, ctx: AuthContext): Promise<ITimetableSubstitute> {
    const data = createSubstituteSchema.parse(rawInput);
    const entry = await trainingScheduleRepository.findById(data.entryId, ctx.instituteId);
    if (!entry) throw new NotFoundError('Training schedule entry');

    const existing = await substituteRepository.findByEntryAndDate(ctx.instituteId, data.entryId, data.date);
    if (existing) throw new ValidationError('A substitute record already exists for this entry and date');

    return substituteRepository.create({
      instituteId: ctx.instituteId,
      date: data.date,
      entryId: data.entryId,
      originalFacultyId: entry.facultyId,
      substituteFacultyId: data.substituteFacultyId,
      reason: data.reason,
      status: data.substituteFacultyId ? 'assigned' : 'pending',
      createdBy: ctx.userId,
    });
  },

  async update(id: string, rawInput: unknown, ctx: AuthContext): Promise<ITimetableSubstitute> {
    const data = updateSubstituteSchema.parse(rawInput);
    const status = data.status ?? (data.substituteFacultyId ? 'assigned' : undefined);
    const updated = await substituteRepository.update(id, ctx.instituteId, { ...data, ...(status ? { status } : {}), updatedBy: ctx.userId });
    if (!updated) throw new NotFoundError('Substitute record');
    return updated;
  },

  async remove(id: string, ctx: AuthContext): Promise<void> {
    const deleted = await substituteRepository.remove(id, ctx.instituteId);
    if (!deleted) throw new NotFoundError('Substitute record');
  },

  /** Entries taught on the given weekday by faculty currently on approved
   *  leave for that date, with no substitute assigned yet. */
  async needsSubstitute(instituteId: string, date: string) {
    const dayOfWeek = new Date(`${date}T00:00:00`).getDay(); // 0=Sun..6=Sat
    if (dayOfWeek === 0) return [];

    const [onLeave, existingSubs] = await Promise.all([
      LeaveRequest.find({ instituteId, status: 'approved', fromDate: { $lte: date }, toDate: { $gte: date } })
        .select('facultyId')
        .lean<{ facultyId: string }[]>(),
      substituteRepository.findAll(instituteId, { date, limit: 500 }),
    ]);
    if (onLeave.length === 0) return [];

    const leaveFacultyIds = new Set(onLeave.map((l) => l.facultyId));
    const coveredEntryIds = new Set(existingSubs.data.filter((s) => s.status !== 'cancelled').map((s) => s.entryId));

    const { data: entries } = await trainingScheduleRepository.findAll(instituteId, { dayOfWeek, limit: 500 });
    const relevant = entries.filter((e) => leaveFacultyIds.has(e.facultyId) && !coveredEntryIds.has(String(e._id)));
    const names = await facultyNameMap(instituteId, relevant.map((e) => e.facultyId));

    return relevant.map((entry) => ({
      date,
      entry,
      facultyName: names.get(entry.facultyId) ?? 'Unknown',
      leaveRequestId: '',
    }));
  },

  /** Faculty who teach the same track and have no other entry in this
   *  day/slot — best-fit substitutes first. */
  async suggestSubstituteTeachers(instituteId: string, track: string, dayOfWeek: number, excludeFacultyId?: string) {
    const [allFaculty, dayEntries] = await Promise.all([
      Faculty.find({ instituteId, isDeleted: false, employmentStatus: 'active' }).select('fullName tracks').lean<{ _id: unknown; fullName: string; tracks: string[] }[]>(),
      trainingScheduleRepository.findAll(instituteId, { dayOfWeek, limit: 500 }),
    ]);

    const busyFacultyIds = new Set(dayEntries.data.map((e) => e.facultyId));

    return allFaculty
      .filter((f) => String(f._id) !== excludeFacultyId)
      .map((f) => ({
        facultyId: String(f._id),
        facultyName: f.fullName,
        sameTrack: f.tracks.includes(track),
        available: !busyFacultyIds.has(String(f._id)),
      }))
      .sort((a, b) => Number(b.sameTrack) - Number(a.sameTrack) || Number(b.available) - Number(a.available));
  },
};
