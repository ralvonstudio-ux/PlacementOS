import mongoose from 'mongoose';
import { TrainingScheduleEntry, ITrainingScheduleEntry } from './training-schedule.model';

export interface FindTrainingScheduleOptions {
  page?: number;
  limit?: number;
  batch?: string;
  track?: string;
  facultyId?: string;
  dayOfWeek?: number;
  placementYear?: string;
}

export interface PaginatedTrainingSchedule {
  data: ITrainingScheduleEntry[];
  meta: { page: number; limit: number; total: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean };
}

export const trainingScheduleRepository = {
  async create(data: Partial<ITrainingScheduleEntry>): Promise<ITrainingScheduleEntry> {
    return TrainingScheduleEntry.create(data);
  },

  async findById(id: string, instituteId: string): Promise<ITrainingScheduleEntry | null> {
    return TrainingScheduleEntry.findOne({ _id: id, instituteId, isDeleted: false });
  },

  async findAll(instituteId: string, options: FindTrainingScheduleOptions = {}): Promise<PaginatedTrainingSchedule> {
    const { page = 1, limit = 50, batch, track, facultyId, dayOfWeek, placementYear } = options;
    const skip = (page - 1) * limit;

    const filter: mongoose.FilterQuery<ITrainingScheduleEntry> = { instituteId, isDeleted: false };
    if (batch) filter.batch = batch;
    if (track) filter.track = track;
    if (facultyId) filter.facultyId = facultyId;
    if (dayOfWeek) filter.dayOfWeek = dayOfWeek;
    if (placementYear) filter.placementYear = placementYear;

    const [data, total] = await Promise.all([
      TrainingScheduleEntry.find(filter).sort({ dayOfWeek: 1, startTime: 1 }).skip(skip).limit(limit),
      TrainingScheduleEntry.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);
    return { data, meta: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 } };
  },

  /** All schedule entries for one faculty member — backs assertFacultyCanAccessQuestionBank /
   *  getFacultyAllowedBatchTracks (unpaginated, since it drives an access check, not a list view). */
  async findByFaculty(instituteId: string, facultyId: string): Promise<ITrainingScheduleEntry[]> {
    return TrainingScheduleEntry.find({ instituteId, facultyId, isDeleted: false }).lean<ITrainingScheduleEntry[]>();
  },

  /** Unpaginated — backs the master grid and conflict scan, which both need
   *  every entry for a placement year in memory at once. */
  async findAllForPlacementYear(instituteId: string, placementYear: string): Promise<ITrainingScheduleEntry[]> {
    return TrainingScheduleEntry.find({ instituteId, placementYear, isDeleted: false }).lean<ITrainingScheduleEntry[]>();
  },

  async findByIds(ids: string[], instituteId: string): Promise<ITrainingScheduleEntry[]> {
    return TrainingScheduleEntry.find({ _id: { $in: ids }, instituteId, isDeleted: false });
  },

  async update(id: string, instituteId: string, data: Partial<ITrainingScheduleEntry>): Promise<ITrainingScheduleEntry | null> {
    return TrainingScheduleEntry.findOneAndUpdate({ _id: id, instituteId, isDeleted: false }, { $set: data }, { new: true });
  },

  async softDelete(id: string, instituteId: string, deletedBy?: string): Promise<boolean> {
    const result = await TrainingScheduleEntry.updateOne(
      { _id: id, instituteId, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date(), deletedBy } }
    );
    return result.modifiedCount > 0;
  },
};
