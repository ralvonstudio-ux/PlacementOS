import { trainerFeedbackRepository } from './trainer-feedback.repository';
import { candidateRepository } from '../candidates/candidate.repository';
import { Candidate } from '../candidates/candidate.model';
import { Faculty } from '../faculty/faculty.model';
import { resolveCandidateId } from '../candidates/candidate.service';
import { ConflictError, NotFoundError } from '../../middlewares/errorHandler';
import { AuthContext } from '../../lib/auth-context';
import { createTrainerFeedbackSchema, trainerFeedbackListFiltersSchema } from './trainer-feedback.validation';
import type { ITrainerFeedback, ITrainerFeedbackRatings } from './trainer-feedback.model';
import type {
  TrainerFeedback as TrainerFeedbackApiShape,
  TrainerFeedbackListItem,
  TrainerFeedbackOverviewItem,
  TrainerFeedbackEligibleTrainer,
} from '@placementos/types';

const CRITERIA: (keyof ITrainerFeedbackRatings)[] = ['subjectKnowledge', 'teachingQuality', 'communication', 'punctuality'];

const average = (ratings: ITrainerFeedbackRatings): number =>
  Math.round((CRITERIA.reduce((sum, key) => sum + ratings[key], 0) / CRITERIA.length) * 100) / 100;

const toApiShape = (fb: ITrainerFeedback): TrainerFeedbackApiShape => ({
  _id: String((fb as unknown as { _id: { toString(): string } })._id),
  instituteId: fb.instituteId,
  facultyId: fb.facultyId,
  candidateId: fb.candidateId,
  batch: fb.batch,
  track: fb.track,
  isAnonymous: fb.isAnonymous,
  ratings: fb.ratings,
  overallRating: fb.overallRating,
  comment: fb.comment,
  createdAt: new Date(fb.createdAt).toISOString(),
  updatedAt: new Date(fb.updatedAt).toISOString(),
});

async function withNames(instituteId: string, feedback: ITrainerFeedback[]): Promise<TrainerFeedbackListItem[]> {
  const facultyIds = [...new Set(feedback.map((f) => f.facultyId))];
  const candidateIds = [...new Set(feedback.filter((f) => !f.isAnonymous).map((f) => f.candidateId))];

  const [faculty, candidates] = await Promise.all([
    facultyIds.length
      ? Faculty.find({ _id: { $in: facultyIds }, instituteId }).select('fullName').lean<{ _id: unknown; fullName: string }[]>()
      : Promise.resolve([] as { _id: unknown; fullName: string }[]),
    candidateIds.length
      ? Candidate.find({ _id: { $in: candidateIds }, instituteId }).select('fullName').lean<{ _id: unknown; fullName: string }[]>()
      : Promise.resolve([] as { _id: unknown; fullName: string }[]),
  ]);

  const facultyNameById = new Map(faculty.map((f) => [String(f._id), f.fullName]));
  const candidateNameById = new Map(candidates.map((c) => [String(c._id), c.fullName]));

  return feedback.map((fb) => ({
    ...toApiShape(fb),
    facultyName: facultyNameById.get(fb.facultyId) ?? 'Unknown trainer',
    candidateName: fb.isAnonymous ? undefined : candidateNameById.get(fb.candidateId) ?? 'Unknown student',
  }));
}

export const trainerFeedbackService = {
  async submit(rawInput: unknown, ctx: AuthContext): Promise<TrainerFeedbackApiShape> {
    const input = createTrainerFeedbackSchema.parse(rawInput);
    const candidateId = await resolveCandidateId(ctx);
    const candidate = await candidateRepository.findById(candidateId, ctx.instituteId);
    if (!candidate) throw new NotFoundError('Candidate profile');

    const existing = await trainerFeedbackRepository.findExisting(ctx.instituteId, input.facultyId, candidateId, input.track);
    if (existing) throw new ConflictError('You have already submitted feedback for this trainer on this subject.');

    const overallRating = average(input.ratings);

    const created = await trainerFeedbackRepository.create({
      instituteId: ctx.instituteId,
      facultyId: input.facultyId,
      candidateId,
      batch: candidate.batch,
      track: input.track,
      isAnonymous: input.isAnonymous,
      ratings: input.ratings,
      overallRating,
      comment: input.comment,
    });

    return toApiShape(created);
  },

  async getEligibleTrainers(ctx: AuthContext): Promise<TrainerFeedbackEligibleTrainer[]> {
    const candidateId = await resolveCandidateId(ctx);
    const candidate = await candidateRepository.findById(candidateId, ctx.instituteId);
    if (!candidate) throw new NotFoundError('Candidate profile');

    const [trainerTracks, submitted] = await Promise.all([
      trainerFeedbackRepository.findTrackFacultyForBatch(ctx.instituteId, candidate.batch),
      trainerFeedbackRepository.findByCandidate(ctx.instituteId, candidateId),
    ]);

    if (trainerTracks.length === 0) return [];

    const facultyIds = [...new Set(trainerTracks.map((t) => t.facultyId))];
    const faculty = await Faculty.find({ _id: { $in: facultyIds }, instituteId: ctx.instituteId })
      .select('fullName department')
      .lean<{ _id: unknown; fullName: string; department?: string }[]>();
    const facultyById = new Map(faculty.map((f) => [String(f._id), f]));

    const submittedKey = new Set(submitted.map((s) => `${s.facultyId}::${s.track}`));

    return trainerTracks
      .filter((t) => facultyById.has(t.facultyId))
      .map((t) => {
        const f = facultyById.get(t.facultyId)!;
        return {
          facultyId: t.facultyId,
          facultyName: f.fullName,
          department: f.department,
          track: t.track,
          alreadySubmitted: submittedKey.has(`${t.facultyId}::${t.track}`),
        };
      });
  },

  async list(rawFilters: unknown, ctx: AuthContext): Promise<TrainerFeedbackListItem[]> {
    const filters = trainerFeedbackListFiltersSchema.parse(rawFilters);
    const feedback = await trainerFeedbackRepository.listByFilters(ctx.instituteId, filters);
    return withNames(ctx.instituteId, feedback);
  },

  async getOverview(ctx: AuthContext): Promise<TrainerFeedbackOverviewItem[]> {
    const aggregates = await trainerFeedbackRepository.getOverview(ctx.instituteId);
    if (aggregates.length === 0) return [];

    const facultyIds = aggregates.map((a) => a.facultyId);
    const faculty = await Faculty.find({ _id: { $in: facultyIds }, instituteId: ctx.instituteId })
      .select('fullName department')
      .lean<{ _id: unknown; fullName: string; department?: string }[]>();
    const facultyById = new Map(faculty.map((f) => [String(f._id), f]));

    return aggregates
      .filter((a) => facultyById.has(a.facultyId))
      .map((a) => ({
        facultyId: a.facultyId,
        facultyName: facultyById.get(a.facultyId)!.fullName,
        department: facultyById.get(a.facultyId)!.department,
        responseCount: a.responseCount,
        overallRating: Math.round(a.overallRating * 100) / 100,
        avgByCriterion: {
          subjectKnowledge: Math.round(a.avgByCriterion.subjectKnowledge * 100) / 100,
          teachingQuality: Math.round(a.avgByCriterion.teachingQuality * 100) / 100,
          communication: Math.round(a.avgByCriterion.communication * 100) / 100,
          punctuality: Math.round(a.avgByCriterion.punctuality * 100) / 100,
        },
      }));
  },
};
