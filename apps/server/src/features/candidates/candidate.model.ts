import mongoose, { Document, Schema } from 'mongoose';

export type CandidateStatus = 'active' | 'inactive' | 'placed';

export interface ICandidate extends Document {
  instituteId: string;
  fullName: string;
  rollNumber: string;
  batch: string;
  department: string;
  email?: string;
  phone?: string;
  placementYear: string;
  status: CandidateStatus;
  /** Admin/TPO-issued login address — separate from `email`, mirrors Faculty.loginEmail. */
  loginEmail?: string;
  /** Free-text note a faculty member can attach from the batch roster (attendance
   *  edit flow) — never shown on the attendance-marking screen itself, only on the
   *  roster's edit view. Distinct from admin/TPO's full-record edit permissions. */
  facultyNote?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CANDIDATE_STATUSES: CandidateStatus[] = ['active', 'inactive', 'placed'];

const candidateSchema = new Schema<ICandidate>(
  {
    instituteId: { type: String, required: true, index: true },
    fullName: { type: String, required: true, trim: true },
    rollNumber: { type: String, required: true, trim: true },
    batch: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    placementYear: { type: String, required: true, trim: true },
    status: { type: String, enum: CANDIDATE_STATUSES, default: 'active' },
    loginEmail: { type: String, trim: true, lowercase: true },
    facultyNote: { type: String, trim: true, maxlength: 2000 },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
    createdBy: { type: String },
    updatedBy: { type: String },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

candidateSchema.index({ instituteId: 1, rollNumber: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });
candidateSchema.index({ instituteId: 1, isDeleted: 1, batch: 1 });
candidateSchema.index({ instituteId: 1, isDeleted: 1, department: 1 });
candidateSchema.index({ instituteId: 1, isDeleted: 1, placementYear: 1 });
candidateSchema.index({ instituteId: 1, isDeleted: 1, status: 1 });
// A plain `sparse: true` on this compound index only excludes a document when EVERY indexed
// field is missing — since instituteId is always set, two candidates with no loginEmail in the
// same institute still collide as "duplicate null". A partial filter scopes the uniqueness
// constraint to documents that actually have a loginEmail, which is what "sparse" was meant to do here.
candidateSchema.index(
  { instituteId: 1, loginEmail: 1 },
  { unique: true, partialFilterExpression: { loginEmail: { $exists: true, $type: 'string' } } }
);

export const Candidate = mongoose.model<ICandidate>('Candidate', candidateSchema);
