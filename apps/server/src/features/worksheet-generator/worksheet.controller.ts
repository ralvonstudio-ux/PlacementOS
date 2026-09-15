import { Request, Response, NextFunction } from 'express';
import { buildAuthContext } from '../../lib/auth-context';
import { sendSuccess, sendCreated, sendPaginated } from '../../lib/response';
import { ValidationError } from '../../middlewares/errorHandler';
import { worksheetService } from './worksheet.service';
import {
  generateWorksheetSchema, generateWorksheetFromContentSchema, saveWorksheetSchema,
  listWorksheetsSchema, updateWorksheetSchema, uploadWorksheetSchema,
} from './worksheet.validation';

export const worksheetController = {
  /** POST /worksheet-generator/generate — pulls from the bank + AI-fills any shortfall, never saved */
  async generate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = generateWorksheetSchema.parse(req.body);
      const ctx = buildAuthContext(req.user!);
      const result = await worksheetService.generate(input, ctx);
      sendSuccess(res, result, 'Worksheet drafted');
    } catch (err) { next(err); }
  },

  /** POST /worksheet-generator/generate-from-content — fully AI-authored from pasted/uploaded content, never saved */
  async generateFromContent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = generateWorksheetFromContentSchema.parse(req.body);
      const ctx = buildAuthContext(req.user!);
      const result = await worksheetService.generateFromContent(input, ctx);
      sendSuccess(res, result, 'Worksheet drafted');
    } catch (err) { next(err); }
  },

  /** POST /worksheet-generator — save the reviewed/edited draft */
  async save(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = saveWorksheetSchema.parse(req.body);
      const ctx = buildAuthContext(req.user!);
      const worksheet = await worksheetService.save(data, ctx);
      sendCreated(res, worksheet, 'Worksheet saved');
    } catch (err) { next(err); }
  },

  /** GET /worksheet-generator */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listWorksheetsSchema.parse(req.query);
      const ctx = buildAuthContext(req.user!);
      const result = await worksheetService.list(query, ctx);
      sendPaginated(res, result.worksheets, { page: result.page, limit: result.limit, total: result.total });
    } catch (err) { next(err); }
  },

  /** GET /worksheet-generator/:id */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!);
      const worksheet = await worksheetService.getById(req.params.id, ctx);
      sendSuccess(res, worksheet);
    } catch (err) { next(err); }
  },

  /** PATCH /worksheet-generator/:id */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = updateWorksheetSchema.parse(req.body);
      const ctx = buildAuthContext(req.user!);
      const worksheet = await worksheetService.update(req.params.id, data, ctx);
      sendSuccess(res, worksheet, 'Worksheet updated');
    } catch (err) { next(err); }
  },

  /** DELETE /worksheet-generator/:id */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!);
      await worksheetService.delete(req.params.id, ctx);
      sendSuccess(res, null, 'Worksheet deleted');
    } catch (err) { next(err); }
  },

  /** POST /worksheet-generator/upload — attach an existing worksheet (photo/PDF) as-is, no AI. */
  async uploadAttachment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) throw new ValidationError('A file is required');
      const data = uploadWorksheetSchema.parse(req.body);
      const ctx = buildAuthContext(req.user!);
      const worksheet = await worksheetService.saveFromAttachment(req.file, data, ctx);
      sendCreated(res, worksheet, 'Worksheet uploaded');
    } catch (err) { next(err); }
  },

  /** GET /worksheet-generator/my — candidate-facing, scoped to their own batch. */
  async listMine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!);
      const worksheets = await worksheetService.listMine(ctx);
      sendSuccess(res, worksheets);
    } catch (err) { next(err); }
  },

  /** GET /worksheet-generator/my/:id — candidate-facing, scoped to their own batch. */
  async getMineById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!);
      const worksheet = await worksheetService.getMineById(req.params.id, ctx);
      sendSuccess(res, worksheet);
    } catch (err) { next(err); }
  },
};
