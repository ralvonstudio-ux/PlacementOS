import {
  BankQuestion, IBankQuestion, QuestionKind, QuestionDifficulty, QuestionBloomsLevel,
  IBankQuestionSourceRef, IBankQuestionImageRef, IBankQuestionImageRequirement,
} from './bank-question.model';

export interface QuestionListOptions {
  page?: number;
  limit?: number;
  batch?: string;
  track?: string;
  trainingModuleId?: string;
  topic?: string;
  difficulty?: QuestionDifficulty;
  questionType?: QuestionKind;
  search?: string;
  // Only used when `batch`/`track` are both omitted — narrows an unscoped "browse everything"
  // query to a specific set of {batch, track} pairs (a faculty member's own Training Schedule).
  batchTrackPairs?: { batch: string; track: string }[];
}

export interface PaginatedQuestions {
  questions: IBankQuestion[];
  total: number;
  page: number;
  limit: number;
}

export interface QuestionGroup {
  batch: string;
  track: string;
  trainingModuleId: string;
  trainingModuleName: string;
  count: number;
}

export interface CreateQuestionData {
  instituteId: string;
  batch: string;
  track: string;
  trainingModuleId: string;
  trainingModuleName: string;
  topic?: string;
  topicId?: string;
  subtopicId?: string;
  questionText: string;
  questionType: QuestionKind;
  options?: string[];
  correctAnswer?: string;
  difficulty: QuestionDifficulty;
  marks: number;
  estimatedTimeMinutes: number;
  bloomsLevel: QuestionBloomsLevel;
  keywords: string[];
  source?: string;
  createdBy: string;
  sourceRef?: IBankQuestionSourceRef;
  imageRef?: IBankQuestionImageRef;
  imageRequirement?: IBankQuestionImageRequirement;
}

export const bankQuestionRepository = {
  async create(data: CreateQuestionData): Promise<IBankQuestion> {
    return BankQuestion.create(data);
  },

  async createMany(data: CreateQuestionData[]): Promise<IBankQuestion[]> {
    if (data.length === 0) return [];
    return BankQuestion.insertMany(data);
  },

  async findAll(instituteId: string, opts: QuestionListOptions = {}): Promise<PaginatedQuestions> {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(200, Math.max(1, opts.limit ?? 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { instituteId, isDeleted: false };
    if (opts.batch) query.batch = opts.batch;
    if (opts.track) query.track = opts.track;
    if (opts.trainingModuleId) query.trainingModuleId = opts.trainingModuleId;
    if (opts.topic) query.topic = opts.topic;
    if (opts.difficulty) query.difficulty = opts.difficulty;
    if (opts.questionType) query.questionType = opts.questionType;

    const andClauses: Record<string, unknown>[] = [];
    if (opts.search?.trim()) {
      const regex = new RegExp(opts.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      andClauses.push({ $or: [{ questionText: regex }, { keywords: regex }, { topic: regex }] });
    }
    if (!opts.batch && !opts.track && opts.batchTrackPairs && opts.batchTrackPairs.length > 0) {
      andClauses.push({ $or: opts.batchTrackPairs.map((p) => ({ batch: p.batch, track: p.track })) });
    }
    if (andClauses.length > 0) query.$and = andClauses;

    const [questions, total] = await Promise.all([
      BankQuestion.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean<IBankQuestion[]>(),
      BankQuestion.countDocuments(query),
    ]);

    return { questions, total, page, limit };
  },

  /** Module-grouped counts for the Question Bank landing view. */
  async findGroups(instituteId: string, opts: Pick<QuestionListOptions, 'batch' | 'track' | 'search' | 'batchTrackPairs'> = {}): Promise<QuestionGroup[]> {
    const match: Record<string, unknown> = { instituteId, isDeleted: false };
    if (opts.batch) match.batch = opts.batch;
    if (opts.track) match.track = opts.track;

    const andClauses: Record<string, unknown>[] = [];
    if (opts.search?.trim()) {
      const regex = new RegExp(opts.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      andClauses.push({ $or: [{ questionText: regex }, { keywords: regex }, { topic: regex }] });
    }
    if (!opts.batch && !opts.track && opts.batchTrackPairs && opts.batchTrackPairs.length > 0) {
      andClauses.push({ $or: opts.batchTrackPairs.map((p) => ({ batch: p.batch, track: p.track })) });
    }
    if (andClauses.length > 0) match.$and = andClauses;

    const rows = await BankQuestion.aggregate<{
      _id: { batch: string; track: string; trainingModuleId: string; trainingModuleName: string };
      count: number;
    }>([
      { $match: match },
      { $group: { _id: { batch: '$batch', track: '$track', trainingModuleId: '$trainingModuleId', trainingModuleName: '$trainingModuleName' }, count: { $sum: 1 } } },
      { $sort: { '_id.batch': 1, '_id.track': 1, '_id.trainingModuleName': 1 } },
    ]);

    return rows.map((r) => ({
      batch: r._id.batch,
      track: r._id.track,
      trainingModuleId: r._id.trainingModuleId,
      trainingModuleName: r._id.trainingModuleName,
      count: r.count,
    }));
  },

  async findById(id: string, instituteId: string): Promise<IBankQuestion | null> {
    return BankQuestion.findOne({ _id: id, instituteId, isDeleted: false }).lean<IBankQuestion>();
  },

  async findByIds(instituteId: string, ids: string[]): Promise<IBankQuestion[]> {
    if (ids.length === 0) return [];
    return BankQuestion.find({ _id: { $in: ids }, instituteId }).lean<IBankQuestion[]>();
  },

  /** Eligible pool for the paper/worksheet generators: not deleted, matching batch/track/modules,
   *  optionally narrowed further to specific topics/subtopics within those modules. Falls back to
   *  the unfiltered module-level pool rather than starving a real request when a topicId filter
   *  can't be satisfied by a legacy (pre-topicTree) module's questions. */
  async findEligible(instituteId: string, batch: string, track: string, trainingModuleIds: string[], topicIds?: string[]): Promise<IBankQuestion[]> {
    const baseQuery: Record<string, unknown> = {
      instituteId, batch, track, isDeleted: false,
      ...(trainingModuleIds.length > 0 ? { trainingModuleId: { $in: trainingModuleIds } } : {}),
    };

    if (!topicIds || topicIds.length === 0) {
      return BankQuestion.find(baseQuery).lean<IBankQuestion[]>();
    }

    const scoped = await BankQuestion.find({ ...baseQuery, topicId: { $in: topicIds } }).lean<IBankQuestion[]>();
    if (scoped.length > 0) return scoped;

    const anyTopicTagged = await BankQuestion.exists({ ...baseQuery, topicId: { $exists: true, $ne: null } });
    if (anyTopicTagged) return scoped;

    return BankQuestion.find(baseQuery).lean<IBankQuestion[]>();
  },

  /** Existing (non-deleted) question texts already saved for a module — used by confirmExtractedQuestions
   *  to skip re-inserting duplicates when the process-once guard hands back an already-processed
   *  module's questions as a re-editable draft batch. */
  async findExistingTexts(instituteId: string, trainingModuleId: string, texts: string[]): Promise<Set<string>> {
    if (texts.length === 0) return new Set();
    const normalized = texts.map((t) => t.trim().toLowerCase());
    const existing = await BankQuestion.find({
      instituteId, trainingModuleId, isDeleted: false,
      questionText: { $in: normalized.map((t) => new RegExp(`^${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')) },
    }).select('questionText').lean<{ questionText: string }[]>();
    return new Set(existing.map((q) => q.questionText.trim().toLowerCase()));
  },

  async update(id: string, instituteId: string, data: Partial<CreateQuestionData>): Promise<IBankQuestion | null> {
    return BankQuestion.findOneAndUpdate({ _id: id, instituteId, isDeleted: false }, { $set: data }, { new: true }).lean<IBankQuestion>();
  },

  async softDelete(id: string, instituteId: string): Promise<boolean> {
    const res = await BankQuestion.updateOne({ _id: id, instituteId, isDeleted: false }, { $set: { isDeleted: true, deletedAt: new Date() } });
    return res.modifiedCount > 0;
  },

  /** Soft-deletes every question in one or more module groups at once. */
  async softDeleteByModuleGroups(instituteId: string, groups: { batch: string; track: string; trainingModuleId: string }[]): Promise<number> {
    if (groups.length === 0) return 0;
    const res = await BankQuestion.updateMany(
      { instituteId, isDeleted: false, $or: groups.map((g) => ({ batch: g.batch, track: g.track, trainingModuleId: g.trainingModuleId })) },
      { $set: { isDeleted: true, deletedAt: new Date() } }
    );
    return res.modifiedCount;
  },

  /** Reassigns every question in the given source module groups onto one target module — the
   *  landing view's "Merge modules" action, for a module the AI split into several rows. A source
   *  group's own moduleName is preserved as its questions' `topic` (only when unset) so it still
   *  surfaces as a sub-heading once nested inside the merged module. */
  async mergeModuleGroups(
    instituteId: string,
    groups: { batch: string; track: string; trainingModuleId: string; trainingModuleName: string }[],
    target: { trainingModuleId: string; trainingModuleName: string }
  ): Promise<number> {
    let modified = 0;
    for (const g of groups) {
      if (g.trainingModuleId === target.trainingModuleId) continue;
      const filter = { instituteId, isDeleted: false, batch: g.batch, track: g.track, trainingModuleId: g.trainingModuleId };
      await BankQuestion.updateMany(
        { ...filter, $or: [{ topic: { $exists: false } }, { topic: null }, { topic: '' }] },
        { $set: { topic: g.trainingModuleName } }
      );
      const reassigned = await BankQuestion.updateMany(filter, { $set: { trainingModuleId: target.trainingModuleId, trainingModuleName: target.trainingModuleName } });
      modified += reassigned.modifiedCount;
    }
    return modified;
  },

  /** Minimal per-question rows for every batch/track/module in the institute — backs the TPO's
   *  materials overview. Deliberately un-paginated and narrowly projected. */
  async findAllForInstitute(instituteId: string): Promise<{
    batch: string; track: string; trainingModuleId: string; trainingModuleName: string;
    questionType: QuestionKind; difficulty: QuestionDifficulty; createdBy: string; createdAt: Date;
  }[]> {
    return BankQuestion.find({ instituteId, isDeleted: false })
      .select('batch track trainingModuleId trainingModuleName questionType difficulty createdBy createdAt')
      .lean();
  },

  async recordUsage(ids: string[], examId: string | undefined, usedAt: Date): Promise<void> {
    if (ids.length === 0) return;
    await BankQuestion.updateMany({ _id: { $in: ids } }, { $push: { usageHistory: { examId, usedAt } } });
  },
};
