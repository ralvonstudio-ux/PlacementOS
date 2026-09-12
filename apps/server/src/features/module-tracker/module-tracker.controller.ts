import { Request, Response, NextFunction } from 'express';
import { moduleTrackerService } from './module-tracker.service';
import { sendSuccess, sendCreated } from '../../lib/response';
import { buildAuthContext } from '../../lib/auth-context';

export const moduleTrackerController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const modules = await moduleTrackerService.list(req.query, ctx);
      sendSuccess(res, modules);
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const module_ = await moduleTrackerService.create(req.body, ctx);
      sendCreated(res, module_, 'Training module created');
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const module_ = await moduleTrackerService.update(req.params.id, req.body, ctx);
      sendSuccess(res, module_, 'Training module updated');
    } catch (err) { next(err); }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      await moduleTrackerService.remove(req.params.id, ctx);
      sendSuccess(res, null, 'Training module deleted');
    } catch (err) { next(err); }
  },

  async getCoverage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const coverage = await moduleTrackerService.getCoverage(req.query, ctx);
      sendSuccess(res, coverage);
    } catch (err) { next(err); }
  },

  async setProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const progress = await moduleTrackerService.setProgress(req.params.moduleId, req.body, ctx);
      sendSuccess(res, progress, 'Progress updated');
    } catch (err) { next(err); }
  },
};
