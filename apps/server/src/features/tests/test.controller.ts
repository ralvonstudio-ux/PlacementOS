import { Request, Response, NextFunction } from 'express';
import { testService } from './test.service';
import { sendSuccess, sendCreated } from '../../lib/response';
import { buildAuthContext, AuthContext } from '../../lib/auth-context';
import { resolveClientIp } from '../../lib/client-ip';

// Proctoring needs who/where on every call: IP, browser, and the candidate's per-tab session id.
const ctxOf = (req: Request): AuthContext => ({
  ...buildAuthContext(req.user!, resolveClientIp(req), req.get('user-agent')),
  attemptSessionId: req.get('x-attempt-session') ?? undefined,
});

export const testController = {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = ctxOf(req);
      const test = await testService.create(req.body, ctx);
      sendCreated(res, test, 'Test created as a draft');
    } catch (err) { next(err); }
  },

  async generateDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = ctxOf(req);
      const test = await testService.generateDraft(req.body, ctx);
      sendCreated(res, test, 'Test drafted');
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = ctxOf(req);
      const test = await testService.update(req.params.id, req.body, ctx);
      sendSuccess(res, test, 'Test updated');
    } catch (err) { next(err); }
  },

  async submitForApproval(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = ctxOf(req);
      const test = await testService.submitForApproval(req.params.id, ctx);
      sendSuccess(res, test, 'Submitted for approval');
    } catch (err) { next(err); }
  },

  async review(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = ctxOf(req);
      const test = await testService.review(req.params.id, req.body, ctx);
      sendSuccess(res, test, `Test ${test.status}`);
    } catch (err) { next(err); }
  },

  async createAssignment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = ctxOf(req);
      const assignment = await testService.createAssignment(req.params.id, req.body, ctx);
      sendCreated(res, assignment, 'Test assigned');
    } catch (err) { next(err); }
  },

  async listAssignments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = ctxOf(req);
      const assignments = await testService.listAssignments(req.params.id, ctx);
      sendSuccess(res, assignments);
    } catch (err) { next(err); }
  },

  async listAllAssignments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = ctxOf(req);
      const assignments = await testService.listAllAssignments(ctx);
      sendSuccess(res, assignments);
    } catch (err) { next(err); }
  },

  async sendAssignmentAccessCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = ctxOf(req);
      const result = await testService.sendAssignmentAccessCode(req.params.assignmentId, req.body, ctx);
      sendSuccess(res, result, `Access code sent to ${result.sentCount} candidate(s)`);
    } catch (err) { next(err); }
  },

  async closeAssignment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = ctxOf(req);
      const assignment = await testService.closeAssignment(req.params.assignmentId, ctx);
      sendSuccess(res, assignment, 'Assignment closed');
    } catch (err) { next(err); }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = ctxOf(req);
      const tests = await testService.list(ctx);
      sendSuccess(res, tests);
    } catch (err) { next(err); }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = ctxOf(req);
      await testService.remove(req.params.id, ctx);
      sendSuccess(res, null, 'Test deleted');
    } catch (err) { next(err); }
  },

  async getReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = ctxOf(req);
      const review = await testService.getReview(req.params.id, ctx);
      sendSuccess(res, review);
    } catch (err) { next(err); }
  },

  async listMine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = ctxOf(req);
      const tests = await testService.listMine(ctx);
      sendSuccess(res, tests);
    } catch (err) { next(err); }
  },

  async start(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = ctxOf(req);
      const result = await testService.start(req.params.assignmentId, req.body, ctx);
      sendSuccess(res, result, 'Test started');
    } catch (err) { next(err); }
  },

  async markViewed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = ctxOf(req);
      await testService.markViewed(req.params.attemptId, req.body, ctx);
      sendSuccess(res, null);
    } catch (err) { next(err); }
  },

  async setMediaRequirements(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = ctxOf(req);
      sendSuccess(res, await testService.setMediaRequirements(req.params.id, req.body, ctx), 'Proctoring settings updated');
    } catch (err) { next(err); }
  },

  async getResultAnalysis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = ctxOf(req);
      const analysis = await testService.getResultAnalysis(req.params.id, req.params.attemptId, ctx);
      sendSuccess(res, analysis);
    } catch (err) { next(err); }
  },

  async getMyResult(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = ctxOf(req);
      const analysis = await testService.getMyResultAnalysis(req.params.assignmentId, ctx);
      sendSuccess(res, analysis);
    } catch (err) { next(err); }
  },

  async submitAnswer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = ctxOf(req);
      const attempt = await testService.submitAnswer(req.params.attemptId, req.body, ctx);
      sendSuccess(res, attempt);
    } catch (err) { next(err); }
  },

  async logViolation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = ctxOf(req);
      const result = await testService.logViolation(req.params.attemptId, req.body, ctx);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  },

  async submit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = ctxOf(req);
      const attempt = await testService.submit(req.params.attemptId, ctx);
      sendSuccess(res, attempt, 'Test submitted');
    } catch (err) { next(err); }
  },

  async runCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = ctxOf(req);
      const result = await testService.runCode(req.params.attemptId, req.body, ctx);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  },

  async submitCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = ctxOf(req);
      const result = await testService.submitCode(req.params.attemptId, req.body, ctx);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  },

  async sampleTemplate(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, testService.getSampleTemplate());
    } catch (err) { next(err); }
  },

  async heartbeat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await testService.heartbeat(req.params.attemptId, ctxOf(req)));
    } catch (err) { next(err); }
  },

  async getMonitor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await testService.getMonitor(req.params.id, ctxOf(req)));
    } catch (err) { next(err); }
  },

  async allowNewDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await testService.allowNewDevice(req.params.attemptId, ctxOf(req));
      sendSuccess(res, null, 'The candidate can now resume from their new device');
    } catch (err) { next(err); }
  },

  async forceSubmit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await testService.forceSubmit(req.params.attemptId, ctxOf(req));
      sendSuccess(res, null, 'Attempt ended and submitted');
    } catch (err) { next(err); }
  },
};
