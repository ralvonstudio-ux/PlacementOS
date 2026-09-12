import { TrainingPlan, ITrainingPlan, ITrainingPlanDay } from './training-plan.model';

export const trainingPlanRepository = {
  async findById(id: string, instituteId: string): Promise<ITrainingPlan | null> {
    return TrainingPlan.findOne({ _id: id, instituteId });
  },

  async findWeek(instituteId: string, facultyId: string, batch: string, track: string, weekStartDate: string): Promise<ITrainingPlan | null> {
    return TrainingPlan.findOne({ instituteId, facultyId, batch, track, weekStartDate });
  },

  /** Every plan week for a batch/track (any faculty) whose weekStartDate falls within [from, to] — backs the month view. */
  async findWeeksInRange(instituteId: string, batch: string, track: string, from: string, to: string): Promise<ITrainingPlan[]> {
    return TrainingPlan.find({ instituteId, batch, track, weekStartDate: { $gte: from, $lte: to } })
      .sort({ weekStartDate: 1 })
      .lean<ITrainingPlan[]>();
  },

  /** Every plan ever created for a batch/track (any faculty), ordered oldest-first —
   *  used to figure out which modules have already been scheduled, for continuation. */
  async findAllForBatchTrack(instituteId: string, batch: string, track: string): Promise<ITrainingPlan[]> {
    return TrainingPlan.find({ instituteId, batch, track }).sort({ weekStartDate: 1 }).lean<ITrainingPlan[]>();
  },

  /** Latest plan (by weekStartDate) for every faculty+batch+track combination — backs the TPO oversight listing. */
  async findLatestPerFacultyBatchTrack(instituteId: string): Promise<ITrainingPlan[]> {
    const all = await TrainingPlan.find({ instituteId }).sort({ weekStartDate: -1 }).lean<ITrainingPlan[]>();
    const seen = new Set<string>();
    const latest: ITrainingPlan[] = [];
    for (const plan of all) {
      const key = `${plan.facultyId}::${plan.batch}::${plan.track}`;
      if (seen.has(key)) continue;
      seen.add(key);
      latest.push(plan);
    }
    return latest;
  },

  async upsertWeek(
    instituteId: string,
    facultyId: string,
    batch: string,
    track: string,
    weekStartDate: string,
    days: ITrainingPlanDay[]
  ): Promise<ITrainingPlan> {
    const existing = await TrainingPlan.findOne({ instituteId, facultyId, batch, track, weekStartDate });
    if (existing) {
      existing.days = days;
      existing.version += 1;
      await existing.save();
      return existing;
    }
    return TrainingPlan.create({ instituteId, facultyId, batch, track, weekStartDate, days, version: 1 });
  },

  async save(plan: ITrainingPlan): Promise<ITrainingPlan> {
    return plan.save();
  },
};
