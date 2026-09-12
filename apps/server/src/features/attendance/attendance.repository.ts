import { Attendance, IAttendance, AttendanceStatus } from './attendance.model';

export interface UpsertAttendanceData {
  candidateId: string;
  instituteId: string;
  batch: string;
  track: string;
  date: string;
  status: AttendanceStatus;
  note?: string;
  markedBy: string;
}

export interface FindAttendanceOptions {
  page?: number;
  limit?: number;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  batch?: string;
  track?: string;
  status?: AttendanceStatus;
  candidateId?: string;
}

export interface PaginatedAttendance {
  records: IAttendance[];
  total: number;
  page: number;
  limit: number;
}

export interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceRate: number;
}

export const attendanceRepository = {
  /** Upsert keyed on (instituteId, candidateId, track, date) — matches the model's unique index. */
  async upsert(data: UpsertAttendanceData): Promise<IAttendance> {
    return Attendance.findOneAndUpdate(
      { instituteId: data.instituteId, candidateId: data.candidateId, track: data.track, date: data.date, isDeleted: false },
      {
        $set: {
          batch: data.batch,
          status: data.status,
          note: data.note,
          markedBy: data.markedBy,
        },
        $setOnInsert: {
          instituteId: data.instituteId,
          candidateId: data.candidateId,
          track: data.track,
          date: data.date,
          isDeleted: false,
        },
      },
      { new: true, upsert: true, runValidators: true }
    ).lean<IAttendance>() as unknown as IAttendance;
  },

  /** One bulkWrite round trip for the whole roster instead of N sequential upserts. */
  async bulkUpsert(records: UpsertAttendanceData[]): Promise<IAttendance[]> {
    if (records.length === 0) return [];

    await Attendance.bulkWrite(
      records.map((r) => ({
        updateOne: {
          filter: { instituteId: r.instituteId, candidateId: r.candidateId, track: r.track, date: r.date, isDeleted: false },
          update: {
            $set: { batch: r.batch, status: r.status, note: r.note, markedBy: r.markedBy },
            $setOnInsert: { instituteId: r.instituteId, candidateId: r.candidateId, track: r.track, date: r.date, isDeleted: false },
          },
          upsert: true,
        },
      })),
      { ordered: false }
    );

    const candidateIds = records.map((r) => r.candidateId);
    const { instituteId, track, date } = records[0];
    const written = await Attendance.find({ instituteId, candidateId: { $in: candidateIds }, track, date, isDeleted: false }).lean<IAttendance[]>();
    const byCandidateId = new Map(written.map((doc) => [doc.candidateId, doc]));
    return records.map((r) => byCandidateId.get(r.candidateId)).filter((doc): doc is IAttendance => !!doc);
  },

  async findById(id: string, instituteId: string): Promise<IAttendance | null> {
    return Attendance.findOne({ _id: id, instituteId, isDeleted: false }).lean<IAttendance>();
  },

  async update(id: string, instituteId: string, data: { status?: AttendanceStatus; note?: string }): Promise<IAttendance | null> {
    return Attendance.findOneAndUpdate(
      { _id: id, instituteId, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    ).lean<IAttendance>();
  },

  async softDelete(id: string, instituteId: string, deletedBy: string): Promise<boolean> {
    const result = await Attendance.updateOne(
      { _id: id, instituteId, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date(), deletedBy } }
    );
    return result.modifiedCount > 0;
  },

  /** All records for a batch+track on a specific date. */
  async findByBatchTrackDate(instituteId: string, batch: string, track: string, date: string): Promise<IAttendance[]> {
    return Attendance.find({ instituteId, batch, track, date, isDeleted: false }).sort({ createdAt: 1 }).lean<IAttendance[]>();
  },

  /** Full attendance history for one candidate with pagination. */
  async findByCandidate(
    instituteId: string,
    candidateId: string,
    opts: { page: number; limit: number; dateFrom?: string; dateTo?: string; status?: AttendanceStatus }
  ): Promise<PaginatedAttendance> {
    const page = Math.max(1, opts.page);
    const limit = Math.min(400, Math.max(1, opts.limit));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { instituteId, candidateId, isDeleted: false };
    if (opts.dateFrom || opts.dateTo) {
      const dateRange: Record<string, string> = {};
      if (opts.dateFrom) dateRange.$gte = opts.dateFrom;
      if (opts.dateTo) dateRange.$lte = opts.dateTo;
      query.date = dateRange;
    }
    if (opts.status) query.status = opts.status;

    const [records, total] = await Promise.all([
      Attendance.find(query).sort({ date: -1 }).skip(skip).limit(limit).lean<IAttendance[]>(),
      Attendance.countDocuments(query),
    ]);

    return { records, total, page, limit };
  },

  /** Paginated list with full filter support. */
  async findAll(instituteId: string, opts: FindAttendanceOptions): Promise<PaginatedAttendance> {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(500, Math.max(1, opts.limit ?? 50));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { instituteId, isDeleted: false };

    if (opts.date) {
      query.date = opts.date;
    } else if (opts.dateFrom || opts.dateTo) {
      const dateRange: Record<string, string> = {};
      if (opts.dateFrom) dateRange.$gte = opts.dateFrom;
      if (opts.dateTo) dateRange.$lte = opts.dateTo;
      query.date = dateRange;
    }
    if (opts.batch) query.batch = opts.batch;
    if (opts.track) query.track = opts.track;
    if (opts.status) query.status = opts.status;
    if (opts.candidateId) query.candidateId = opts.candidateId;

    const [records, total] = await Promise.all([
      Attendance.find(query).sort({ date: -1, batch: 1, track: 1 }).skip(skip).limit(limit).lean<IAttendance[]>(),
      Attendance.countDocuments(query),
    ]);

    return { records, total, page, limit };
  },

  /** Aggregate counts for summary stats. */
  async getSummary(
    instituteId: string,
    opts: { candidateId?: string; batch?: string; track?: string; dateFrom?: string; dateTo?: string }
  ): Promise<AttendanceSummary> {
    const match: Record<string, unknown> = { instituteId, isDeleted: false };

    if (opts.candidateId) match.candidateId = opts.candidateId;
    if (opts.batch) match.batch = opts.batch;
    if (opts.track) match.track = opts.track;
    if (opts.dateFrom || opts.dateTo) {
      const dateRange: Record<string, string> = {};
      if (opts.dateFrom) dateRange.$gte = opts.dateFrom;
      if (opts.dateTo) dateRange.$lte = opts.dateTo;
      match.date = dateRange;
    }

    const agg = await Attendance.aggregate<{ _id: string; count: number }>([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const counts: Record<string, number> = {};
    for (const row of agg) counts[row._id] = row.count;

    const present = counts.present ?? 0;
    const absent = counts.absent ?? 0;
    const late = counts.late ?? 0;
    const excused = counts.excused ?? 0;
    const total = present + absent + late + excused;
    const attendanceRate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    return { total, present, absent, late, excused, attendanceRate };
  },

  /** Per-batch/track attendance rate for a single date — backs the TPO batch overview. */
  async getBatchBreakdown(
    instituteId: string,
    date: string
  ): Promise<{ batch: string; track: string; total: number; present: number }[]> {
    const agg = await Attendance.aggregate<{
      _id: { batch: string; track: string; status: string };
      count: number;
    }>([
      { $match: { instituteId, date, isDeleted: false } },
      { $group: { _id: { batch: '$batch', track: '$track', status: '$status' }, count: { $sum: 1 } } },
    ]);

    const byBatchTrack = new Map<string, { batch: string; track: string; total: number; present: number }>();
    for (const row of agg) {
      const key = `${row._id.batch}::${row._id.track}`;
      const entry = byBatchTrack.get(key) ?? { batch: row._id.batch, track: row._id.track, total: 0, present: 0 };
      entry.total += row.count;
      if (row._id.status === 'present' || row._id.status === 'late') entry.present += row.count;
      byBatchTrack.set(key, entry);
    }

    return Array.from(byBatchTrack.values());
  },

  /** Per-batch/track attendance rate across a date range — backs the TPO's attendance insights
   *  widget (lowest-attendance batches/tracks first). */
  async getBatchTrackRatesInRange(
    instituteId: string,
    dateFrom: string,
    dateTo: string
  ): Promise<{ batch: string; track: string; total: number; present: number }[]> {
    const agg = await Attendance.aggregate<{
      _id: { batch: string; track: string; status: string };
      count: number;
    }>([
      { $match: { instituteId, date: { $gte: dateFrom, $lte: dateTo }, isDeleted: false } },
      { $group: { _id: { batch: '$batch', track: '$track', status: '$status' }, count: { $sum: 1 } } },
    ]);

    const byBatchTrack = new Map<string, { batch: string; track: string; total: number; present: number }>();
    for (const row of agg) {
      const key = `${row._id.batch}::${row._id.track}`;
      const entry = byBatchTrack.get(key) ?? { batch: row._id.batch, track: row._id.track, total: 0, present: 0 };
      entry.total += row.count;
      if (row._id.status === 'present' || row._id.status === 'late') entry.present += row.count;
      byBatchTrack.set(key, entry);
    }

    return Array.from(byBatchTrack.values());
  },

  /** Whether any attendance record exists for a batch/track/date — backs "not_marked" detection. */
  async existsForBatchTrackDate(instituteId: string, batch: string, track: string, date: string): Promise<boolean> {
    const doc = await Attendance.exists({ instituteId, batch, track, date, isDeleted: false });
    return !!doc;
  },

  /** Distinct tracks a faculty member marked attendance for on a date — backs faculty overview "present/not_marked". */
  async findMarkedTracksByFacultyOnDate(instituteId: string, markedBy: string, date: string): Promise<string[]> {
    return Attendance.distinct('track', { instituteId, markedBy, date, isDeleted: false });
  },

  /** Today's date in YYYY-MM-DD, in IST — independent of the server host's timezone. */
  todayString(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  },

  /** YYYY-MM-DD, `n` days before today, in IST — for windows like "last 7 days" that must line up
   *  with todayString() (no DST in India, so a plain day shift is safe). */
  daysAgoString(n: number): string {
    const d = new Date(`${this.todayString()}T00:00:00+05:30`);
    d.setDate(d.getDate() - n);
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  },
};
