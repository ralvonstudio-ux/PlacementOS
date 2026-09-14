import mongoose, { Document, Schema } from 'mongoose';

export type AcademicPlanSessionStatus = 'planned' | 'completed' | 'skipped';

/** One lecture-sized slice of the syllabus, placed on a week/date by the generator
 *  and freely rearrangeable by the faculty member afterwards. */
export interface IAcademicPlanSession {
  lectureNumber: number;
  week: number;
  date: string; // YYYY-MM-DD
  title: string;
  description?: string;
  status: AcademicPlanSessionStatus;
  /** True once a faculty member hand-edits an AI-generated session — preserved verbatim
   *  the next time the plan is regenerated from the syllabus. */
  manuallyEdited?: boolean;
}

export interface IAcademicPlan extends Document {
  instituteId: string;
  facultyId: string;
  batch: string;
  track: string;
  title: string;
  syllabusText: string;
  totalLectures: number;
  totalWeeks: number;
  startDate: string; // YYYY-MM-DD, Monday-aligned
  sessions: IAcademicPlanSession[];
  version: number;
  createdBy: string;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<IAcademicPlanSession>(
  {
    lectureNumber: { type: Number, required: true },
    week: { type: Number, required: true },
    date: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    status: { type: String, enum: ['planned', 'completed', 'skipped'], default: 'planned' },
    manuallyEdited: { type: Boolean, default: false },
  },
  { _id: false }
);

const academicPlanSchema = new Schema<IAcademicPlan>(
  {
    instituteId: { type: String, required: true, index: true },
    facultyId: { type: String, required: true },
    batch: { type: String, required: true, trim: true },
    track: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    syllabusText: { type: String, required: true },
    totalLectures: { type: Number, required: true, min: 1 },
    totalWeeks: { type: Number, required: true, min: 1 },
    startDate: { type: String, required: true },
    sessions: { type: [sessionSchema], default: [] },
    version: { type: Number, default: 1 },
    createdBy: { type: String, required: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false }
);

// One active plan per faculty+batch+track — regenerating replaces it in place (version bumps).
academicPlanSchema.index({ instituteId: 1, isDeleted: 1, facultyId: 1, batch: 1, track: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });

export const AcademicPlan = mongoose.model<IAcademicPlan>('AcademicPlan', academicPlanSchema);
