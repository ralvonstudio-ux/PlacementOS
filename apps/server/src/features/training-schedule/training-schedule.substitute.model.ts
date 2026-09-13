import mongoose, { Document, Schema } from 'mongoose';

export type SubstituteStatus = 'pending' | 'assigned' | 'cancelled';

/** Covers one training-schedule entry, on one date, when the originally
 *  assigned faculty member is on approved leave. */
export interface ITimetableSubstitute extends Document {
  instituteId: string;
  date: string; // YYYY-MM-DD
  entryId: string;
  originalFacultyId: string;
  substituteFacultyId?: string;
  reason?: string;
  status: SubstituteStatus;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const substituteSchema = new Schema<ITimetableSubstitute>(
  {
    instituteId: { type: String, required: true, index: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    entryId: { type: String, required: true },
    originalFacultyId: { type: String, required: true },
    substituteFacultyId: { type: String },
    reason: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: ['pending', 'assigned', 'cancelled'], default: 'pending' },
    createdBy: { type: String },
    updatedBy: { type: String },
  },
  { timestamps: true, versionKey: false }
);

substituteSchema.index({ instituteId: 1, date: 1, entryId: 1 }, { unique: true });
substituteSchema.index({ instituteId: 1, status: 1 });

export const TimetableSubstitute = mongoose.model<ITimetableSubstitute>('TimetableSubstitute', substituteSchema);
