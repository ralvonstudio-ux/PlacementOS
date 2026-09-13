import { ImportSession, IImportSession } from './import-session.model';

export interface FindImportSessionOptions {
  page?: number;
  limit?: number;
  importType?: string;
  status?: string;
}

export interface PaginatedImportSessions {
  data: IImportSession[];
  meta: { page: number; limit: number; total: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean };
}

export const importSessionRepository = {
  async create(data: Partial<IImportSession>): Promise<IImportSession> {
    return ImportSession.create(data);
  },

  async findById(id: string, instituteId: string): Promise<IImportSession | null> {
    return ImportSession.findOne({ _id: id, instituteId });
  },

  async findAll(instituteId: string, options: FindImportSessionOptions = {}): Promise<PaginatedImportSessions> {
    const { page = 1, limit = 20, importType, status } = options;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { instituteId };
    if (importType) filter.importType = importType;
    if (status) filter.status = status;

    const [data, total] = await Promise.all([
      ImportSession.find(filter, { rows: 0 }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      ImportSession.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);
    return { data, meta: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 } };
  },

  async save(session: IImportSession): Promise<IImportSession> {
    return session.save();
  },
};
