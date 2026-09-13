import mongoose, { Document, Schema } from 'mongoose';

export type EmploymentStatus = 'applicant' | 'active' | 'on_leave' | 'suspended' | 'resigned' | 'retired' | 'inactive';
export type FacultyGender = 'male' | 'female' | 'other';

export interface IFaculty extends Document {
  fullName: string;
  gender: FacultyGender;
  dateOfBirth?: Date;
  employeeId: string;
  photoUrl?: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  /** Admin-issued login address — separate from `email`, the faculty's own contact address. */
  loginEmail?: string;
  department?: string;
  tracks: string[];
  assignedBatches: string[];
  experienceYears?: number;
  joiningDate?: Date;
  employmentStatus: EmploymentStatus;
  remarks?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  createdBy?: string;
  updatedBy?: string;
  instituteId: string;
  createdAt: Date;
  updatedAt: Date;
}

const EMPLOYMENT_STATUSES: EmploymentStatus[] = [
  'applicant', 'active', 'on_leave', 'suspended', 'resigned', 'retired', 'inactive',
];

const facultySchema = new Schema<IFaculty>(
  {
    fullName: { type: String, required: true, trim: true },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    dateOfBirth: { type: Date },
    employeeId: { type: String, required: true, trim: true },
    photoUrl: { type: String },
    phone: { type: String, required: true, trim: true },
    alternatePhone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    loginEmail: { type: String, trim: true, lowercase: true },
    department: { type: String, trim: true },
    tracks: { type: [String], default: [] },
    assignedBatches: { type: [String], default: [] },
    experienceYears: { type: Number, min: 0 },
    joiningDate: { type: Date },
    employmentStatus: { type: String, enum: EMPLOYMENT_STATUSES, default: 'active' },
    remarks: { type: String, trim: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
    createdBy: { type: String },
    updatedBy: { type: String },
    instituteId: { type: String, required: true, index: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

facultySchema.index({ instituteId: 1, employeeId: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });
facultySchema.index({ instituteId: 1, isDeleted: 1, createdAt: -1 });
facultySchema.index({ instituteId: 1, isDeleted: 1, employmentStatus: 1 });
facultySchema.index({ instituteId: 1, isDeleted: 1, tracks: 1 });
facultySchema.index({ instituteId: 1, isDeleted: 1, assignedBatches: 1 });
// A plain `sparse: true` on this compound index only excludes a document when EVERY indexed
// field is missing — since instituteId is always set, two faculty with no loginEmail in the
// same institute still collide as "duplicate null". A partial filter scopes the uniqueness
// constraint to documents that actually have a loginEmail, which is what "sparse" was meant to do here.
facultySchema.index(
  { instituteId: 1, loginEmail: 1 },
  { unique: true, partialFilterExpression: { loginEmail: { $exists: true, $type: 'string' } } }
);

export const Faculty = mongoose.model<IFaculty>('Faculty', facultySchema);
