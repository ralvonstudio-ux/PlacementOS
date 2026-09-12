import { TrainingModule, ITrainingModule, ModuleProgress, IModuleProgress, ModuleProgressStatus } from './module-tracker.model';

export const trainingModuleRepository = {
  async create(data: Partial<ITrainingModule>): Promise<ITrainingModule> {
    return TrainingModule.create(data);
  },

  async findById(id: string, instituteId: string): Promise<ITrainingModule | null> {
    return TrainingModule.findOne({ _id: id, instituteId, isDeleted: false });
  },

  async findByTrack(instituteId: string, track?: string): Promise<ITrainingModule[]> {
    const filter: Record<string, unknown> = { instituteId, isDeleted: false };
    if (track) filter.track = track;
    return TrainingModule.find(filter).sort({ track: 1, order: 1 }).lean<ITrainingModule[]>();
  },

  async update(id: string, instituteId: string, data: Partial<ITrainingModule>): Promise<ITrainingModule | null> {
    return TrainingModule.findOneAndUpdate({ _id: id, instituteId, isDeleted: false }, { $set: data }, { new: true });
  },

  async softDelete(id: string, instituteId: string, deletedBy?: string): Promise<boolean> {
    const result = await TrainingModule.updateOne(
      { _id: id, instituteId, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date(), deletedBy } }
    );
    return result.modifiedCount > 0;
  },
};

export const moduleProgressRepository = {
  async findByBatchTrack(instituteId: string, batch: string, track: string): Promise<IModuleProgress[]> {
    return ModuleProgress.find({ instituteId, batch, track }).lean<IModuleProgress[]>();
  },

  async upsertStatus(
    instituteId: string,
    batch: string,
    track: string,
    moduleId: string,
    status: ModuleProgressStatus,
    updatedBy: string
  ): Promise<IModuleProgress> {
    return ModuleProgress.findOneAndUpdate(
      { instituteId, batch, track, moduleId },
      {
        $set: {
          status,
          updatedBy,
          completedAt: status === 'completed' ? new Date() : undefined,
        },
      },
      { new: true, upsert: true, runValidators: true }
    ).lean<IModuleProgress>() as unknown as IModuleProgress;
  },
};
