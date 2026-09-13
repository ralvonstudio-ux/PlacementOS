import mongoose, { Document, Schema } from 'mongoose';

/** One row of the institute's bell schedule — e.g. "Period 1, 09:00–10:00".
 *  Training schedule entries optionally reference one via `slotId` so the
 *  timetable grid can align batches to a shared set of daily slots instead
 *  of each entry carrying independent, possibly-misaligned start/end times. */
export interface IPeriodSlot extends Document {
  instituteId: string;
  name: string;
  orderIndex: number;
  startTime: string;
  endTime: string;
  isBreak: boolean;
  daysApplicable: number[];
  isDeleted: boolean;
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const periodSlotSchema = new Schema<IPeriodSlot>(
  {
    instituteId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 50 },
    orderIndex: { type: Number, required: true },
    startTime: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
    endTime: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
    isBreak: { type: Boolean, default: false },
    daysApplicable: { type: [Number], default: [1, 2, 3, 4, 5, 6] },
    isDeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, required: true },
    updatedBy: { type: String },
  },
  { timestamps: true, versionKey: false }
);

periodSlotSchema.index({ instituteId: 1, isDeleted: 1, orderIndex: 1 });

export const PeriodSlot = mongoose.model<IPeriodSlot>('PeriodSlot', periodSlotSchema);
