import { TimetableSubstitute, ITimetableSubstitute } from './training-schedule.substitute.model';

export interface FindSubstituteOptions {
  page?: number;
  limit?: number;
  date?: string;
  status?: string;
  facultyId?: string;
}

export interface PaginatedSubstitutes {
  data: ITimetableSubstitute[];
  meta: { page: number; limit: number; total: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean };
}

export const substituteRepository = {
  async findAll(instituteId: string, options: FindSubstituteOptions = {}): Promise<PaginatedSubstitutes> {
    const { page = 1, limit = 50, date, status, facultyId } = options;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { instituteId };
    if (date) filter.date = date;
    if (status) filter.status = status;
    if (facultyId) filter.$or = [{ originalFacultyId: facultyId }, { substituteFacultyId: facultyId }];

    const [data, total] = await Promise.all([
      TimetableSubstitute.find(filter).sort({ date: -1 }).skip(skip).limit(limit),
      TimetableSubstitute.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);
    return { data, meta: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 } };
  },

  async findByEntryAndDate(instituteId: string, entryId: string, date: string): Promise<ITimetableSubstitute | null> {
    return TimetableSubstitute.findOne({ instituteId, entryId, date });
  },

  async create(data: Partial<ITimetableSubstitute>): Promise<ITimetableSubstitute> {
    return TimetableSubstitute.create(data);
  },

  async update(id: string, instituteId: string, data: Partial<ITimetableSubstitute>): Promise<ITimetableSubstitute | null> {
    return TimetableSubstitute.findOneAndUpdate({ _id: id, instituteId }, { $set: data }, { new: true });
  },

  async remove(id: string, instituteId: string): Promise<boolean> {
    const result = await TimetableSubstitute.deleteOne({ _id: id, instituteId });
    return result.deletedCount > 0;
  },
};
