import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../lib/response';
import { buildAuthContext } from '../../lib/auth-context';
import { academicPlanService } from './academic-plan.service';

export const academicPlanController = {
  async generate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const plan = await academicPlanService.generate(req.body, ctx);
      sendSuccess(res, plan, 'Academic plan generated');
    } catch (err) { next(err); }
  },

  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const plan = await academicPlanService.get(req.query, ctx);
      sendSuccess(res, plan);
    } catch (err) { next(err); }
  },

  async editSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const plan = await academicPlanService.editSession(req.params.id, req.body, ctx);
      sendSuccess(res, plan, 'Session updated');
    } catch (err) { next(err); }
  },

  async addSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const plan = await academicPlanService.addSession(req.params.id, req.body, ctx);
      sendSuccess(res, plan, 'Session added');
    } catch (err) { next(err); }
  },

  async deleteSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const plan = await academicPlanService.deleteSession(req.params.id, Number(req.params.lectureNumber), ctx);
      sendSuccess(res, plan, 'Session removed');
    } catch (err) { next(err); }
  },

  async reorderSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const plan = await academicPlanService.reorderSessions(req.params.id, req.body, ctx);
      sendSuccess(res, plan, 'Plan reordered');
    } catch (err) { next(err); }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      await academicPlanService.remove(req.params.id, ctx);
      sendSuccess(res, null, 'Academic plan deleted');
    } catch (err) { next(err); }
  },
};
