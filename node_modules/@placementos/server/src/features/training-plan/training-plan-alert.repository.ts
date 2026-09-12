import { TrainingPlanAlertDismissal } from './training-plan-alert.model';

export const trainingPlanAlertRepository = {
  async findDismissedIds(instituteId: string): Promise<Set<string>> {
    const rows = await TrainingPlanAlertDismissal.find({ instituteId }).select('alertId').lean<{ alertId: string }[]>();
    return new Set(rows.map((r) => r.alertId));
  },

  async dismiss(instituteId: string, alertId: string): Promise<void> {
    await TrainingPlanAlertDismissal.updateOne(
      { instituteId, alertId },
      { $set: { dismissedAt: new Date() } },
      { upsert: true }
    );
  },
};
