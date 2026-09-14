import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { importService, IMPORT_TEMPLATES } from './import.service';
import {
  importTypeSchema,
  updateMappingSchema,
  setDuplicateStrategySchema,
  updateRowSchema,
  listImportSessionsSchema,
} from './import.validation';
import { sendSuccess, sendCreated, sendPaginated } from '../../lib/response';
import { buildAuthContext } from '../../lib/auth-context';
import { ValidationError } from '../../middlewares/errorHandler';

const ALLOWED_TYPES = [
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, cb) {
    if (ALLOWED_TYPES.includes(file.mimetype) || /\.(csv|xlsx|xls)$/i.test(file.originalname)) cb(null, true);
    else cb(new ValidationError('Only CSV or Excel (.xlsx/.xls) files are allowed'));
  },
}).single('file');

export const importController = {
  listTemplates(_req: Request, res: Response): void {
    sendSuccess(res, IMPORT_TEMPLATES);
  },

  async upload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) throw new ValidationError('No file uploaded');
      const importType = importTypeSchema.parse(req.body.importType ?? req.query.importType);
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const session = await importService.upload(importType, req.file, ctx);
      sendCreated(res, session, 'File uploaded and mapped');
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listImportSessionsSchema.parse(req.query);
      const result = await importService.list(req.user!.instituteId, query);
      sendPaginated(res, result.data, result.meta);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const session = await importService.getById(req.params.id, ctx);
      sendSuccess(res, session);
    } catch (err) {
      next(err);
    }
  },

  async updateMapping(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { columnMapping } = updateMappingSchema.parse(req.body);
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const session = await importService.updateMapping(req.params.id, columnMapping, ctx);
      sendSuccess(res, session, 'Mapping updated');
    } catch (err) {
      next(err);
    }
  },

  async setDuplicateStrategy(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { duplicateStrategy } = setDuplicateStrategySchema.parse(req.body);
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const session = await importService.setDuplicateStrategy(req.params.id, duplicateStrategy, ctx);
      sendSuccess(res, session, 'Duplicate strategy updated');
    } catch (err) {
      next(err);
    }
  },

  async updateRow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { raw } = updateRowSchema.parse(req.body);
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const session = await importService.updateRow(req.params.id, Number(req.params.rowNumber), raw, ctx);
      sendSuccess(res, session, 'Row updated');
    } catch (err) {
      next(err);
    }
  },

  async deleteRow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const session = await importService.deleteRow(req.params.id, Number(req.params.rowNumber), ctx);
      sendSuccess(res, session, 'Row removed');
    } catch (err) {
      next(err);
    }
  },

  async confirm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const session = await importService.confirm(req.params.id, ctx);
      sendSuccess(res, session, 'Import confirmed');
    } catch (err) {
      next(err);
    }
  },

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      await importService.cancel(req.params.id, ctx);
      sendSuccess(res, null, 'Import cancelled');
    } catch (err) {
      next(err);
    }
  },

  async rollback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const session = await importService.rollback(req.params.id, ctx);
      sendSuccess(res, session, 'Import rolled back');
    } catch (err) {
      next(err);
    }
  },
};
