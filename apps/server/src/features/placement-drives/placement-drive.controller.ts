import { Request, Response, NextFunction } from 'express';
import { placementDriveService } from './placement-drive.service';
import { sendSuccess, sendCreated } from '../../lib/response';
import { buildAuthContext } from '../../lib/auth-context';

const ctxOf = (req: Request) => buildAuthContext(req.user!, req.ip ?? undefined);

export const placementDriveController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await placementDriveService.list(ctxOf(req)));
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendCreated(res, await placementDriveService.create(req.body, ctxOf(req)), 'Drive created as a draft');
    } catch (err) { next(err); }
  },

  async getDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await placementDriveService.getDetail(req.params.id, ctxOf(req)));
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await placementDriveService.update(req.params.id, req.body, ctxOf(req)), 'Drive updated');
    } catch (err) { next(err); }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await placementDriveService.remove(req.params.id, ctxOf(req));
      sendSuccess(res, null, 'Drive deleted');
    } catch (err) { next(err); }
  },

  async setStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await placementDriveService.setStatus(req.params.id, req.body, ctxOf(req)));
    } catch (err) { next(err); }
  },

  async recordRoundResult(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await placementDriveService.recordRoundResult(req.params.id, req.body, ctxOf(req)));
    } catch (err) { next(err); }
  },

  async setApplicationStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await placementDriveService.setApplicationStatus(req.params.id, req.body, ctxOf(req)));
    } catch (err) { next(err); }
  },

  async stats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await placementDriveService.stats(req.query, ctxOf(req)));
    } catch (err) { next(err); }
  },

  async listMine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await placementDriveService.listForCandidate(ctxOf(req)));
    } catch (err) { next(err); }
  },

  async apply(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await placementDriveService.apply(req.params.id, ctxOf(req));
      sendSuccess(res, null, 'Application submitted');
    } catch (err) { next(err); }
  },

  async withdraw(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await placementDriveService.withdraw(req.params.id, ctxOf(req));
      sendSuccess(res, null, 'Application withdrawn');
    } catch (err) { next(err); }
  },
};
