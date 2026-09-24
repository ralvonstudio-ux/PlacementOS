import mongoose from 'mongoose';
import { Candidate, ICandidate } from './candidate.model';

export interface FindCandidateOptions {
  page?: number;
  limit?: number;
  search?: string;
  batch?: string;
  department?: string;
  placementYear?: string;
  status?: ICandidate['status'];
}

export interface PaginatedCandidates {
  data: ICandidate[];
  meta: { page: number; limit: number; total: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean };
}

export const candidateRepository = {
  async create(data: Partial<ICandidate>): Promise<ICandidate> {
    return Candidate.create(data);
  },

  async findById(id: string, instituteId: string): Promise<ICandidate | null> {
    return Candidate.findOne({ _id: id, instituteId, isDeleted: false });
  },

  async findByRollNumber(rollNumber: string, instituteId: string): Promise<ICandidate | null> {
    return Candidate.findOne({ rollNumber, instituteId, isDeleted: false });
  },

  /** Every distinct batch/class with at least one active candidate — backs batch pickers
   *  (e.g. the Messages "Send to students" dropdown) instead of staff typing a batch by hand. */
  async findDistinctBatches(instituteId: string): Promise<string[]> {
    const batches = await Candidate.distinct('batch', { instituteId, isDeleted: false, status: 'active' });
    return (batches as string[]).sort((a, b) => a.localeCompare(b));
  },

  async findByLoginEmail(loginEmail: string, instituteId: string): Promise<ICandidate | null> {
    return Candidate.findOne({ loginEmail, instituteId, isDeleted: false }).lean<ICandidate>();
  },

  async findAll(instituteId: string, options: FindCandidateOptions = {}): Promise<PaginatedCandidates> {
    const { page = 1, limit = 20, search, batch, department, placementYear, status } = options;
    const skip = (page - 1) * limit;

    const filter: mongoose.FilterQuery<ICandidate> = { instituteId, isDeleted: false };
    if (batch) filter.batch = batch;
    if (department) filter.department = department;
    if (placementYear) filter.placementYear = placementYear;
    if (status) filter.status = status;
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [{ fullName: regex }, { rollNumber: regex }, { email: regex }, { phone: regex }];
    }

    const [data, total] = await Promise.all([
      Candidate.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Candidate.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);
    return { data, meta: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 } };
  },

  /** All candidates in a batch — used by attendance's bulk-mark flow to build a roster. */
  async findByBatch(instituteId: string, batch: string): Promise<ICandidate[]> {
    return Candidate.find({ instituteId, batch, isDeleted: false }).lean<ICandidate[]>();
  },

  /** Minimal lookup for a known set of ids — backs name-resolution in reports (e.g. test attempt review). */
  async findAllForSchoolByIds(ids: string[], instituteId: string): Promise<ICandidate[]> {
    if (ids.length === 0) return [];
    return Candidate.find({ _id: { $in: ids }, instituteId }).select('fullName rollNumber batch').lean<ICandidate[]>();
  },

  async update(id: string, instituteId: string, data: Partial<ICandidate>): Promise<ICandidate | null> {
    return Candidate.findOneAndUpdate({ _id: id, instituteId, isDeleted: false }, { $set: data }, { new: true });
  },

  async softDelete(id: string, instituteId: string, deletedBy?: string): Promise<boolean> {
    const result = await Candidate.updateOne(
      { _id: id, instituteId, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date(), deletedBy } }
    );
    return result.modifiedCount > 0;
  },
};
