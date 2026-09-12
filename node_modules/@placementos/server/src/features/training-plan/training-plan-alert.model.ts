import mongoose, { Document, Schema } from 'mongoose';

/**
 * Training Plan alerts are computed live from Training Schedule + TrainingPlan state (see
 * trainingPlanService.getAlerts) rather than a cron-populated collection like SchoolOS's
 * plan-alert.job.ts — there's no scheduler infrastructure in PlacementOS's scope for this yet.
 * This collection only records which alert ids a TPO has dismissed, so a re-computed alert list
 * doesn't keep re-surfacing something already acknowledged this week.
 */
export interface ITrainingPlanAlertDismissal extends Document {
  instituteId: string;
  alertId: string;
  dismissedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const trainingPlanAlertDismissalSchema = new Schema<ITrainingPlanAlertDismissal>(
  {
    instituteId: { type: String, required: true, index: true },
    alertId: { type: String, required: true },
    dismissedAt: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false }
);

trainingPlanAlertDismissalSchema.index({ instituteId: 1, alertId: 1 }, { unique: true });
// Dismissals auto-expire after 8 days — an alert id is scoped to "this week" (it encodes
// weekStartDate), so once a week is over a stale dismissal would just silently accumulate.
trainingPlanAlertDismissalSchema.index({ dismissedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 8 });

export const TrainingPlanAlertDismissal = mongoose.model<ITrainingPlanAlertDismissal>(
  'TrainingPlanAlertDismissal',
  trainingPlanAlertDismissalSchema
);
