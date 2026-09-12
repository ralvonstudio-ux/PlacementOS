import { Request, Response, NextFunction } from 'express';
import { tpoService } from './tpo.service';
import { sendSuccess } from '../../lib/response';
import { buildAuthContext } from '../../lib/auth-context';

export const tpoController = {
  async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const data = await tpoService.getDashboard(ctx.instituteId);
      sendSuccess(res, data, 'Dashboard loaded');
    } catch (err) { next(err); }
  },

  async getFacultySummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const date = typeof req.query.date === 'string' ? req.query.date : undefined;
      const data = await tpoService.getFacultySummary(ctx.instituteId, date);
      sendSuccess(res, data, 'Faculty summary loaded');
    } catch (err) { next(err); }
  },

  async getBriefingSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const data = await tpoService.getBriefingSummary(ctx.instituteId);
      sendSuccess(res, data, 'Briefing summary generated');
    } catch (err) { next(err); }
  },

  async getAttendanceInsights(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const data = await tpoService.getAttendanceInsights(ctx.instituteId);
      sendSuccess(res, data, 'Attendance insights loaded');
    } catch (err) { next(err); }
  },
};
