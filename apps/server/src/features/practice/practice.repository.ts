import { PracticeQuestion, IPracticeQuestion, PracticeSheet, IPracticeSheet } from './practice.model';
import { ListPracticeQuestionInput, CreatePracticeQuestionInput, AssignPracticeQuestionsInput } from './practice.validation';
import { STARTER_QUESTIONS } from './practice.seed';

/** A candidate's identity for audience filtering. */
export interface PracticeViewer {
  candidateId: string;
  batch: string;
}

export interface PaginatedPracticeQuestions {
  data: IPracticeQuestion[];
  meta: { page: number; limit: number; total: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean };
}

export const practiceQuestionRepository = {
  async create(instituteId: string, createdBy: string, data: CreatePracticeQuestionInput): Promise<IPracticeQuestion> {
    return PracticeQuestion.create({ ...data, instituteId, createdBy });
  },

  async findById(id: string, instituteId: string): Promise<IPracticeQuestion | null> {
    return PracticeQuestion.findOne({ _id: id, instituteId, isDeleted: false });
  },

  async findByIds(ids: string[], instituteId: string): Promise<IPracticeQuestion[]> {
    if (ids.length === 0) return [];
    return PracticeQuestion.find({ _id: { $in: ids }, instituteId, isDeleted: false }).lean<IPracticeQuestion[]>();
  },

  async findAll(instituteId: string, opts: ListPracticeQuestionInput, viewer?: PracticeViewer): Promise<PaginatedPracticeQuestions> {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(200, Math.max(1, opts.limit ?? 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { instituteId, isDeleted: false };
    if (opts.category) filter.category = opts.category;
    if (opts.companyName) filter.companyName = opts.companyName;
    if (opts.difficulty) filter.difficulty = opts.difficulty;
    if (opts.search?.trim()) {
      const regex = new RegExp(opts.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$and = [{ $or: [{ questionText: regex }, { tags: regex }] }];
    }
    // Candidates only see what was shared with everyone, their batch, or them personally. Rows that
    // pre-date targeting have no audience and stay visible to everyone.
    if (viewer) {
      const visible = {
        $or: [
          { audience: { $exists: false } },
          { audience: 'all' },
          { audience: 'batches', batches: viewer.batch },
          { audience: 'students', candidateIds: viewer.candidateId },
        ],
      };
      filter.$and = [...((filter.$and as unknown[]) ?? []), visible];
    }

    const [data, total] = await Promise.all([
      PracticeQuestion.find(filter).sort({ createdAt: 1 }).skip(skip).limit(limit).lean<IPracticeQuestion[]>(),
      PracticeQuestion.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);
    return { data, meta: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 } };
  },

  async findDistinctCompanies(instituteId: string): Promise<string[]> {
    const companies = await PracticeQuestion.distinct('companyName', { instituteId, isDeleted: false, companyName: { $exists: true, $ne: null } });
    return (companies as string[]).sort((a, b) => a.localeCompare(b));
  },

  async update(id: string, instituteId: string, data: Partial<CreatePracticeQuestionInput>): Promise<IPracticeQuestion | null> {
    return PracticeQuestion.findOneAndUpdate({ _id: id, instituteId, isDeleted: false }, { $set: data }, { new: true });
  },

  /** Re-target many questions at once; returns how many were updated. */
  async assign(instituteId: string, data: AssignPracticeQuestionsInput): Promise<number> {
    const res = await PracticeQuestion.updateMany(
      { _id: { $in: data.questionIds }, instituteId, isDeleted: false },
      {
        $set: {
          audience: data.audience,
          batches: data.audience === 'batches' ? data.batches ?? [] : [],
          candidateIds: data.audience === 'students' ? data.candidateIds ?? [] : [],
        },
      }
    );
    return res.matchedCount;
  },

  /** Counts starter rows including soft-deleted ones, so a trainer who deletes a starter question never gets it back. */
  async countStarterRows(instituteId: string): Promise<number> {
    return PracticeQuestion.countDocuments({ instituteId, seedKey: { $type: 'string' } });
  },

  async insertStarterPack(instituteId: string, createdBy: string): Promise<void> {
    const docs = STARTER_QUESTIONS.map((q) => ({ ...q, audience: 'all' as const, instituteId, createdBy }));
    try {
      await PracticeQuestion.insertMany(docs, { ordered: false });
    } catch (err) {
      // A concurrent request already loaded the pack (unique {instituteId, seedKey}) — that's fine.
      if ((err as { code?: number }).code !== 11000 && !(err as { writeErrors?: unknown[] }).writeErrors) throw err;
    }
  },

  async softDelete(id: string, instituteId: string): Promise<boolean> {
    const res = await PracticeQuestion.updateOne({ _id: id, instituteId, isDeleted: false }, { $set: { isDeleted: true, deletedAt: new Date() } });
    return res.modifiedCount > 0;
  },
};

export const practiceSheetRepository = {
  async create(instituteId: string, createdBy: string, data: { title: string; batch: string; category: string; questionIds: string[] }): Promise<IPracticeSheet> {
    return PracticeSheet.create({ ...data, instituteId, createdBy });
  },

  async findById(id: string, instituteId: string): Promise<IPracticeSheet | null> {
    return PracticeSheet.findOne({ _id: id, instituteId, isDeleted: false }).lean<IPracticeSheet>();
  },

  async findForBatch(instituteId: string, batch: string): Promise<IPracticeSheet[]> {
    return PracticeSheet.find({ instituteId, batch, isDeleted: false }).sort({ createdAt: -1 }).lean<IPracticeSheet[]>();
  },

  async findAll(instituteId: string): Promise<IPracticeSheet[]> {
    return PracticeSheet.find({ instituteId, isDeleted: false }).sort({ createdAt: -1 }).lean<IPracticeSheet[]>();
  },

  async softDelete(id: string, instituteId: string): Promise<boolean> {
    const res = await PracticeSheet.updateOne({ _id: id, instituteId, isDeleted: false }, { $set: { isDeleted: true, deletedAt: new Date() } });
    return res.modifiedCount > 0;
  },
};
