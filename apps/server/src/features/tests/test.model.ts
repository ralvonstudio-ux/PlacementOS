import mongoose, { Document, Schema } from 'mongoose';

export type TestStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected';
export type TestQuestionType = 'mcq' | 'short_answer' | 'coding';
export type TestAssignmentTargetType = 'batch' | 'candidates';
export type TestAssignmentStatus = 'active' | 'closed';
export type CodingLanguage = 'python' | 'java' | 'c' | 'cpp' | 'javascript';

const CODING_LANGUAGES = ['python', 'java', 'c', 'cpp', 'javascript'] as const;

export interface ITestCase {
  input: string;
  expectedOutput: string;
  hidden: boolean;
}

export interface ITestSection {
  title: string;
  description?: string;
  /** Question pool: how many of this section's questions each candidate draws at random. */
  pickCount?: number;
}

export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

export interface ITestQuestionSnapshot {
  questionText: string;
  questionType: TestQuestionType;
  options?: string[];
  correctAnswer?: string;
  marks: number;
  sectionIndex?: number;
  /** Coding questions only, below. */
  allowedLanguages?: CodingLanguage[];
  starterCode?: Partial<Record<CodingLanguage, string>>;
  testCases?: ITestCase[];
  /** Aptitude-style grouping — see TestQuestionSnapshot in @placementos/types. */
  section?: string;
  topic?: string;
  subTopic?: string;
  level?: QuestionDifficulty;
}

export interface ITest extends Document {
  instituteId: string;
  title: string;
  track?: string;
  description?: string;
  instructions?: string;
  sections: ITestSection[];
  questions: ITestQuestionSnapshot[];
  totalMarks: number;
  durationMinutes: number;
  violationLimit: number;
  /** Fullscreen exits tolerated (test pauses until restored); the next exit ends the attempt. */
  allowedFullscreenExits: number;
  /** Whether the candidate must keep a camera on / share their entire screen. Lab PCs often
   *  have no webcam, so either can be turned off per test. */
  requireCamera: boolean;
  requireScreenShare: boolean;
  status: TestStatus;
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

const testCaseSchema = new Schema<ITestCase>(
  {
    input: { type: String, default: '' },
    expectedOutput: { type: String, required: true },
    hidden: { type: Boolean, default: false },
  },
  { _id: false }
);

const sectionSchema = new Schema<ITestSection>(
  { title: { type: String, required: true, trim: true }, description: { type: String, trim: true }, pickCount: { type: Number, min: 1 } },
  { _id: false }
);

const testQuestionSchema = new Schema<ITestQuestionSnapshot>(
  {
    questionText: { type: String, required: true, trim: true },
    questionType: { type: String, enum: ['mcq', 'short_answer', 'coding'], required: true },
    options: { type: [String] },
    correctAnswer: { type: String, trim: true },
    marks: { type: Number, required: true, min: 0 },
    sectionIndex: { type: Number, min: 0, default: 0 },
    allowedLanguages: { type: [String], enum: CODING_LANGUAGES },
    starterCode: { type: Schema.Types.Mixed },
    testCases: { type: [testCaseSchema] },
    section: { type: String, trim: true },
    topic: { type: String, trim: true },
    subTopic: { type: String, trim: true },
    level: { type: String, enum: ['easy', 'medium', 'hard'] },
  },
  { _id: false }
);

const testSchema = new Schema<ITest>(
  {
    instituteId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    track: { type: String, trim: true },
    description: { type: String, trim: true },
    instructions: { type: String, trim: true },
    sections: { type: [sectionSchema], default: [] },
    questions: { type: [testQuestionSchema], default: [] },
    totalMarks: { type: Number, required: true, min: 0 },
    durationMinutes: { type: Number, required: true, min: 1 },
    violationLimit: { type: Number, required: true, min: 1, default: 3 },
    allowedFullscreenExits: { type: Number, min: 0, default: 1 },
    requireCamera: { type: Boolean, default: true },
    requireScreenShare: { type: Boolean, default: true },
    status: { type: String, enum: ['draft', 'pending_approval', 'approved', 'rejected'], default: 'draft' },
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

testSchema.index({ instituteId: 1, isDeleted: 1, status: 1 });

export const Test = mongoose.model<ITest>('Test', testSchema);

export interface ITestAssignment extends Document {
  instituteId: string;
  testId: string;
  targetType: TestAssignmentTargetType;
  /** Set iff targetType === 'batch'. */
  batch?: string;
  /** Set iff targetType === 'candidates'. */
  candidateIds?: string[];
  /** Optional — the assignment can't be started before this time, even while active. */
  scheduledAt?: Date;
  /** bcrypt hash of the one-time access code issued (via notification) when this sendout
   *  opens. Never store or transmit the plaintext code — only this hash, compared at `start()`. */
  accessCodeHash?: string;
  /** Set the moment the access code is generated + notifications are sent — guards against
   *  issuing (and notifying about) the code twice for the same assignment. */
  accessCodeIssuedAt?: Date;
  status: TestAssignmentStatus;
  /** Set only on assignments created by the one-time legacy migration (see test-migration.ts) —
   *  paired with the partial unique index below to make that migration idempotent even if two
   *  serverless cold starts race on the same legacy test. */
  migratedFromLegacy?: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const testAssignmentSchema = new Schema<ITestAssignment>(
  {
    instituteId: { type: String, required: true, index: true },
    testId: { type: String, required: true },
    targetType: { type: String, enum: ['batch', 'candidates'], required: true },
    batch: { type: String, trim: true },
    candidateIds: { type: [String] },
    scheduledAt: { type: Date },
    accessCodeHash: { type: String },
    accessCodeIssuedAt: { type: Date },
    status: { type: String, enum: ['active', 'closed'], default: 'active' },
    migratedFromLegacy: { type: Boolean },
    createdBy: { type: String, required: true },
  },
  { timestamps: true, versionKey: false }
);

testAssignmentSchema.index({ instituteId: 1, status: 1, batch: 1 });
testAssignmentSchema.index({ instituteId: 1, candidateIds: 1 });
testAssignmentSchema.index({ testId: 1 }, { unique: true, partialFilterExpression: { migratedFromLegacy: true } });

export const TestAssignment = mongoose.model<ITestAssignment>('TestAssignment', testAssignmentSchema);

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
  | 'extension_detected'
  | 'multiple_screens';

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
  'multiple_screens',
] as const;

export interface ITestViolation {
  type: TestViolationType;
  at: Date;
  detail?: string;
}

export interface ICodeSubmission {
  code: string;
  language: CodingLanguage;
  passedCount: number;
  totalCount: number;
  submittedAt: Date;
}

export interface ITestAnswer {
  questionIndex: number;
  selectedOption?: string;
  answerText?: string;
  code?: string;
  language?: CodingLanguage;
  submission?: ICodeSubmission;
}

export type QuestionResultStatus = 'correct' | 'wrong' | 'partial' | 'skipped' | 'not_viewed';

export interface ITestProctoringInfo {
  ipAddresses: string[];
  os?: string;
  browser?: string;
}

export interface ITestQuestionResult {
  questionIndex: number;
  status: QuestionResultStatus;
  marksObtained: number;
}

export interface ITestAttempt extends Document {
  instituteId: string;
  testId: string;
  assignmentId: string;
  candidateId: string;
  startedAt: Date;
  submittedAt?: Date;
  autoSubmitted: boolean;
  answers: ITestAnswer[];
  violations: ITestViolation[];
  score?: number;
  status: TestAttemptStatus;
  /** Question indexes the candidate's client reported as displayed at least once — see
   *  TestAttempt.viewedQuestionIndexes in @placementos/types. */
  viewedQuestionIndexes: number[];
  /** A per-attempt permutation of the test's original question indexes, generated once when
   *  the attempt is created — e.g. [2, 0, 1] means "this candidate's 1st question is the
   *  paper's 3rd question". Every candidate on the same paper sees a different order, which
   *  defeats "answer to question N is X" cheat-sheets shared between candidates. Client-facing
   *  indexes (submitAnswer, markViewed, runCode) are always positions in this shuffled order;
   *  they're translated back to the original index before being persisted here, so scoring
   *  (which reads test.questions by its own original order) needs no changes. Empty on
   *  attempts created before this field existed — callers fall back to the identity order. */
  questionOrder: number[];
  proctoring?: ITestProctoringInfo;
  resumeCount: number;
  questionResults?: ITestQuestionResult[];
  /** Audit trail: starts, resumes, session takeovers/blocks, IP changes, violations, submits. */
  events: ITestAttemptEvent[];
  /** The one browser session allowed to drive this attempt right now — see test.service's
   *  session lock. `lastSeenAt` is refreshed by every candidate request and the heartbeat. */
  activeSession?: { id: string; ip?: string; device?: string; lastSeenAt: Date };
  /** Distinct browser sessions that have driven this attempt. */
  sessionCount: number;
  /** A resume from a new network was refused and is waiting on staff. */
  newDeviceBlocked: boolean;
  /** Staff allowed the next resume to come from a new device/network (one-shot). */
  allowNewDevice: boolean;
  terminationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const violationSchema = new Schema<ITestViolation>(
  { type: { type: String, enum: TEST_VIOLATION_TYPES, required: true }, at: { type: Date, required: true }, detail: { type: String, trim: true } },
  { _id: false }
);

const codeSubmissionSchema = new Schema<ICodeSubmission>(
  {
    code: { type: String, required: true },
    language: { type: String, enum: CODING_LANGUAGES, required: true },
    passedCount: { type: Number, required: true },
    totalCount: { type: Number, required: true },
    submittedAt: { type: Date, required: true },
  },
  { _id: false }
);

const answerSchema = new Schema<ITestAnswer>(
  {
    questionIndex: { type: Number, required: true },
    selectedOption: { type: String },
    answerText: { type: String },
    code: { type: String },
    language: { type: String, enum: CODING_LANGUAGES },
    submission: { type: codeSubmissionSchema },
  },
  { _id: false }
);

const proctoringSchema = new Schema<ITestProctoringInfo>(
  { ipAddresses: { type: [String], default: [] }, os: { type: String }, browser: { type: String } },
  { _id: false }
);

export type TestAttemptEventType =
  | 'started'
  | 'resumed'
  | 'session_takeover'
  | 'session_blocked'
  | 'ip_changed'
  | 'violation'
  | 'code_submitted'
  | 'submitted'
  | 'auto_submitted'
  | 'force_submitted'
  | 'new_device_allowed';

export interface ITestAttemptEvent {
  type: TestAttemptEventType;
  at: Date;
  ip?: string;
  device?: string;
  detail?: string;
}

const attemptEventSchema = new Schema<ITestAttemptEvent>(
  {
    type: {
      type: String,
      enum: ['started', 'resumed', 'session_takeover', 'session_blocked', 'ip_changed', 'violation', 'code_submitted', 'submitted', 'auto_submitted', 'force_submitted', 'new_device_allowed'],
      required: true,
    },
    at: { type: Date, required: true },
    ip: { type: String },
    device: { type: String },
    detail: { type: String },
  },
  { _id: false }
);

const activeSessionSchema = new Schema(
  { id: { type: String, required: true }, ip: { type: String }, device: { type: String }, lastSeenAt: { type: Date, required: true } },
  { _id: false }
);

const questionResultSchema = new Schema<ITestQuestionResult>(
  {
    questionIndex: { type: Number, required: true },
    status: { type: String, enum: ['correct', 'wrong', 'partial', 'skipped', 'not_viewed'], required: true },
    marksObtained: { type: Number, required: true },
  },
  { _id: false }
);

const testAttemptSchema = new Schema<ITestAttempt>(
  {
    instituteId: { type: String, required: true, index: true },
    testId: { type: String, required: true },
    assignmentId: { type: String, required: true },
    candidateId: { type: String, required: true },
    startedAt: { type: Date, required: true },
    submittedAt: { type: Date },
    autoSubmitted: { type: Boolean, default: false },
    answers: { type: [answerSchema], default: [] },
    violations: { type: [violationSchema], default: [] },
    score: { type: Number },
    status: { type: String, enum: ['in_progress', 'submitted'], default: 'in_progress' },
    viewedQuestionIndexes: { type: [Number], default: [] },
    questionOrder: { type: [Number], default: [] },
    proctoring: { type: proctoringSchema },
    resumeCount: { type: Number, default: 0 },
    questionResults: { type: [questionResultSchema] },
    events: { type: [attemptEventSchema], default: [] },
    activeSession: { type: activeSessionSchema },
    sessionCount: { type: Number, default: 0 },
    newDeviceBlocked: { type: Boolean, default: false },
    allowNewDevice: { type: Boolean, default: false },
    terminationReason: { type: String },
  },
  { timestamps: true, versionKey: false }
);

// One attempt per candidate per assignment — a candidate can't start a second attempt at the
// same sendout (they could, in principle, be assigned the same underlying paper twice via two
// different assignments, and each gets its own attempt).
testAttemptSchema.index({ instituteId: 1, assignmentId: 1, candidateId: 1 }, { unique: true });

export const TestAttempt = mongoose.model<ITestAttempt>('TestAttempt', testAttemptSchema);
