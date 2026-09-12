import mongoose, { Document, Schema } from 'mongoose';

export type TrainingPlanBlockType = 'module' | 'assessment' | 'event' | 'holiday' | 'other';
export type TrainingPlanStatus = 'planned' | 'in_progress' | 'completed' | 'skipped';

export interface ITrainingPlanDay {
  date: string;
  blockType: TrainingPlanBlockType;
  moduleId?: string;
  moduleName?: string;
  title: string;
  status: TrainingPlanStatus;
  notes?: string;
  carriedFromDate?: string;
  manuallyEdited?: boolean;
}

export interface ITrainingPlan extends Document {
  instituteId: string;
  facultyId: string;
  batch: string;
  track: string;
  weekStartDate: string;
  days: ITrainingPlanDay[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const BLOCK_TYPES: TrainingPlanBlockType[] = ['module', 'assessment', 'event', 'holiday', 'other'];
const DAY_STATUSES: TrainingPlanStatus[] = ['planned', 'in_progress', 'completed', 'skipped'];

const trainingPlanDaySchema = new Schema<ITrainingPlanDay>(
  {
    date: { type: String, required: true },
    blockType: { type: String, enum: BLOCK_TYPES, required: true },
    moduleId: { type: String },
    moduleName: { type: String, trim: true },
    title: { type: String, required: true, trim: true },
    status: { type: String, enum: DAY_STATUSES, default: 'planned' },
    notes: { type: String, trim: true, maxlength: 500 },
    carriedFromDate: { type: String },
    manuallyEdited: { type: Boolean, default: false },
  },
  { _id: false }
);

const trainingPlanSchema = new Schema<ITrainingPlan>(
  {
    instituteId: { type: String, required: true, index: true },
    facultyId: { type: String, required: true },
    batch: { type: String, required: true, trim: true },
    track: { type: String, required: true, trim: true },
    weekStartDate: { type: String, required: true },
    days: { type: [trainingPlanDaySchema], default: [] },
    version: { type: Number, required: true, default: 1 },
  },
  { timestamps: true, versionKey: false }
);

trainingPlanSchema.index({ instituteId: 1, facultyId: 1, batch: 1, track: 1, weekStartDate: 1 }, { unique: true });
trainingPlanSchema.index({ instituteId: 1, batch: 1, track: 1 });

export const TrainingPlan = mongoose.model<ITrainingPlan>('TrainingPlan', trainingPlanSchema);
