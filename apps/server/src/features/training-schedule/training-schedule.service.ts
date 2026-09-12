import { trainingScheduleRepository, FindTrainingScheduleOptions, PaginatedTrainingSchedule } from './training-schedule.repository';
import { createTrainingScheduleSchema, updateTrainingScheduleSchema } from './training-schedule.validation';
import { NotFoundError, ForbiddenError } from '../../middlewares/errorHandler';
import { ITrainingScheduleEntry } from './training-schedule.model';
import { AuthContext } from '../../lib/auth-context';
import { User } from '../users/user.model';
import { Faculty } from '../faculty/faculty.model';

export interface AllowedBatchTrack {
  batch: string;
  track: string;
}

/** Resolves the Faculty profile linked to the logged-in user's account.
 *  Faculty accounts are linked to a Faculty document by `loginEmail` (see
 *  faculty.service.ts's `createLogin`) — mirrors resolveTeacherId in
 *  SchoolOS's question-bank.service.ts / leave-request.service.ts. Exported
 *  so other faculty-scoped features (attendance, training-plan, question-bank,
 *  worksheet-generator, tpo) can resolve a User -> Faculty id without each
 *  duplicating the lookup. */
export async function resolveFacultyId(ctx: AuthContext): Promise<string> {
  const user = (await User.findById(ctx.userId).select('email').lean()) as { email?: string } | null;
  if (!user?.email) throw new ForbiddenError('Your account has no email — cannot verify batch/track assignment');

  const faculty = (await Faculty.findOne({ instituteId: ctx.instituteId, loginEmail: user.email, isDeleted: false })
    .select('_id')
    .lean()) as { _id: { toString(): string } } | null;
  if (!faculty) throw new ForbiddenError('Faculty profile not found');

  return String(faculty._id);
}

/** Non-faculty roles (admin/tpo) bypass entirely — the route is already
 *  role-gated to those roles for anything sensitive. Reused by attendance,
 *  training-plan, question-bank and worksheet-generator services to enforce
 *  that a faculty user may only act on a batch/track they are actually
 *  scheduled to teach. Keep this export's name/signature/path stable. */
export async function assertFacultyCanAccessQuestionBank(ctx: AuthContext, batch: string, track: string): Promise<void> {
  if (ctx.role !== 'faculty') return;

  const facultyId = await resolveFacultyId(ctx);
  const entries = await trainingScheduleRepository.findByFaculty(ctx.instituteId, facultyId);
  const teachesThis = entries.some((e) => e.batch === batch && e.track === track);
  if (!teachesThis) {
    throw new ForbiddenError('You are not assigned to this batch/track');
  }
}

/** Every {batch, track} pair (deduped) the faculty member currently teaches
 *  per Training Schedule — backs unscoped list/browse requests so a faculty
 *  user's results only ever cover their own batches/tracks. Non-faculty
 *  roles get an empty array back (callers should only use this when
 *  ctx.role === 'faculty'). */
export async function getFacultyAllowedBatchTracks(ctx: AuthContext): Promise<AllowedBatchTrack[]> {
  if (ctx.role !== 'faculty') return [];

  const facultyId = await resolveFacultyId(ctx);
  const entries = await trainingScheduleRepository.findByFaculty(ctx.instituteId, facultyId);

  const pairs = new Map<string, AllowedBatchTrack>();
  for (const entry of entries) {
    const key = `${entry.batch}::${entry.track}`;
    if (!pairs.has(key)) pairs.set(key, { batch: entry.batch, track: entry.track });
  }
  return [...pairs.values()];
}

export const trainingScheduleService = {
  async list(ctx: AuthContext, options: FindTrainingScheduleOptions = {}): Promise<PaginatedTrainingSchedule> {
    if (ctx.role === 'faculty' && !options.facultyId) {
      const facultyId = await resolveFacultyId(ctx);
      options = { ...options, facultyId };
    }
    return trainingScheduleRepository.findAll(ctx.instituteId, options);
  },

  async getById(id: string, ctx: AuthContext): Promise<ITrainingScheduleEntry> {
    const entry = await trainingScheduleRepository.findById(id, ctx.instituteId);
    if (!entry) throw new NotFoundError('Training schedule entry');
    return entry;
  },

  async create(rawInput: unknown, ctx: AuthContext): Promise<ITrainingScheduleEntry> {
    const data = createTrainingScheduleSchema.parse(rawInput);
    return trainingScheduleRepository.create({
      ...data,
      instituteId: ctx.instituteId,
      createdBy: ctx.userId,
    });
  },

  async update(id: string, rawInput: unknown, ctx: AuthContext): Promise<ITrainingScheduleEntry> {
    const data = updateTrainingScheduleSchema.parse(rawInput);
    const entry = await trainingScheduleRepository.update(id, ctx.instituteId, { ...data, updatedBy: ctx.userId });
    if (!entry) throw new NotFoundError('Training schedule entry');
    return entry;
  },

  async remove(id: string, ctx: AuthContext): Promise<void> {
    const deleted = await trainingScheduleRepository.softDelete(id, ctx.instituteId, ctx.userId);
    if (!deleted) throw new NotFoundError('Training schedule entry');
  },
};
