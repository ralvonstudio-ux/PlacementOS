import { Request, Response, NextFunction } from 'express';
import { candidateProfileService } from './candidate-profile.service';
import { sendSuccess } from '../../lib/response';
import { buildAuthContext } from '../../lib/auth-context';
import { ValidationError } from '../../middlewares/errorHandler';

export const candidateProfileController = {
  async getMine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const profile = await candidateProfileService.getMine(ctx);
      sendSuccess(res, profile);
    } catch (err) { next(err); }
  },

  async saveMine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const profile = await candidateProfileService.saveMine(req.body, ctx);
      sendSuccess(res, profile, 'Profile saved');
    } catch (err) { next(err); }
  },

  async uploadResume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) throw new ValidationError('A resume file is required');
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const profile = await candidateProfileService.uploadResume(req.file, ctx);
      sendSuccess(res, profile, 'Resume uploaded');
    } catch (err) { next(err); }
  },

  async getMyLeetCodeStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const stats = await candidateProfileService.getMyLeetCodeStats(ctx);
      sendSuccess(res, stats);
    } catch (err) { next(err); }
  },
};
