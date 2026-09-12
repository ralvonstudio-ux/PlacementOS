import mongoose, { Document, Schema } from 'mongoose';

export type QuestionKind =
  | 'mcq' | 'fill_blank' | 'true_false' | 'assertion_reason' | 'very_short' | 'short' | 'long' | 'hots' | 'case_study'
  | 'multi_correct' | 'match_following' | 'one_word' | 'competency_based' | 'application_based' | 'activity_based'
  | 'observation_based' | 'diagram_based' | 'picture_based' | 'label_diagram' | 'complete_diagram' | 'numerical'
  | 'word_problem' | 'oral' | 'revision' | 'sequence_arrangement' | 'odd_one_out' | 'passage_based';

export type QuestionDifficulty = 'easy' | 'medium' | 'hard';
export type QuestionBloomsLevel = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';

export interface IBankQuestionUsageEntry {
  examId?: string;
  usedAt: Date;
}

export interface IBankQuestionSourceRef {
  sourceId: string;
  pageNumber?: number;
  blockIndex?: number;
}

export interface IBankQuestionImageRef {
  sourceId: string;
  figureId: string;
}

export interface IBankQuestionImageRequirement {
  imageRequired: true;
  imageSource: 'generated' | 'faculty_upload';
  imagePrompt?: string;
}

export interface IBankQuestion extends Document {
  instituteId: string;
  batch: string;
  track: string;
  trainingModuleId: string;
  trainingModuleName: string;
  topic?: string;
  topicId?: string;
  subtopicId?: string;
  questionText: string;
  questionType: QuestionKind;
  options?: string[];
  correctAnswer?: string;
  difficulty: QuestionDifficulty;
  marks: number;
  estimatedTimeMinutes: number;
  bloomsLevel: QuestionBloomsLevel;
  keywords: string[];
  source?: string;
  usageHistory: IBankQuestionUsageEntry[];
  createdBy: string;
  isDeleted: boolean;
  deletedAt?: Date;
  sourceRef?: IBankQuestionSourceRef;
  imageRef?: IBankQuestionImageRef;
  imageRequirement?: IBankQuestionImageRequirement;
  visualBased: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const QUESTION_TYPES: QuestionKind[] = [
  'mcq', 'fill_blank', 'true_false', 'assertion_reason', 'very_short', 'short', 'long', 'hots', 'case_study',
  'multi_correct', 'match_following', 'one_word', 'competency_based', 'application_based', 'activity_based',
  'observation_based', 'diagram_based', 'picture_based', 'label_diagram', 'complete_diagram', 'numerical',
  'word_problem', 'oral', 'revision', 'sequence_arrangement', 'odd_one_out', 'passage_based',
];
const DIFFICULTIES: QuestionDifficulty[] = ['easy', 'medium', 'hard'];
const BLOOMS_LEVELS: QuestionBloomsLevel[] = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];

const usageEntrySchema = new Schema<IBankQuestionUsageEntry>(
  { examId: { type: String }, usedAt: { type: Date, required: true } },
  { _id: false }
);

const sourceRefSchema = new Schema<IBankQuestionSourceRef>(
  { sourceId: { type: String, required: true }, pageNumber: { type: Number }, blockIndex: { type: Number } },
  { _id: false }
);

export const imageRefSchema = new Schema<IBankQuestionImageRef>(
  { sourceId: { type: String, required: true }, figureId: { type: String, required: true } },
  { _id: false }
);

export const imageRequirementSchema = new Schema<IBankQuestionImageRequirement>(
  {
    imageRequired: { type: Boolean, required: true },
    imageSource: { type: String, enum: ['generated', 'faculty_upload'], required: true },
    imagePrompt: { type: String },
  },
  { _id: false }
);

const bankQuestionSchema = new Schema<IBankQuestion>(
  {
    instituteId: { type: String, required: true },
    batch: { type: String, required: true, trim: true },
    track: { type: String, required: true, trim: true },
    trainingModuleId: { type: String, required: true },
    trainingModuleName: { type: String, required: true, trim: true },
    topic: { type: String, trim: true },
    topicId: { type: String },
    subtopicId: { type: String },
    questionText: { type: String, required: true, trim: true },
    questionType: { type: String, enum: QUESTION_TYPES, required: true },
    options: { type: [String] },
    correctAnswer: { type: String, trim: true },
    difficulty: { type: String, enum: DIFFICULTIES, required: true },
    marks: { type: Number, required: true, min: 0 },
    estimatedTimeMinutes: { type: Number, required: true, min: 0 },
    bloomsLevel: { type: String, enum: BLOOMS_LEVELS, required: true },
    keywords: { type: [String], default: [] },
    source: { type: String, trim: true },
    usageHistory: { type: [usageEntrySchema], default: [] },
    createdBy: { type: String, required: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    sourceRef: { type: sourceRefSchema },
    imageRef: { type: imageRefSchema },
    imageRequirement: { type: imageRequirementSchema },
    visualBased: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false }
);

// Runs on both save() and insertMany() so every creation path gets this stamped automatically.
bankQuestionSchema.pre('validate', function stampVisualBased(next) {
  this.visualBased = Boolean(this.imageRef || this.imageRequirement);
  next();
});

bankQuestionSchema.index({ instituteId: 1, isDeleted: 1, batch: 1, track: 1 });
bankQuestionSchema.index({ instituteId: 1, isDeleted: 1, trainingModuleId: 1 });
bankQuestionSchema.index({ instituteId: 1, isDeleted: 1, difficulty: 1 });
bankQuestionSchema.index({ instituteId: 1, isDeleted: 1, questionType: 1 });
bankQuestionSchema.index({ questionText: 'text', keywords: 'text', topic: 'text' });

export const BankQuestion = mongoose.model<IBankQuestion>('BankQuestion', bankQuestionSchema);
