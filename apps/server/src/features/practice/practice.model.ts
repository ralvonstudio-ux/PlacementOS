import mongoose, { Document, Schema } from 'mongoose';

export type PracticeCategory = 'aptitude' | 'reasoning' | 'pi' | 'gd' | 'company';
export type PracticeQuestionType = 'mcq' | 'open_ended';
export type PracticeDifficulty = 'easy' | 'medium' | 'hard';

const CATEGORIES: PracticeCategory[] = ['aptitude', 'reasoning', 'pi', 'gd', 'company'];
const QUESTION_TYPES: PracticeQuestionType[] = ['mcq', 'open_ended'];
const DIFFICULTIES: PracticeDifficulty[] = ['easy', 'medium', 'hard'];

export interface IPracticeQuestion extends Document {
  instituteId: string;
  category: PracticeCategory;
  companyName?: string;
  questionText: string;
  questionType: PracticeQuestionType;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  guidancePoints?: string[];
  difficulty?: PracticeDifficulty;
  tags: string[];
  createdBy: string;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const practiceQuestionSchema = new Schema<IPracticeQuestion>(
  {
    instituteId: { type: String, required: true, index: true },
    category: { type: String, enum: CATEGORIES, required: true },
    companyName: { type: String, trim: true },
    questionText: { type: String, required: true, trim: true },
    questionType: { type: String, enum: QUESTION_TYPES, required: true },
    options: { type: [String] },
    correctAnswer: { type: String, trim: true },
    explanation: { type: String, trim: true, maxlength: 1000 },
    guidancePoints: { type: [String] },
    difficulty: { type: String, enum: DIFFICULTIES },
    tags: { type: [String], default: [] },
    createdBy: { type: String, required: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false }
);

practiceQuestionSchema.index({ instituteId: 1, isDeleted: 1, category: 1 });
practiceQuestionSchema.index({ instituteId: 1, isDeleted: 1, companyName: 1 });

export const PracticeQuestion = mongoose.model<IPracticeQuestion>('PracticeQuestion', practiceQuestionSchema);

export interface IPracticeSheet extends Document {
  instituteId: string;
  title: string;
  batch: string;
  category: PracticeCategory;
  questionIds: string[];
  createdBy: string;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const practiceSheetSchema = new Schema<IPracticeSheet>(
  {
    instituteId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    batch: { type: String, required: true, trim: true },
    category: { type: String, enum: CATEGORIES, required: true },
    questionIds: { type: [String], default: [] },
    createdBy: { type: String, required: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false }
);

practiceSheetSchema.index({ instituteId: 1, isDeleted: 1, batch: 1 });

export const PracticeSheet = mongoose.model<IPracticeSheet>('PracticeSheet', practiceSheetSchema);
