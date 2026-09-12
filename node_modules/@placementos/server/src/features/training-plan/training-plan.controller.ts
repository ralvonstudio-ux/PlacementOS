import { Request, Response, NextFunction } from 'express';
import { trainingPlanService } from './training-plan.service';
import { sendSuccess } from '../../lib/response';
import { buildAuthContext } from '../../lib/auth-context';

export const trainingPlanController = {
  async generate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const result = await trainingPlanService.generate(req.body, ctx);
      sendSuccess(res, result, 'Training plan generated');
    } catch (err) { next(err); }
  },

  async getWeek(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const plan = await trainingPlanService.getWeek(req.query, ctx);
      sendSuccess(res, plan);
    } catch (err) { next(err); }
  },

  async getMonth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const weeks = await trainingPlanService.getMonth(req.query, ctx);
      sendSuccess(res, weeks);
    } catch (err) { next(err); }
  },

  async setDayStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const plan = await trainingPlanService.setDayStatus(req.params.id, req.body, ctx);
      sendSuccess(res, plan, 'Day status updated');
    } catch (err) { next(err); }
  },

  async editDay(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const plan = await trainingPlanService.editDay(req.params.id, req.body, ctx);
      sendSuccess(res, plan, 'Day updated');
    } catch (err) { next(err); }
  },

  async moveDay(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const plan = await trainingPlanService.moveDay(req.params.id, req.body, ctx);
      sendSuccess(res, plan, 'Day moved');
    } catch (err) { next(err); }
  },

  async getForFaculty(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const plan = await trainingPlanService.getForFaculty(req.params.facultyId, req.query, ctx);
      sendSuccess(res, plan);
    } catch (err) { next(err); }
  },

  async getTpoOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const overview = await trainingPlanService.getTpoOverview(ctx);
      sendSuccess(res, overview);
    } catch (err) { next(err); }
  },

  async listAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const alerts = await trainingPlanService.getAlerts(ctx);
      sendSuccess(res, alerts);
    } catch (err) { next(err); }
  },

  async resolveAlert(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const alert = await trainingPlanService.resolveAlert(req.params.alertId, ctx);
      sendSuccess(res, alert, 'Alert resolved');
    } catch (err) { next(err); }
  },
};
