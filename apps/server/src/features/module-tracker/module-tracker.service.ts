import { trainingModuleRepository, moduleProgressRepository } from './module-tracker.repository';
import { ITrainingModule, ModuleProgressStatus } from './module-tracker.model';
import {
  createTrainingModuleSchema,
  updateTrainingModuleSchema,
  listTrainingModuleSchema,
  setModuleProgressSchema,
  listModuleProgressSchema,
} from './module-tracker.validation';
import { NotFoundError } from '../../middlewares/errorHandler';
import { AuthContext } from '../../lib/auth-context';
import { assertFacultyCanAccessQuestionBank } from '../training-schedule/training-schedule.service';
import type { TrainingModule as TrainingModuleApiShape, ModuleProgress as ModuleProgressApiShape } from '@placementos/types';

const toApiShape = (m: ITrainingModule): TrainingModuleApiShape => ({
  _id: String((m as unknown as { _id: { toString(): string } })._id),
  instituteId: m.instituteId,
  track: m.track,
  name: m.name,
  description: m.description,
  order: m.order,
  createdAt: new Date(m.createdAt).toISOString(),
  updatedAt: new Date(m.updatedAt).toISOString(),
});

export interface ModuleCoverage {
  batch: string;
  track: string;
  totalModules: number;
  modulesCompleted: number;
  percentComplete: number;
  modules: ModuleProgressApiShape[];
}

export const moduleTrackerService = {
  async list(rawQuery: unknown, ctx: AuthContext): Promise<TrainingModuleApiShape[]> {
    const { track } = listTrainingModuleSchema.parse(rawQuery);
    const modules = await trainingModuleRepository.findByTrack(ctx.instituteId, track);
    return modules.map(toApiShape);
  },

  async create(rawInput: unknown, ctx: AuthContext): Promise<TrainingModuleApiShape> {
    const data = createTrainingModuleSchema.parse(rawInput);
    const created = await trainingModuleRepository.create({ ...data, instituteId: ctx.instituteId, createdBy: ctx.userId });
    return toApiShape(created);
  },

  async update(id: string, rawInput: unknown, ctx: AuthContext): Promise<TrainingModuleApiShape> {
    const data = updateTrainingModuleSchema.parse(rawInput);
    const updated = await trainingModuleRepository.update(id, ctx.instituteId, { ...data, updatedBy: ctx.userId });
    if (!updated) throw new NotFoundError('Training module');
    return toApiShape(updated);
  },

  async remove(id: string, ctx: AuthContext): Promise<void> {
    const deleted = await trainingModuleRepository.softDelete(id, ctx.instituteId, ctx.userId);
    if (!deleted) throw new NotFoundError('Training module');
  },

  /** Coverage % of a batch/track's modules that are marked completed — the
   *  Faculty/TPO "syllabus progress" view. */
  async getCoverage(rawQuery: unknown, ctx: AuthContext): Promise<ModuleCoverage> {
    const { batch, track } = listModuleProgressSchema.parse(rawQuery);
    await assertFacultyCanAccessQuestionBank(ctx, batch, track);

    const [modules, progress] = await Promise.all([
      trainingModuleRepository.findByTrack(ctx.instituteId, track),
      moduleProgressRepository.findByBatchTrack(ctx.instituteId, batch, track),
    ]);

    const progressByModuleId = new Map(progress.map((p) => [p.moduleId, p]));
    const moduleProgressList: ModuleProgressApiShape[] = modules.map((m) => {
      const moduleId = String((m as unknown as { _id: { toString(): string } })._id);
      const p = progressByModuleId.get(moduleId);
      return {
        _id: p ? String((p as unknown as { _id: { toString(): string } })._id) : '',
        instituteId: ctx.instituteId,
        batch,
        track,
        moduleId,
        status: p?.status ?? 'not_started',
        completedAt: p?.completedAt ? new Date(p.completedAt).toISOString() : undefined,
        createdAt: p ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: p ? new Date(p.updatedAt).toISOString() : new Date().toISOString(),
      };
    });

    const modulesCompleted = moduleProgressList.filter((p) => p.status === 'completed').length;

    return {
      batch,
      track,
      totalModules: modules.length,
      modulesCompleted,
      percentComplete: modules.length === 0 ? 0 : Math.round((modulesCompleted / modules.length) * 100),
      modules: moduleProgressList,
    };
  },

  async setProgress(moduleId: string, rawInput: unknown, ctx: AuthContext): Promise<ModuleProgressApiShape> {
    const { batch, track, status } = setModuleProgressSchema.parse(rawInput);
    await assertFacultyCanAccessQuestionBank(ctx, batch, track);

    const module_ = await trainingModuleRepository.findById(moduleId, ctx.instituteId);
    if (!module_) throw new NotFoundError('Training module');

    const progress = await moduleProgressRepository.upsertStatus(ctx.instituteId, batch, track, moduleId, status as ModuleProgressStatus, ctx.userId);

    return {
      _id: String((progress as unknown as { _id: { toString(): string } })._id),
      instituteId: progress.instituteId,
      batch: progress.batch,
      track: progress.track,
      moduleId: progress.moduleId,
      status: progress.status,
      completedAt: progress.completedAt ? new Date(progress.completedAt).toISOString() : undefined,
      createdAt: new Date(progress.createdAt).toISOString(),
      updatedAt: new Date(progress.updatedAt).toISOString(),
    };
  },
};
