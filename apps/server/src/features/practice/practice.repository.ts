import { PracticeQuestion, IPracticeQuestion, PracticeSheet, IPracticeSheet } from './practice.model';
import { ListPracticeQuestionInput, CreatePracticeQuestionInput } from './practice.validation';

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

  async findAll(instituteId: string, opts: ListPracticeQuestionInput): Promise<PaginatedPracticeQuestions> {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(200, Math.max(1, opts.limit ?? 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { instituteId, isDeleted: false };
    if (opts.category) filter.category = opts.category;
    if (opts.companyName) filter.companyName = opts.companyName;
    if (opts.difficulty) filter.difficulty = opts.difficulty;
    if (opts.search?.trim()) {
      const regex = new RegExp(opts.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ questionText: regex }, { tags: regex }];
    }

    const [data, total] = await Promise.all([
      PracticeQuestion.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean<IPracticeQuestion[]>(),
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
