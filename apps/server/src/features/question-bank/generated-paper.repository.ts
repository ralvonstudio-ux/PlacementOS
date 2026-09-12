import { PaperGenerationConfig, PaperValidationResult } from '@placementos/types';
import { GeneratedPaperModel, IGeneratedPaper } from './generated-paper.model';

export interface CreatePaperData {
  instituteId: string;
  config: PaperGenerationConfig;
  questionIds: string[];
  sectionSizes?: number[];
  totalMarksAssembled: number;
  validation: PaperValidationResult;
  createdBy: string;
}

export interface PaperListOptions {
  batch?: string;
  track?: string;
  page?: number;
  limit?: number;
  batchTrackPairs?: { batch: string; track: string }[];
}

export interface PaginatedPapers {
  papers: IGeneratedPaper[];
  total: number;
  page: number;
  limit: number;
}

export const generatedPaperRepository = {
  async create(data: CreatePaperData): Promise<IGeneratedPaper> {
    return GeneratedPaperModel.create(data);
  },

  async findById(id: string, instituteId: string): Promise<IGeneratedPaper | null> {
    return GeneratedPaperModel.findOne({ _id: id, instituteId, isDeleted: { $ne: true } }).lean<IGeneratedPaper>();
  },

  /** batch/track aren't top-level fields on this model (they live inside the `config` Mixed blob) — queried by dot-path. */
  async findAll(instituteId: string, opts: PaperListOptions = {}): Promise<PaginatedPapers> {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { instituteId, isDeleted: { $ne: true } };
    if (opts.batch) query['config.batch'] = opts.batch;
    if (opts.track) query['config.track'] = opts.track;
    if (!opts.batch && !opts.track && opts.batchTrackPairs && opts.batchTrackPairs.length > 0) {
      query.$or = opts.batchTrackPairs.map((p) => ({ 'config.batch': p.batch, 'config.track': p.track }));
    }

    const [papers, total] = await Promise.all([
      GeneratedPaperModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean<IGeneratedPaper[]>(),
      GeneratedPaperModel.countDocuments(query),
    ]);

    return { papers, total, page, limit };
  },

  /** Every generated paper in the institute, across every batch/track — backs the TPO overview. */
  async findAllForInstitute(instituteId: string): Promise<IGeneratedPaper[]> {
    return GeneratedPaperModel.find({ instituteId, isDeleted: { $ne: true } }).lean<IGeneratedPaper[]>();
  },

  async softDelete(id: string, instituteId: string): Promise<boolean> {
    const res = await GeneratedPaperModel.updateOne({ _id: id, instituteId, isDeleted: { $ne: true } }, { $set: { isDeleted: true, deletedAt: new Date() } });
    return res.modifiedCount > 0;
  },
};
