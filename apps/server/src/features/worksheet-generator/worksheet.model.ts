import mongoose, { Document, Schema } from 'mongoose';
import { QuestionKind, QuestionDifficulty, IBankQuestionImageRef, IBankQuestionImageRequirement, imageRefSchema, imageRequirementSchema } from '../question-bank/bank-question.model';

export type WorksheetType = 'practice' | 'homework' | 'revision' | 'hots' | 'olympiad' | 'remedial';

export interface IWorksheetQuestion {
  questionId?: string;
  questionText: string;
  questionType: QuestionKind;
  options?: string[];
  difficulty: QuestionDifficulty;
  estimatedTimeMinutes: number;
  keywords: string[];
  imageRef?: IBankQuestionImageRef;
  imageRequirement?: IBankQuestionImageRequirement;
}

export type WorksheetSourceType = 'module_bank' | 'content_upload' | 'photo_upload';

export interface IWorksheet extends Document {
  instituteId: string;
  facultyId: string;
  batch: string;
  track: string;
  trainingModuleIds: string[];
  trainingModuleNames: string[];
  worksheetType: WorksheetType;
  title: string;
  questions: IWorksheetQuestion[];
  /** 'module_bank' (default) draws from the question bank + AI-fills any shortfall;
   *  'content_upload' is authored entirely from pasted/uploaded content. */
  sourceType: WorksheetSourceType;
  /** Raw pasted/extracted text this worksheet was generated from — content_upload only. */
  sourceContent?: string;
  /** AI's own short review of the draft (coverage, balance, suggestions) — content_upload only. */
  aiReview?: string;
  /** photo_upload only — the uploaded file's URL and original name. */
  attachmentUrl?: string;
  attachmentFileName?: string;
  createdBy: string;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WORKSHEET_TYPES: WorksheetType[] = ['practice', 'homework', 'revision', 'hots', 'olympiad', 'remedial'];
const QUESTION_TYPES: QuestionKind[] = [
  'mcq', 'fill_blank', 'true_false', 'assertion_reason', 'very_short', 'short', 'long', 'hots', 'case_study',
  'multi_correct', 'match_following', 'one_word', 'competency_based', 'application_based', 'activity_based',
  'observation_based', 'diagram_based', 'picture_based', 'label_diagram', 'complete_diagram', 'numerical',
  'word_problem', 'oral', 'revision', 'sequence_arrangement', 'odd_one_out', 'passage_based',
];
const DIFFICULTIES: QuestionDifficulty[] = ['easy', 'medium', 'hard'];

const worksheetQuestionSchema = new Schema<IWorksheetQuestion>(
  {
    questionId: { type: String },
    questionText: { type: String, required: true, trim: true },
    questionType: { type: String, enum: QUESTION_TYPES, required: true },
    options: { type: [String] },
    difficulty: { type: String, enum: DIFFICULTIES, required: true },
    estimatedTimeMinutes: { type: Number, required: true, min: 0 },
    keywords: { type: [String], default: [] },
    imageRef: { type: imageRefSchema },
    imageRequirement: { type: imageRequirementSchema },
  },
  { _id: false }
);

const worksheetSchema = new Schema<IWorksheet>(
  {
    instituteId: { type: String, required: true },
    facultyId: { type: String, required: true },
    batch: { type: String, required: true, trim: true },
    track: { type: String, required: true, trim: true },
    trainingModuleIds: { type: [String], default: [] },
    trainingModuleNames: { type: [String], default: [] },
    worksheetType: { type: String, enum: WORKSHEET_TYPES, required: true },
    title: { type: String, required: true, trim: true },
    questions: { type: [worksheetQuestionSchema], default: [] },
    sourceType: { type: String, enum: ['module_bank', 'content_upload', 'photo_upload'], default: 'module_bank' },
    sourceContent: { type: String },
    aiReview: { type: String },
    attachmentUrl: { type: String },
    attachmentFileName: { type: String },
    createdBy: { type: String, required: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false }
);

worksheetSchema.index({ instituteId: 1, isDeleted: 1, facultyId: 1, batch: 1, track: 1, createdAt: -1 });
worksheetSchema.index({ instituteId: 1, isDeleted: 1, worksheetType: 1 });

export const Worksheet = mongoose.model<IWorksheet>('Worksheet', worksheetSchema);
