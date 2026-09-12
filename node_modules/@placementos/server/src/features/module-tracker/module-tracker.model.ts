import mongoose, { Document, Schema } from 'mongoose';

export type ModuleProgressStatus = 'not_started' | 'in_progress' | 'completed';

export interface ITrainingModule extends Document {
  instituteId: string;
  track: string;
  name: string;
  description?: string;
  order: number;
  estimatedPeriods?: number;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const trainingModuleSchema = new Schema<ITrainingModule>(
  {
    instituteId: { type: String, required: true, index: true },
    track: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, maxlength: 1000 },
    order: { type: Number, required: true, default: 0 },
    estimatedPeriods: { type: Number, min: 1 },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
    createdBy: { type: String },
    updatedBy: { type: String },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

trainingModuleSchema.index({ instituteId: 1, isDeleted: 1, track: 1, order: 1 });

export const TrainingModule = mongoose.model<ITrainingModule>('TrainingModule', trainingModuleSchema);

export interface IModuleProgress extends Document {
  instituteId: string;
  batch: string;
  track: string;
  moduleId: string;
  status: ModuleProgressStatus;
  completedAt?: Date;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MODULE_PROGRESS_STATUSES: ModuleProgressStatus[] = ['not_started', 'in_progress', 'completed'];

const moduleProgressSchema = new Schema<IModuleProgress>(
  {
    instituteId: { type: String, required: true, index: true },
    batch: { type: String, required: true, trim: true },
    track: { type: String, required: true, trim: true },
    moduleId: { type: String, required: true },
    status: { type: String, enum: MODULE_PROGRESS_STATUSES, default: 'not_started' },
    completedAt: { type: Date },
    updatedBy: { type: String },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

moduleProgressSchema.index({ instituteId: 1, batch: 1, track: 1, moduleId: 1 }, { unique: true });

export const ModuleProgress = mongoose.model<IModuleProgress>('ModuleProgress', moduleProgressSchema);
