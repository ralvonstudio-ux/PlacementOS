import mongoose, { Document, Schema } from 'mongoose';

export interface ITrainingScheduleEntry extends Document {
  instituteId: string;
  batch: string;
  track: string;
  facultyId: string;
  dayOfWeek: number; // 1 (Monday) – 6 (Saturday)
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  room?: string;
  placementYear: string;
  slotId?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const trainingScheduleSchema = new Schema<ITrainingScheduleEntry>(
  {
    instituteId: { type: String, required: true, index: true },
    batch: { type: String, required: true, trim: true },
    track: { type: String, required: true, trim: true },
    facultyId: { type: String, required: true },
    dayOfWeek: { type: Number, required: true, min: 1, max: 6 },
    startTime: { type: String, required: true, trim: true },
    endTime: { type: String, required: true, trim: true },
    room: { type: String, trim: true },
    placementYear: { type: String, required: true, trim: true },
    slotId: { type: String },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
    createdBy: { type: String },
    updatedBy: { type: String },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

trainingScheduleSchema.index({ instituteId: 1, isDeleted: 1, batch: 1, track: 1 });
trainingScheduleSchema.index({ instituteId: 1, isDeleted: 1, facultyId: 1 });
trainingScheduleSchema.index({ instituteId: 1, isDeleted: 1, placementYear: 1 });
trainingScheduleSchema.index({ instituteId: 1, isDeleted: 1, dayOfWeek: 1 });

export const TrainingScheduleEntry = mongoose.model<ITrainingScheduleEntry>(
  'TrainingScheduleEntry',
  trainingScheduleSchema
);
