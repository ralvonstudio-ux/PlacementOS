import mongoose from 'mongoose';
import { Faculty, IFaculty } from './faculty.model';

export interface FindFacultyOptions {
  page?: number;
  limit?: number;
  search?: string;
  track?: string;
  batch?: string;
}

export interface PaginatedFaculty {
  data: IFaculty[];
  meta: { page: number; limit: number; total: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean };
}

export const facultyRepository = {
  async create(data: Partial<IFaculty>): Promise<IFaculty> {
    return Faculty.create(data);
  },

  async findById(id: string, instituteId: string): Promise<IFaculty | null> {
    return Faculty.findOne({ _id: id, instituteId, isDeleted: false });
  },

  async findByEmployeeId(employeeId: string, instituteId: string): Promise<IFaculty | null> {
    return Faculty.findOne({ employeeId, instituteId, isDeleted: false });
  },

  async findAll(instituteId: string, options: FindFacultyOptions = {}): Promise<PaginatedFaculty> {
    const { page = 1, limit = 20, search, track, batch } = options;
    const skip = (page - 1) * limit;

    const filter: mongoose.FilterQuery<IFaculty> = { instituteId, isDeleted: false };
    if (track) filter.tracks = track;
    if (batch) filter.assignedBatches = batch;
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [{ fullName: regex }, { employeeId: regex }, { email: regex }, { phone: regex }];
    }

    const [data, total] = await Promise.all([
      Faculty.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Faculty.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);
    return { data, meta: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 } };
  },

  async update(id: string, instituteId: string, data: Partial<IFaculty>): Promise<IFaculty | null> {
    return Faculty.findOneAndUpdate({ _id: id, instituteId, isDeleted: false }, { $set: data }, { new: true });
  },

  async softDelete(id: string, instituteId: string, deletedBy?: string): Promise<boolean> {
    const result = await Faculty.updateOne(
      { _id: id, instituteId, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date(), deletedBy } }
    );
    return result.modifiedCount > 0;
  },

  /** Faculty who teach a given batch+track, per Training Schedule — used as a
   *  fallback list when no Training Schedule entries exist yet for a batch/track. */
  async findByTrack(instituteId: string, track: string): Promise<IFaculty[]> {
    return Faculty.find({ instituteId, tracks: track, isDeleted: false });
  },
};
