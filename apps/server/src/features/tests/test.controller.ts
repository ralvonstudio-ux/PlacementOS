import { Request, Response, NextFunction } from 'express';
import { testService } from './test.service';
import { sendSuccess, sendCreated } from '../../lib/response';
import { buildAuthContext } from '../../lib/auth-context';

export const testController = {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const test = await testService.create(req.body, ctx);
      sendCreated(res, test, 'Test created as a draft');
    } catch (err) { next(err); }
  },

  async generateDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const test = await testService.generateDraft(req.body, ctx);
      sendCreated(res, test, 'Test drafted');
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const test = await testService.update(req.params.id, req.body, ctx);
      sendSuccess(res, test, 'Test updated');
    } catch (err) { next(err); }
  },

  async submitForApproval(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const test = await testService.submitForApproval(req.params.id, ctx);
      sendSuccess(res, test, 'Submitted for approval');
    } catch (err) { next(err); }
  },

  async review(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const test = await testService.review(req.params.id, req.body, ctx);
      sendSuccess(res, test, `Test ${test.status}`);
    } catch (err) { next(err); }
  },

  async publish(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const test = await testService.publish(req.params.id, ctx);
      sendSuccess(res, test, 'Test published to the batch');
    } catch (err) { next(err); }
  },

  async close(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const test = await testService.close(req.params.id, ctx);
      sendSuccess(res, test, 'Test closed');
    } catch (err) { next(err); }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const batch = typeof req.query.batch === 'string' ? req.query.batch : undefined;
      const tests = await testService.list(ctx, batch);
      sendSuccess(res, tests);
    } catch (err) { next(err); }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      await testService.remove(req.params.id, ctx);
      sendSuccess(res, null, 'Test deleted');
    } catch (err) { next(err); }
  },

  async getReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const review = await testService.getReview(req.params.id, ctx);
      sendSuccess(res, review);
    } catch (err) { next(err); }
  },

  async listMine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const tests = await testService.listMine(ctx);
      sendSuccess(res, tests);
    } catch (err) { next(err); }
  },

  async start(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const result = await testService.start(req.params.id, ctx);
      sendSuccess(res, result, 'Test started');
    } catch (err) { next(err); }
  },

  async submitAnswer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const attempt = await testService.submitAnswer(req.params.attemptId, req.body, ctx);
      sendSuccess(res, attempt);
    } catch (err) { next(err); }
  },

  async logViolation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const result = await testService.logViolation(req.params.attemptId, req.body, ctx);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  },

  async submit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const attempt = await testService.submit(req.params.attemptId, ctx);
      sendSuccess(res, attempt, 'Test submitted');
    } catch (err) { next(err); }
  },
};
