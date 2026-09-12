import mongoose, { Document, Schema } from 'mongoose';

export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface ILeaveRequest extends Document {
  instituteId: string;
  facultyId: string;
  requestedByUserId: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: LeaveRequestStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const leaveRequestSchema = new Schema<ILeaveRequest>(
  {
    instituteId: { type: String, required: true, index: true },
    facultyId: { type: String, required: true },
    requestedByUserId: { type: String, required: true },
    fromDate: { type: String, required: true },
    toDate: { type: String, required: true },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending' },
    reviewedBy: { type: String },
    reviewedAt: { type: Date },
    reviewNote: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true, versionKey: false }
);

leaveRequestSchema.index({ instituteId: 1, status: 1, createdAt: -1 });
leaveRequestSchema.index({ instituteId: 1, facultyId: 1, createdAt: -1 });

export const LeaveRequest = mongoose.model<ILeaveRequest>('LeaveRequest', leaveRequestSchema);
