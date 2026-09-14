import mongoose, { Document, Schema } from 'mongoose';

export type TestStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'published' | 'closed';
export type TestQuestionType = 'mcq' | 'short_answer';

export interface ITestQuestionSnapshot {
  questionText: string;
  questionType: TestQuestionType;
  options?: string[];
  correctAnswer?: string;
  marks: number;
}

export interface ITest extends Document {
  instituteId: string;
  title: string;
  batch: string;
  track?: string;
  questions: ITestQuestionSnapshot[];
  totalMarks: number;
  durationMinutes: number;
  violationLimit: number;
  status: TestStatus;
  /** Optional — the test can't be started before this time, even once published. */
  scheduledAt?: Date;
  /** bcrypt hash of the one-time access code issued (via notification) when the test opens.
   *  Never store or transmit the plaintext code — only this hash, compared at `start()`. */
  accessCodeHash?: string;
  /** Set the moment the access code is generated + notifications are sent — guards against
   *  issuing (and notifying about) the code twice for the same test. */
  accessCodeIssuedAt?: Date;
  /** The faculty-given label for the uploaded/pasted source material, and the topic
   *  it covers — both optional, only meaningful when the test was AI-drafted. */
  contentName?: string;
  topic?: string;
  /** Raw pasted/extracted text this test was generated from, when aiGenerated is true. */
  sourceContent?: string;
  aiGenerated?: boolean;
  /** AI's own short review of the draft, shown to the faculty member before they edit it. */
  aiReview?: string;
  /** Set by whoever approves/rejects a pending_approval test. */
  reviewNote?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  createdBy: string;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const testQuestionSchema = new Schema<ITestQuestionSnapshot>(
  {
    questionText: { type: String, required: true, trim: true },
    questionType: { type: String, enum: ['mcq', 'short_answer'], required: true },
    options: { type: [String] },
    correctAnswer: { type: String, trim: true },
    marks: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const testSchema = new Schema<ITest>(
  {
    instituteId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    batch: { type: String, required: true, trim: true },
    track: { type: String, trim: true },
    questions: { type: [testQuestionSchema], default: [] },
    totalMarks: { type: Number, required: true, min: 0 },
    durationMinutes: { type: Number, required: true, min: 1 },
    violationLimit: { type: Number, required: true, min: 1, default: 3 },
    status: { type: String, enum: ['draft', 'pending_approval', 'approved', 'rejected', 'published', 'closed'], default: 'draft' },
    scheduledAt: { type: Date },
    accessCodeHash: { type: String },
    accessCodeIssuedAt: { type: Date },
    contentName: { type: String, trim: true },
    topic: { type: String, trim: true },
    sourceContent: { type: String },
    aiGenerated: { type: Boolean, default: false },
    aiReview: { type: String },
    reviewNote: { type: String, trim: true },
    reviewedBy: { type: String },
    reviewedAt: { type: Date },
    createdBy: { type: String, required: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false }
);

testSchema.index({ instituteId: 1, isDeleted: 1, batch: 1, status: 1 });

export const Test = mongoose.model<ITest>('Test', testSchema);

export type TestAttemptStatus = 'in_progress' | 'submitted';
export type TestViolationType =
  | 'tab_switch'
  | 'window_blur'
  | 'fullscreen_exit'
  | 'copy_paste'
  | 'right_click'
  | 'devtools'
  | 'no_face'
  | 'screen_share_stopped'
  | 'extension_detected';

const TEST_VIOLATION_TYPES = [
  'tab_switch',
  'window_blur',
  'fullscreen_exit',
  'copy_paste',
  'right_click',
  'devtools',
  'no_face',
  'screen_share_stopped',
  'extension_detected',
] as const;

export interface ITestViolation {
  type: TestViolationType;
  at: Date;
  detail?: string;
}

export interface ITestAnswer {
  questionIndex: number;
  selectedOption?: string;
  answerText?: string;
}

export interface ITestAttempt extends Document {
  instituteId: string;
  testId: string;
  candidateId: string;
  startedAt: Date;
  submittedAt?: Date;
  autoSubmitted: boolean;
  answers: ITestAnswer[];
  violations: ITestViolation[];
  score?: number;
  status: TestAttemptStatus;
  createdAt: Date;
  updatedAt: Date;
}

const violationSchema = new Schema<ITestViolation>(
  { type: { type: String, enum: TEST_VIOLATION_TYPES, required: true }, at: { type: Date, required: true }, detail: { type: String, trim: true } },
  { _id: false }
);

const answerSchema = new Schema<ITestAnswer>(
  { questionIndex: { type: Number, required: true }, selectedOption: { type: String }, answerText: { type: String } },
  { _id: false }
);

const testAttemptSchema = new Schema<ITestAttempt>(
  {
    instituteId: { type: String, required: true, index: true },
    testId: { type: String, required: true },
    candidateId: { type: String, required: true },
    startedAt: { type: Date, required: true },
    submittedAt: { type: Date },
    autoSubmitted: { type: Boolean, default: false },
    answers: { type: [answerSchema], default: [] },
    violations: { type: [violationSchema], default: [] },
    score: { type: Number },
    status: { type: String, enum: ['in_progress', 'submitted'], default: 'in_progress' },
  },
  { timestamps: true, versionKey: false }
);

// One attempt per candidate per test — a candidate can't start a second attempt at the same test.
testAttemptSchema.index({ instituteId: 1, testId: 1, candidateId: 1 }, { unique: true });

export const TestAttempt = mongoose.model<ITestAttempt>('TestAttempt', testAttemptSchema);
