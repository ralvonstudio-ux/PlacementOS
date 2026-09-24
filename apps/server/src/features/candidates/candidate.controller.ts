import { Request, Response, NextFunction } from 'express';
import { candidateService } from './candidate.service';
import { listCandidateSchema } from './candidate.validation';
import { sendSuccess, sendCreated, sendPaginated } from '../../lib/response';
import { buildAuthContext } from '../../lib/auth-context';

export const candidateController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listCandidateSchema.parse(req.query);
      const result = await candidateService.list(req.user!.instituteId, query);
      sendPaginated(res, result.data, result.meta);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const candidate = await candidateService.getById(req.params.id, req.user!.instituteId);
      sendSuccess(res, candidate);
    } catch (err) {
      next(err);
    }
  },

  async listBatches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const batches = await candidateService.listBatches(req.user!.instituteId);
      sendSuccess(res, batches);
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const candidate = await candidateService.create(req.body, ctx);
      sendCreated(res, candidate, 'Candidate created successfully');
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const candidate = await candidateService.update(req.params.id, req.body, ctx);
      sendSuccess(res, candidate, 'Candidate updated successfully');
    } catch (err) {
      next(err);
    }
  },

  async updateFacultyNote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const candidate = await candidateService.updateFacultyNote(req.params.id, req.body, ctx);
      sendSuccess(res, candidate, 'Note saved successfully');
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      await candidateService.remove(req.params.id, ctx);
      sendSuccess(res, null, 'Candidate deleted successfully');
    } catch (err) {
      next(err);
    }
  },

  async createLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const result = await candidateService.createLogin(req.params.id, req.body, ctx);
      sendCreated(res, result, 'Login created successfully');
    } catch (err) {
      next(err);
    }
  },
};
