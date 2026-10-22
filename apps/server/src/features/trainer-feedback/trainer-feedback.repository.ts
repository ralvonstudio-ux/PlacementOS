import { TrainerFeedback, ITrainerFeedback, ITrainerFeedbackRatings } from './trainer-feedback.model';
import { TrainingScheduleEntry } from '../training-schedule/training-schedule.model';
import type { TrainerFeedbackListFiltersInput } from './trainer-feedback.validation';

interface CreateInput {
  instituteId: string;
  facultyId: string;
  candidateId: string;
  batch: string;
  track: string;
  isAnonymous: boolean;
  ratings: ITrainerFeedbackRatings;
  overallRating: number;
  comment?: string;
}

export interface TrainerFeedbackAggregate {
  facultyId: string;
  responseCount: number;
  overallRating: number;
  avgByCriterion: ITrainerFeedbackRatings;
}

const CRITERIA: (keyof ITrainerFeedbackRatings)[] = ['subjectKnowledge', 'teachingQuality', 'communication', 'punctuality'];

export const trainerFeedbackRepository = {
  async create(data: CreateInput): Promise<ITrainerFeedback> {
    return TrainerFeedback.create(data);
  },

  async findExisting(instituteId: string, facultyId: string, candidateId: string, track: string): Promise<ITrainerFeedback | null> {
    return TrainerFeedback.findOne({ instituteId, facultyId, candidateId, track }).lean<ITrainerFeedback>();
  },

  /** Distinct trainers currently teaching the candidate's batch, via the training-schedule join. */
  async findTrackFacultyForBatch(instituteId: string, batch: string): Promise<{ facultyId: string; track: string }[]> {
    const entries = await TrainingScheduleEntry.find({ instituteId, batch, isDeleted: false })
      .select('facultyId track')
      .lean<{ facultyId: string; track: string }[]>();

    const seen = new Set<string>();
    const result: { facultyId: string; track: string }[] = [];
    for (const entry of entries) {
      const key = `${entry.facultyId}::${entry.track}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ facultyId: entry.facultyId, track: entry.track });
    }
    return result;
  },

  async findByCandidate(instituteId: string, candidateId: string): Promise<ITrainerFeedback[]> {
    return TrainerFeedback.find({ instituteId, candidateId }).lean<ITrainerFeedback[]>();
  },

  async listByFilters(instituteId: string, filters: TrainerFeedbackListFiltersInput): Promise<ITrainerFeedback[]> {
    const query: Record<string, unknown> = { instituteId };
    if (filters.facultyId) query.facultyId = filters.facultyId;
    if (filters.batch) query.batch = filters.batch;
    if (filters.track) query.track = filters.track;
    if (filters.from || filters.to) {
      const createdAt: Record<string, Date> = {};
      if (filters.from) createdAt.$gte = new Date(`${filters.from}T00:00:00.000Z`);
      if (filters.to) createdAt.$lte = new Date(`${filters.to}T23:59:59.999Z`);
      query.createdAt = createdAt;
    }
    return TrainerFeedback.find(query).sort({ createdAt: -1 }).limit(500).lean<ITrainerFeedback[]>();
  },

  /** Per-trainer aggregate: response count, overall average, and average per criterion.
   *  Computed in JS over a lean find(), consistent with the rest of the tpo feature's
   *  aggregation style rather than a Mongoose .aggregate() pipeline. */
  async getOverview(instituteId: string): Promise<TrainerFeedbackAggregate[]> {
    const all = await TrainerFeedback.find({ instituteId }).lean<ITrainerFeedback[]>();

    const byFaculty = new Map<string, ITrainerFeedback[]>();
    for (const fb of all) {
      const list = byFaculty.get(fb.facultyId) ?? [];
      list.push(fb);
      byFaculty.set(fb.facultyId, list);
    }

    const results: TrainerFeedbackAggregate[] = [];
    for (const [facultyId, entries] of byFaculty) {
      const avgByCriterion = CRITERIA.reduce((acc, key) => {
        acc[key] = entries.reduce((sum, e) => sum + e.ratings[key], 0) / entries.length;
        return acc;
      }, {} as ITrainerFeedbackRatings);

      const overallRating = entries.reduce((sum, e) => sum + e.overallRating, 0) / entries.length;

      results.push({ facultyId, responseCount: entries.length, overallRating, avgByCriterion });
    }

    return results.sort((a, b) => b.overallRating - a.overallRating);
  },
};
