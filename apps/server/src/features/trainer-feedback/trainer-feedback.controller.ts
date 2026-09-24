import { Request, Response, NextFunction } from 'express';
import { trainerFeedbackService } from './trainer-feedback.service';
import { sendSuccess, sendCreated } from '../../lib/response';
import { buildAuthContext } from '../../lib/auth-context';

export const trainerFeedbackController = {
  async submit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const feedback = await trainerFeedbackService.submit(req.body, ctx);
      sendCreated(res, feedback, 'Feedback submitted — thank you!');
    } catch (err) { next(err); }
  },

  async myTrainers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const trainers = await trainerFeedbackService.getEligibleTrainers(ctx);
      sendSuccess(res, trainers);
    } catch (err) { next(err); }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const feedback = await trainerFeedbackService.list(req.query, ctx);
      sendSuccess(res, feedback);
    } catch (err) { next(err); }
  },

  async overview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const overview = await trainerFeedbackService.getOverview(ctx);
      sendSuccess(res, overview);
    } catch (err) { next(err); }
  },
};
