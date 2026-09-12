import { Worksheet, IWorksheet, IWorksheetQuestion, WorksheetType } from './worksheet.model';

export interface WorksheetListOptions {
  page?: number;
  limit?: number;
  batch?: string;
  track?: string;
  trainingModuleId?: string;
  worksheetType?: WorksheetType;
}

export interface PaginatedWorksheets {
  worksheets: IWorksheet[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateWorksheetData {
  instituteId: string;
  facultyId: string;
  batch: string;
  track: string;
  trainingModuleIds: string[];
  trainingModuleNames: string[];
  worksheetType: WorksheetType;
  title: string;
  questions: IWorksheetQuestion[];
  createdBy: string;
}

export const worksheetRepository = {
  async create(data: CreateWorksheetData): Promise<IWorksheet> {
    return Worksheet.create(data);
  },

  /** Scoped to instituteId + batch/track (when given), NOT facultyId — a worksheet belongs to the
   *  batch/track it was made for. Pass `facultyId` only to further narrow to "my own worksheets". */
  async findAll(instituteId: string, facultyId: string | undefined, opts: WorksheetListOptions = {}): Promise<PaginatedWorksheets> {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { instituteId, isDeleted: false };
    if (facultyId) query.facultyId = facultyId;
    if (opts.batch) query.batch = opts.batch;
    if (opts.track) query.track = opts.track;
    if (opts.trainingModuleId) query.trainingModuleIds = opts.trainingModuleId;
    if (opts.worksheetType) query.worksheetType = opts.worksheetType;

    const [worksheets, total] = await Promise.all([
      Worksheet.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean<IWorksheet[]>(),
      Worksheet.countDocuments(query),
    ]);

    return { worksheets, total, page, limit };
  },

  async findById(id: string, instituteId: string): Promise<IWorksheet | null> {
    return Worksheet.findOne({ _id: id, instituteId, isDeleted: false }).lean<IWorksheet>();
  },

  async softDelete(id: string, instituteId: string): Promise<boolean> {
    const res = await Worksheet.updateOne({ _id: id, instituteId, isDeleted: false }, { $set: { isDeleted: true, deletedAt: new Date() } });
    return res.modifiedCount > 0;
  },

  async update(id: string, instituteId: string, patch: { title?: string; questions?: IWorksheetQuestion[] }): Promise<IWorksheet | null> {
    return Worksheet.findOneAndUpdate({ _id: id, instituteId, isDeleted: false }, { $set: patch }, { new: true }).lean<IWorksheet>();
  },
};
