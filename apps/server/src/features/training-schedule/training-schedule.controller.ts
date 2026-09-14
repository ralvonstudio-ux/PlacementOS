import { Request, Response, NextFunction } from 'express';
import { trainingScheduleService } from './training-schedule.service';
import { periodSlotService, substituteService, detectConflicts, getMasterGrid, setMasterGridCell } from './training-schedule.timetable.service';
import { listTrainingScheduleSchema, listSubstitutesSchema, masterGridQuerySchema } from './training-schedule.validation';
import { sendSuccess, sendCreated, sendPaginated } from '../../lib/response';
import { buildAuthContext } from '../../lib/auth-context';

export const trainingScheduleController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const query = listTrainingScheduleSchema.parse(req.query);
      const result = await trainingScheduleService.list(ctx, query);
      sendPaginated(res, result.data, result.meta);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const entry = await trainingScheduleService.getById(req.params.id, ctx);
      sendSuccess(res, entry);
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const entry = await trainingScheduleService.create(req.body, ctx);
      sendCreated(res, entry, 'Training schedule entry created');
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const entry = await trainingScheduleService.update(req.params.id, req.body, ctx);
      sendSuccess(res, entry, 'Training schedule entry updated');
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      await trainingScheduleService.remove(req.params.id, ctx);
      sendSuccess(res, null, 'Training schedule entry deleted');
    } catch (err) {
      next(err);
    }
  },

  // ── Period slots (bell schedule) ──────────────────────────────────────────
  async listPeriods(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const slots = await periodSlotService.list(req.user!.instituteId);
      sendSuccess(res, slots);
    } catch (err) {
      next(err);
    }
  },

  async createPeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const slot = await periodSlotService.create(req.body, ctx);
      sendCreated(res, slot, 'Period slot created');
    } catch (err) {
      next(err);
    }
  },

  async updatePeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const slot = await periodSlotService.update(req.params.id, req.body, ctx);
      sendSuccess(res, slot, 'Period slot updated');
    } catch (err) {
      next(err);
    }
  },

  async removePeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      await periodSlotService.remove(req.params.id, ctx);
      sendSuccess(res, null, 'Period slot deleted');
    } catch (err) {
      next(err);
    }
  },

  async reorderPeriods(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      await periodSlotService.reorder(req.body, ctx);
      sendSuccess(res, null, 'Period slots reordered');
    } catch (err) {
      next(err);
    }
  },

  // ── Conflicts ──────────────────────────────────────────────────────────────
  async conflicts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const placementYear = String(req.query.placementYear ?? '');
      if (!placementYear) throw new Error('placementYear query param is required');
      const conflicts = await detectConflicts(req.user!.instituteId, placementYear);
      sendSuccess(res, conflicts);
    } catch (err) {
      next(err);
    }
  },

  // ── Master grid ────────────────────────────────────────────────────────────
  async masterGrid(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { placementYear, batch } = masterGridQuerySchema.parse(req.query);
      const grid = await getMasterGrid(req.user!.instituteId, placementYear, batch);
      sendSuccess(res, grid);
    } catch (err) {
      next(err);
    }
  },

  async setMasterGridCell(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const entry = await setMasterGridCell(req.body, ctx);
      sendSuccess(res, entry, 'Timetable cell saved');
    } catch (err) {
      next(err);
    }
  },

  // ── Substitutes ────────────────────────────────────────────────────────────
  async listSubstitutes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listSubstitutesSchema.parse(req.query);
      const result = await substituteService.list(req.user!.instituteId, query);
      sendPaginated(res, result.data, result.meta);
    } catch (err) {
      next(err);
    }
  },

  async createSubstitute(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const sub = await substituteService.create(req.body, ctx);
      sendCreated(res, sub, 'Substitute created');
    } catch (err) {
      next(err);
    }
  },

  async updateSubstitute(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const sub = await substituteService.update(req.params.id, req.body, ctx);
      sendSuccess(res, sub, 'Substitute updated');
    } catch (err) {
      next(err);
    }
  },

  async removeSubstitute(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      await substituteService.remove(req.params.id, ctx);
      sendSuccess(res, null, 'Substitute removed');
    } catch (err) {
      next(err);
    }
  },

  async needsSubstitute(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const date = String(req.query.date ?? '');
      if (!date) throw new Error('date query param is required');
      const result = await substituteService.needsSubstitute(req.user!.instituteId, date);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },

  async suggestSubstituteTeachers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const track = String(req.query.track ?? '');
      const dayOfWeek = Number(req.query.dayOfWeek ?? 0);
      const excludeFacultyId = typeof req.query.excludeFacultyId === 'string' ? req.query.excludeFacultyId : undefined;
      const result = await substituteService.suggestSubstituteTeachers(req.user!.instituteId, track, dayOfWeek, excludeFacultyId);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
};
