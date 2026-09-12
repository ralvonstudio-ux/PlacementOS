import { Request, Response, NextFunction } from 'express';
import { practiceService } from './practice.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../lib/response';
import { buildAuthContext } from '../../lib/auth-context';

export const practiceController = {
  async listQuestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const result = await practiceService.listQuestions(req.query, ctx, ctx.instituteId);
      sendPaginated(res, result.data, result.meta);
    } catch (err) { next(err); }
  },

  async listCompanies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const companies = await practiceService.listCompanies(ctx.instituteId);
      sendSuccess(res, { companies });
    } catch (err) { next(err); }
  },

  async createQuestion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const question = await practiceService.createQuestion(req.body, ctx);
      sendCreated(res, question, 'Practice question added');
    } catch (err) { next(err); }
  },

  async updateQuestion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const question = await practiceService.updateQuestion(req.params.id, req.body, ctx);
      sendSuccess(res, question, 'Practice question updated');
    } catch (err) { next(err); }
  },

  async deleteQuestion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      await practiceService.deleteQuestion(req.params.id, ctx);
      sendSuccess(res, null, 'Practice question deleted');
    } catch (err) { next(err); }
  },

  async createSheet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const sheet = await practiceService.createSheet(req.body, ctx);
      sendCreated(res, sheet, 'Practice sheet published');
    } catch (err) { next(err); }
  },

  async listSheets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const sheets = await practiceService.listSheets(ctx);
      sendSuccess(res, sheets);
    } catch (err) { next(err); }
  },

  async deleteSheet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      await practiceService.deleteSheet(req.params.id, ctx);
      sendSuccess(res, null, 'Practice sheet deleted');
    } catch (err) { next(err); }
  },

  async listMySheets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const sheets = await practiceService.listMySheets(ctx);
      sendSuccess(res, sheets);
    } catch (err) { next(err); }
  },

  async getMySheetQuestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const questions = await practiceService.getMySheetQuestions(req.params.id, ctx);
      sendSuccess(res, questions);
    } catch (err) { next(err); }
  },
};
