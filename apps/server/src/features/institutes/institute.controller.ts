import { Request, Response, NextFunction } from 'express';
import { instituteService } from './institute.service';
import { sendSuccess, sendCreated } from '../../lib/response';

export const instituteController = {
  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutes = await instituteService.list();
      sendSuccess(res, institutes, 'Institutes fetched');
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institute = await instituteService.getById(req.params.id);
      sendSuccess(res, institute, 'Institute fetched');
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institute = await instituteService.create(req.body);
      sendCreated(res, institute, 'Institute created');
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institute = await instituteService.update(req.params.id, req.body);
      sendSuccess(res, institute, 'Institute updated');
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await instituteService.remove(req.params.id);
      sendSuccess(res, null, 'Institute deleted');
    } catch (err) {
      next(err);
    }
  },
};
