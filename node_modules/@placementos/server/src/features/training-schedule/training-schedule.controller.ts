import { Request, Response, NextFunction } from 'express';
import { trainingScheduleService } from './training-schedule.service';
import { listTrainingScheduleSchema } from './training-schedule.validation';
import { sendSuccess, sendCreated, sendPaginated } from '../../lib/response';
import { buildAuthContext } from '../../lib/auth-context';

export const trainingScheduleController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const query = listTrainingScheduleSchema.parse(req.query);
      const result = await trainingScheduleService.list(ctx, query);
      sendPaginated(res, result.data, result.meta);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const entry = await trainingScheduleService.getById(req.params.id, ctx);
      sendSuccess(res, entry);
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const entry = await trainingScheduleService.create(req.body, ctx);
      sendCreated(res, entry, 'Training schedule entry created');
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const entry = await trainingScheduleService.update(req.params.id, req.body, ctx);
      sendSuccess(res, entry, 'Training schedule entry updated');
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      await trainingScheduleService.remove(req.params.id, ctx);
      sendSuccess(res, null, 'Training schedule entry deleted');
    } catch (err) {
      next(err);
    }
  },
};
