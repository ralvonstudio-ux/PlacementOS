import { Request, Response, NextFunction } from 'express';
import { attendanceService } from './attendance.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../lib/response';
import { buildAuthContext } from '../../lib/auth-context';

export const attendanceController = {
  /** POST /attendance — mark single */
  async markSingle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!);
      const record = await attendanceService.markSingle(req.body, ctx);
      sendCreated(res, record, 'Attendance marked');
    } catch (err) { next(err); }
  },

  /** POST /attendance/bulk — bulk submit for a batch/track */
  async bulkMark(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!);
      const records = await attendanceService.bulkMark(req.body, ctx);
      sendCreated(res, records, `${records.length} attendance records saved`);
    } catch (err) { next(err); }
  },

  /** GET /attendance — list with filters */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!);
      const result = await attendanceService.listAll(req.query, ctx);
      sendPaginated(res, result.records, { page: result.page, limit: result.limit, total: result.total });
    } catch (err) { next(err); }
  },

  /** GET /attendance/:id */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!);
      const record = await attendanceService.getById(req.params.id, ctx);
      sendSuccess(res, record);
    } catch (err) { next(err); }
  },

  /** PATCH /attendance/:id */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!);
      const record = await attendanceService.update(req.params.id, req.body, ctx);
      sendSuccess(res, record, 'Attendance updated');
    } catch (err) { next(err); }
  },

  /** DELETE /attendance/:id */
  async deleteRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!);
      await attendanceService.deleteRecord(req.params.id, ctx);
      sendSuccess(res, null, 'Attendance record deleted');
    } catch (err) { next(err); }
  },

  /** GET /attendance/batch/:batch/:track — all records for a batch/track on a date */
  async getBatchAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!);
      const records = await attendanceService.getBatchAttendance(req.params.batch, req.params.track, req.query, ctx);
      sendSuccess(res, records);
    } catch (err) { next(err); }
  },

  /** GET /attendance/candidate/:candidateId — paginated history */
  async getCandidateHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!);
      const result = await attendanceService.getCandidateHistory(req.params.candidateId, req.query, ctx);
      sendPaginated(res, result.records, { page: result.page, limit: result.limit, total: result.total });
    } catch (err) { next(err); }
  },

  /** GET /attendance/summary — aggregate stats */
  async getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!);
      const summary = await attendanceService.getSummary(req.query, ctx);
      sendSuccess(res, summary);
    } catch (err) { next(err); }
  },

  /** GET /attendance/batch-overview — TPO Attendance page, Batches tab */
  async getBatchOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!);
      const overview = await attendanceService.getBatchOverview(req.query, ctx);
      sendSuccess(res, overview);
    } catch (err) { next(err); }
  },

  /** GET /attendance/faculty-overview — TPO Attendance page, Faculty tab */
  async getFacultyOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!);
      const overview = await attendanceService.getFacultyOverview(req.query, ctx);
      sendSuccess(res, overview);
    } catch (err) { next(err); }
  },
};
