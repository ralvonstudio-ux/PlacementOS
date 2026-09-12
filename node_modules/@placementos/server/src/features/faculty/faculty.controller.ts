import { Request, Response, NextFunction } from 'express';
import { facultyService } from './faculty.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../lib/response';
import { buildAuthContext } from '../../lib/auth-context';

export const facultyController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
      const track = typeof req.query.track === 'string' ? req.query.track : undefined;
      const batch = typeof req.query.batch === 'string' ? req.query.batch : undefined;

      const result = await facultyService.list(req.user!.instituteId, { page, limit, search, track, batch });
      sendPaginated(res, result.data, result.meta);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const faculty = await facultyService.getById(req.params.id, req.user!.instituteId);
      sendSuccess(res, faculty, 'Faculty fetched successfully');
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const faculty = await facultyService.create(req.body, ctx);
      sendCreated(res, faculty, 'Faculty created successfully');
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const faculty = await facultyService.update(req.params.id, req.body, ctx);
      sendSuccess(res, faculty, 'Faculty updated successfully');
    } catch (err) {
      next(err);
    }
  },

  async changeStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const faculty = await facultyService.changeStatus(req.params.id, req.body, ctx);
      sendSuccess(res, faculty, 'Faculty status updated');
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      await facultyService.remove(req.params.id, ctx);
      sendSuccess(res, null, 'Faculty deleted successfully');
    } catch (err) {
      next(err);
    }
  },

  async createLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const result = await facultyService.createLogin(req.params.id, req.body, ctx);
      sendCreated(res, result, 'Login created successfully');
    } catch (err) {
      next(err);
    }
  },
};
