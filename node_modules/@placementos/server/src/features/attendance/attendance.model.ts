import mongoose, { Document, Schema } from 'mongoose';
import type { AttendanceStatus } from '@placementos/types';

export type { AttendanceStatus };

export interface IAttendance extends Document {
  instituteId: string;
  candidateId: string;
  batch: string;
  track: string;
  date: string; // ISO date YYYY-MM-DD
  status: AttendanceStatus;
  note?: string;
  markedBy: string;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ATTENDANCE_STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'excused'];

const attendanceSchema = new Schema<IAttendance>(
  {
    instituteId: { type: String, required: true, index: true },
    candidateId: { type: String, required: true },
    batch: { type: String, required: true, trim: true },
    track: { type: String, required: true, trim: true },
    date: { type: String, required: true },
    status: { type: String, enum: ATTENDANCE_STATUSES, required: true },
    note: { type: String, trim: true, maxlength: 500 },
    markedBy: { type: String, required: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
  },
  { timestamps: true, versionKey: false }
);

// Primary query: batch/track attendance for a date
attendanceSchema.index({ instituteId: 1, batch: 1, track: 1, date: 1, isDeleted: 1 });
// Candidate history
attendanceSchema.index({ instituteId: 1, candidateId: 1, date: -1, isDeleted: 1 });
// Unique: one record per candidate/track per date (upsert key)
attendanceSchema.index(
  { instituteId: 1, candidateId: 1, track: 1, date: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
attendanceSchema.index({ instituteId: 1, date: 1, isDeleted: 1 });
attendanceSchema.index({ instituteId: 1, date: 1, status: 1, isDeleted: 1 });

export const Attendance = mongoose.model<IAttendance>('Attendance', attendanceSchema);
