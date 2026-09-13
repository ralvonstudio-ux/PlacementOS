// @placementos/types — shared type definitions for PlacementOS
// Mirrors @schoolos/types conventions: always use `_id` for entity ids.

export type UserRole = 'admin' | 'tpo' | 'faculty' | 'candidate';

export const INTERNAL_INSTITUTE_ID = 'INTERNAL';
export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  username?: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl?: string;
  lastLoginAt?: string;
  instituteId: string;
  employeeId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Institute {
  _id: string;
  name: string;
  code: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
  createdAt: string;
  updatedAt: string;
}

export type FacultyEmploymentStatus = 'applicant' | 'active' | 'on_leave' | 'suspended' | 'resigned' | 'retired' | 'inactive';
export type FacultyGender = 'male' | 'female' | 'other';

export interface Faculty {
  _id: string;
  instituteId: string;
  fullName: string;
  gender: FacultyGender;
  dateOfBirth?: string;
  employeeId: string;
  photoUrl?: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  /** Admin-issued login address — separate from `email`, the faculty member's own contact address. */
  loginEmail?: string;
  department?: string;
  tracks: string[];
  assignedBatches: string[];
  experienceYears?: number;
  joiningDate?: string;
  employmentStatus: FacultyEmploymentStatus;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Candidate {
  _id: string;
  instituteId: string;
  fullName: string;
  rollNumber: string;
  batch: string;
  department: string;
  email?: string;
  phone?: string;
  placementYear: string;
  status: 'active' | 'inactive' | 'placed';
  /** Admin/TPO-issued login address — separate from `email`, mirrors Faculty.loginEmail. */
  loginEmail?: string;
  /** Faculty-attached note, editable from the batch roster's edit view only —
   *  never shown on the attendance-marking screen itself. */
  facultyNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCandidateLoginPayload {
  loginEmail: string;
  password: string;
}

// ── Attendance ────────────────────────────────────────────────────────────
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface AttendanceRecord {
  _id: string;
  instituteId: string;
  candidateId: string;
  batch: string;
  track: string;
  date: string;
  status: AttendanceStatus;
  markedBy: string;
  createdAt: string;
  updatedAt: string;
  note?: string;
}

// ── Leave Requests ───────────────────────────────────────────────────────
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequest {
  _id: string;
  instituteId: string;
  facultyId: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: LeaveStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  createdAt: string;
  updatedAt: string;
  /** Joined in on TPO-facing list/approval endpoints. */
  facultyName?: string;
}

// ── Training Schedule (was Timetable) ───────────────────────────────────
export interface TrainingScheduleEntry {
  _id: string;
  instituteId: string;
  batch: string;
  track: string;
  facultyId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string;
  placementYear: string;
  /** Period slot this entry was placed in, when entered via the timetable grid.
   *  Freeform entries (created before period slots existed, or via the API
   *  directly) may leave this unset — startTime/endTime remain the source of truth. */
  slotId?: string;
  createdAt: string;
  updatedAt: string;
  /** Joined in on grid/master-grid responses. */
  facultyName?: string;
}

// ── Timetable period slots (institute-wide bell schedule) ─────────────────
export interface PeriodSlot {
  _id: string;
  instituteId: string;
  name: string;
  orderIndex: number;
  startTime: string;
  endTime: string;
  isBreak: boolean;
  daysApplicable: number[];
  createdAt: string;
  updatedAt: string;
}

export interface CreatePeriodSlotPayload {
  name: string;
  startTime: string;
  endTime: string;
  isBreak?: boolean;
  daysApplicable?: number[];
}

export type UpdatePeriodSlotPayload = Partial<CreatePeriodSlotPayload>;

// ── Timetable conflicts ────────────────────────────────────────────────────
export interface ConflictInfo {
  type: 'faculty_double_booked' | 'room_double_booked';
  dayOfWeek: number;
  slotId?: string;
  startTime: string;
  endTime: string;
  entryIds: string[];
  facultyId?: string;
  facultyName?: string;
  room?: string;
  message: string;
}

// ── Timetable master grid (whole-institute view) ───────────────────────────
export interface MasterGridQuery {
  placementYear: string;
  batch?: string;
}

export interface MasterGridCell {
  dayOfWeek: number;
  slotId: string;
  batch: string;
  entry?: TrainingScheduleEntry;
}

export interface MasterGridResponse {
  slots: PeriodSlot[];
  batches: string[];
  cells: MasterGridCell[];
  conflicts: ConflictInfo[];
}

export interface SetMasterGridCellPayload {
  batch: string;
  track: string;
  facultyId: string;
  dayOfWeek: number;
  slotId: string;
  placementYear: string;
  room?: string;
  /** Existing entry id to update instead of creating a new one — pass when
   *  editing a cell that's already filled. */
  entryId?: string;
}

// ── Timetable substitutes ──────────────────────────────────────────────────
export type SubstituteStatus = 'pending' | 'assigned' | 'cancelled';

export interface TimetableSubstitute {
  _id: string;
  instituteId: string;
  date: string;
  entryId: string;
  originalFacultyId: string;
  substituteFacultyId?: string;
  reason?: string;
  status: SubstituteStatus;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  /** Joined in on list/needs-substitute responses. */
  originalFacultyName?: string;
  substituteFacultyName?: string;
  batch?: string;
  track?: string;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
}

export interface CreateSubstitutePayload {
  date: string;
  entryId: string;
  reason?: string;
  substituteFacultyId?: string;
}

export interface UpdateSubstitutePayload {
  substituteFacultyId?: string;
  status?: SubstituteStatus;
  reason?: string;
}

/** A schedule entry on a given date whose faculty is on approved leave and
 *  has no substitute assigned yet — backs the "Needs Substitute" worklist. */
export interface NeedsSubstituteEntry {
  date: string;
  entry: TrainingScheduleEntry;
  facultyName: string;
  leaveRequestId: string;
}

export interface SubstituteSuggestion {
  facultyId: string;
  facultyName: string;
  /** True when this faculty already teaches the same track (best-fit first). */
  sameTrack: boolean;
  /** True when the faculty has no other entry in this day/slot. */
  available: boolean;
}

// ── Training Plan (was Academic Plan) ────────────────────────────────────
export type TrainingPlanBlockType = 'module' | 'assessment' | 'event' | 'holiday' | 'other';
export type TrainingPlanStatus = 'planned' | 'in_progress' | 'completed' | 'skipped';

export interface TrainingPlanDay {
  date: string;
  blockType: TrainingPlanBlockType;
  moduleId?: string;
  title: string;
  status: TrainingPlanStatus;
  notes?: string;
  /** Set when a module was picked for this day — lets the UI show the
   *  module's canonical name alongside a custom `title`/topic. */
  moduleName?: string;
  /** Set when carry-forward pushed an incomplete day onto this date. */
  carriedFromDate?: string;
  /** True once a faculty member hand-edits an auto-generated day. */
  manuallyEdited?: boolean;
}

export interface TrainingPlan {
  _id: string;
  instituteId: string;
  facultyId: string;
  batch: string;
  track: string;
  weekStartDate: string;
  days: TrainingPlanDay[];
  createdAt: string;
  updatedAt: string;
  /** Incremented each time the plan is (re)generated. */
  version?: number;
}

// ── Module Tracker (was Syllabus Tracker) ────────────────────────────────
export interface TrainingModule {
  _id: string;
  instituteId: string;
  track: string;
  name: string;
  description?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface ModuleProgress {
  _id: string;
  instituteId: string;
  batch: string;
  track: string;
  moduleId: string;
  status: 'not_started' | 'in_progress' | 'completed';
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Question Bank ─────────────────────────────────────────────────────────
export type QuestionDifficulty = 'easy' | 'medium' | 'hard';
export type QuestionType = 'mcq' | 'short_answer' | 'long_answer' | 'coding' | 'true_false';

export interface QuestionOption {
  text: string;
  isCorrect: boolean;
}

export interface Question {
  _id: string;
  instituteId: string;
  track: string;
  trainingModuleId: string;
  type: QuestionType;
  text: string;
  options?: QuestionOption[];
  answerKey?: string;
  difficulty: QuestionDifficulty;
  imageUrl?: string;
  sourceId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionSource {
  _id: string;
  instituteId: string;
  track: string;
  trainingModuleId: string;
  fileUrl?: string;
  rawText?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type ExtractionJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ExtractionJob {
  _id: string;
  instituteId: string;
  sourceId: string;
  status: ExtractionJobStatus;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionPaper {
  _id: string;
  instituteId: string;
  title: string;
  track: string;
  trainingModuleIds: string[];
  questionIds: string[];
  totalMarks: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ── Worksheet Generator ──────────────────────────────────────────────────
export interface Worksheet {
  _id: string;
  instituteId: string;
  title: string;
  track: string;
  trainingModuleId: string;
  questionIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ── TPO overview ─────────────────────────────────────────────────────────
export interface TpoOverviewEntry {
  batch: string;
  track: string;
  facultyName: string;
  questionCount: number;
  paperCount: number;
  lastActivityAt?: string;
}

// ── Auth / API envelope ──────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { message: string; code?: string };
}

export interface AuthUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  instituteId: string;
  mustResetPassword?: boolean;
  mustResetPin?: boolean;
}

export interface LoginPayload {
  identifier: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  sessionId: string;
  user: AuthUser;
  mustResetPassword?: boolean;
  mustResetPin?: boolean;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

// ── Question Bank (rich domain) ───────────────────────────────────────────
// The stub Question/QuestionType/QuestionSource/QuestionPaper/Worksheet types above stay as-is
// (additive-only rule) — the real question-bank feature needs a considerably richer shape (AI
// extraction drafts, layout-aware chapter/module capture, figure crops, paper/worksheet assembly),
// so those are added below under distinct names rather than redefining the existing stubs.
// Renames applied vs. the SchoolOS source: class/subject -> batch/track, chapter -> trainingModule.

export type QuestionKind =
  | 'mcq'
  | 'fill_blank'
  | 'true_false'
  | 'assertion_reason'
  | 'very_short'
  | 'short'
  | 'long'
  | 'hots'
  | 'case_study'
  | 'multi_correct'
  | 'match_following'
  | 'one_word'
  | 'competency_based'
  | 'application_based'
  | 'activity_based'
  | 'observation_based'
  | 'diagram_based'
  | 'picture_based'
  | 'label_diagram'
  | 'complete_diagram'
  | 'numerical'
  | 'word_problem'
  | 'oral'
  | 'revision'
  | 'sequence_arrangement'
  | 'odd_one_out'
  | 'passage_based';

export type QuestionBloomsLevel = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';

export type ModuleDifficulty = 'easy' | 'moderate' | 'hard';
export type ModulePriority = 'core' | 'important' | 'supplementary';
export type ModuleExtractionStatus = 'unprocessed' | 'processing' | 'processed';

export interface ModuleSubtopicNode {
  subtopicId: string;
  name: string;
  order: number;
}

export interface ModuleTopicNode {
  topicId: string;
  name: string;
  order: number;
  subtopics: ModuleSubtopicNode[];
}

/** Full training-module record used by the question-bank/worksheet-generator features — richer
 * than the base `TrainingModule` (adds topic tree, AI chapter-capture extraction status, etc.),
 * so it's its own type rather than an edit to `TrainingModule`. */
export interface TrainingModuleRecord {
  _id: string;
  instituteId: string;
  batch: string;
  track: string;
  moduleName: string;
  topics: string[];
  topicTree?: ModuleTopicNode[];
  order?: number;
  estimatedPeriods?: number;
  difficulty?: ModuleDifficulty;
  priority?: ModulePriority;
  revisionWeight?: number;
  extractionStatus: ModuleExtractionStatus;
  sourceContentHash?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BankQuestionUsageEntry {
  examId?: string;
  usedAt: string;
}

export interface BankQuestionSourceRef {
  sourceId: string;
  pageNumber?: number;
  blockIndex?: number;
}

/** Points a picture-based question at an actual figure detected in an upload — never a
 * standalone image, always traceable back to the source/page it came from. */
export interface BankQuestionImageRef {
  sourceId: string;
  figureId: string;
}

/** Set instead of imageRef when a question genuinely calls for a picture but none of the
 * uploaded content's detected figures fit. */
export interface BankQuestionImageRequirement {
  imageRequired: true;
  imageSource: 'generated' | 'faculty_upload';
  imagePrompt?: string;
}

/** Rich question-bank question record — distinct from the minimal `Question` stub above. */
export interface BankQuestion {
  _id: string;
  instituteId: string;
  batch: string;
  track: string;
  trainingModuleId: string;
  trainingModuleName: string; // denormalized for display without an extra lookup
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
  usageHistory: BankQuestionUsageEntry[];
  createdBy: string;
  isDeleted: boolean;
  sourceRef?: BankQuestionSourceRef;
  imageRef?: BankQuestionImageRef;
  imageRequirement?: BankQuestionImageRequirement;
  visualBased: boolean;
}

export interface CreateBankQuestionPayload {
  batch: string;
  track: string;
  trainingModuleName: string;
  topic?: string;
  questionText: string;
  questionType: QuestionKind;
  options?: string[];
  correctAnswer?: string;
  difficulty: QuestionDifficulty;
  marks: number;
  estimatedTimeMinutes: number;
  bloomsLevel: QuestionBloomsLevel;
  keywords?: string[];
  source?: string;
  imageRef?: BankQuestionImageRef;
  imageRequirement?: BankQuestionImageRequirement;
}

export type UpdateBankQuestionPayload = Partial<CreateBankQuestionPayload>;

export interface BankQuestionListOptions {
  page?: number;
  limit?: number;
  batch?: string;
  track?: string;
  trainingModuleId?: string;
  topic?: string;
  difficulty?: QuestionDifficulty;
  questionType?: QuestionKind;
  search?: string;
}

/** One row per batch/track/trainingModule — backs the Question Bank landing view. */
export interface BankQuestionGroup {
  batch: string;
  track: string;
  trainingModuleId: string;
  trainingModuleName: string;
  count: number;
}

export interface BankQuestionGroupListOptions {
  batch?: string;
  track?: string;
  search?: string;
}

// ── Question extraction (AI upload -> draft -> review -> confirm) ────────────

export interface ExtractedQuestionDraft {
  questionText: string;
  questionType: QuestionKind;
  options?: string[];
  correctAnswer?: string;
  difficulty: QuestionDifficulty;
  marks: number;
  estimatedTimeMinutes: number;
  bloomsLevel: QuestionBloomsLevel;
  keywords: string[];
  trainingModuleName: string;
  topic?: string;
  topicId?: string;
  subtopicId?: string;
  source?: string;
  sourceRef?: BankQuestionSourceRef;
  imageRef?: BankQuestionImageRef;
  imageRequirement?: BankQuestionImageRequirement;
}

export interface QuestionExtractionResult {
  sourceType: 'image' | 'pdf_text';
  extracted: ExtractedQuestionDraft[];
  warnings: string[];
  sourceId?: string;
}

/** Faculty-selected controls for a (re-)generation run. */
export interface QuestionGenerationOptions {
  count: number;
  difficulty: QuestionDifficulty | 'mixed';
  languageComplexity?: LanguageComplexity;
  includeImages?: boolean;
}

export type LanguageComplexity = 'auto' | 'simple' | 'standard' | 'advanced';

/** Result of an upload that only transcribes/stores text — no question drafts yet. */
export interface TextExtractionResult {
  sourceId: string;
  sourceType: 'image' | 'pdf_text';
  fileName?: string;
  extractedText: string;
  warnings: string[];
}

export interface ConfirmExtractedQuestionsPayload {
  batch: string;
  track: string;
  questions: ExtractedQuestionDraft[];
}

// ── Structured module capture (layout-aware OCR) ──────────────────────────────

export type BlockConfidence = 'high' | 'review' | 'low';

export interface HeadingBlock {
  type: 'heading';
  level: 1 | 2 | 3;
  text: string;
  confidence?: BlockConfidence;
}

export interface ParagraphBlock {
  type: 'paragraph';
  text: string;
  confidence?: BlockConfidence;
}

export interface ListBlockItem {
  text: string;
  items?: ListBlockItem[];
}

export interface ListBlock {
  type: 'list';
  ordered: boolean;
  items: ListBlockItem[];
  confidence?: BlockConfidence;
}

export interface TableBlock {
  type: 'table';
  caption?: string;
  headers: string[];
  rows: string[][];
  confidence?: BlockConfidence;
}

export interface EquationBlock {
  type: 'equation';
  latex: string;
  displayText?: string;
  confidence?: BlockConfidence;
}

export interface FigureBlock {
  type: 'figure';
  figureNumber?: string;
  caption?: string;
  labels?: string[];
  confidence?: BlockConfidence;
}

export interface NoteBlock {
  type: 'note' | 'quote';
  text: string;
  confidence?: BlockConfidence;
}

export type ContentBlock = HeadingBlock | ParagraphBlock | ListBlock | TableBlock | EquationBlock | FigureBlock | NoteBlock;

// ── Picture-based questions (image-aware generation) ──────────────────────────

/** Fractional (0-1) crop region within the full page image. */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type FigureType = 'decorative' | 'content_supporting' | 'diagram' | 'chart_table' | 'map' | 'illustration';

export interface PageFigure {
  figureId: string;
  pageNumber: number;
  boundingBox: BoundingBox;
  figureType: FigureType;
  caption?: string;
  description: string;
  usableForQuestion: boolean;
}

export interface ModulePage {
  pageNumber: number;
  blocks: ContentBlock[];
  confidence?: BlockConfidence;
  pageError?: string;
  pageImageFileId?: string;
  figures?: PageFigure[];
}

/** Async batch job covering every page of a module capture. */
export interface ModuleCaptureJobResult {
  documentTitle?: string;
  language?: string;
  pages: ModulePage[];
  totalPages: number;
  completedPages: number;
  questions?: ExtractedQuestionDraft[];
  warnings?: string[];
  sourceId?: string;
}

/** A previously-uploaded photo/PDF whose converted text was saved so it can be re-extracted
 * without re-uploading — distinct from the minimal `QuestionSource` stub above. */
export interface BankQuestionSource {
  _id: string;
  instituteId: string;
  batch: string;
  track: string;
  kind: 'image' | 'pdf_text';
  fileName?: string;
  extractedText: string;
  trainingModuleName?: string;
  documentTitle?: string;
  language?: string;
  pages?: ModulePage[];
  reviewStatus?: 'ready_for_review' | 'saved';
  pageImageFileId?: string;
  figures?: PageFigure[];
  createdAt: string;
  updatedAt: string;
}

export interface UpdateBankQuestionSourcePayload {
  trainingModuleName?: string;
  documentTitle?: string;
  pages?: ModulePage[];
  reviewStatus?: 'ready_for_review' | 'saved';
}

// ── Paper generation ───────────────────────────────────────────────────────────

export interface PaperMarksBreakdownEntry {
  marks: number;
  count: number;
}

export interface PaperDifficultyMix {
  easy: number;
  medium: number;
  hard: number;
}

/** A named section (Section A/B/C…) — an alternative to the flat difficultyMix/marksBreakdown
 * pair. When `sections` is present on a config, it drives assembly instead. */
export interface PaperSectionConfig {
  name: string;
  questionTypes: QuestionKind[];
  difficulty?: QuestionDifficulty;
  count: number;
  marksEach: number;
}

export interface PaperGenerationConfig {
  batch: string;
  track: string;
  examType: string;
  trainingModuleIds: string[];
  topicIds?: string[];
  totalMarks: number;
  difficultyMix: PaperDifficultyMix;
  marksBreakdown: PaperMarksBreakdownEntry[];
  sections?: PaperSectionConfig[];
  questionTypes: QuestionKind[];
  durationMinutes?: number;
  languageComplexity?: LanguageComplexity;
  includeAnswerKey?: boolean;
  includeImages?: boolean;
  blackAndWhite?: boolean;
}

export interface PaperValidationResult {
  warnings: string[];
  suggestions: string[];
  coveragePercent: number;
  totalEstimatedTimeMinutes: number;
}

export interface GeneratedPaperSection {
  marks: number;
  name?: string;
  questions: BankQuestion[];
}

/** A question's image, resolved to an actual displayable payload at generation time. */
export interface ResolvedQuestionImage {
  pageImageDataUri: string;
  boundingBox: BoundingBox;
}

/** Assembled question paper — distinct from the minimal `QuestionPaper` stub above. */
export interface GeneratedQuestionPaper {
  _id: string;
  instituteId: string;
  config: PaperGenerationConfig;
  sections: GeneratedPaperSection[];
  totalMarksAssembled: number;
  validation: PaperValidationResult;
  createdBy: string;
  resolvedImages?: Record<string, ResolvedQuestionImage>;
  createdAt: string;
  updatedAt: string;
}

/** Minimal institute branding used when printing a paper/worksheet header. */
export interface InstituteSettings {
  instituteName: string;
}

// ── Worksheet Generator (rich domain) ─────────────────────────────────────────

export type GeneratedWorksheetType = 'practice' | 'homework' | 'revision' | 'hots' | 'olympiad' | 'remedial';

export interface BankWorksheetQuestion {
  questionId?: string;
  questionText: string;
  questionType: QuestionKind;
  options?: string[];
  difficulty: QuestionDifficulty;
  estimatedTimeMinutes: number;
  keywords: string[];
  isNew?: boolean;
  imageRef?: BankQuestionImageRef;
  imageRequirement?: BankQuestionImageRequirement;
}

/** Rich worksheet record — distinct from the minimal `Worksheet` stub above. */
export interface GeneratedWorksheet {
  _id: string;
  instituteId: string;
  facultyId: string;
  batch: string;
  track: string;
  trainingModuleIds: string[];
  trainingModuleNames: string[];
  worksheetType: GeneratedWorksheetType;
  title: string;
  questions: BankWorksheetQuestion[];
  createdBy: string;
  resolvedImages?: Record<string, ResolvedQuestionImage>;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateWorksheetPayload {
  batch: string;
  track: string;
  trainingModuleIds: string[];
  worksheetType: GeneratedWorksheetType;
  questionCount: number;
  languageComplexity?: LanguageComplexity;
  includeImages?: boolean;
}

export interface WorksheetDraft {
  config: GenerateWorksheetPayload;
  questions: BankWorksheetQuestion[];
  resolvedImages?: Record<string, ResolvedQuestionImage>;
}

export interface SaveWorksheetPayload {
  batch: string;
  track: string;
  trainingModuleIds: string[];
  worksheetType: GeneratedWorksheetType;
  title: string;
  questions: BankWorksheetQuestion[];
  addNewToBank: boolean;
}

export interface WorksheetListOptions {
  page?: number;
  limit?: number;
  batch?: string;
  track?: string;
  trainingModuleId?: string;
  worksheetType?: GeneratedWorksheetType;
}

// ── TPO Dashboard ─────────────────────────────────────────────────────────
export type TpoAlertType = 'low_attendance' | 'upcoming_event' | 'pending_leave';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface TpoAlert {
  id: string;
  type: TpoAlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  actionUrl?: string;
}

export interface TpoUpcomingEvent {
  id: string;
  title: string;
  eventType: string;
  startDate: string;
  isAllDay: boolean;
  startTime?: string;
}

export interface TpoCandidateStats {
  total: number;
  active: number;
  placed: number;
}

export interface TpoFacultyStats {
  total: number;
  active: number;
}

export interface TpoAttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceRate: number; // 0-100
}

export interface TpoAttendanceStats {
  today: TpoAttendanceSummary;
  weeklyAvgRate: number;
}

export interface TpoTrainingScheduleStats {
  published: number;
  draft: number;
}

export interface TpoDashboardData {
  candidates: TpoCandidateStats;
  faculty: TpoFacultyStats;
  attendance: TpoAttendanceStats;
  trainingSchedule: TpoTrainingScheduleStats;
  pendingLeaveRequests: number;
  upcomingEvents: TpoUpcomingEvent[];
  alerts: TpoAlert[];
  generatedAt: string;
}

export interface TpoBriefingSummary {
  summary: string;
  generatedAt: string;
}

/** Per-batch/track attendance rate, lowest-first — powers AttendanceInsightsCard. */
export interface TpoAttendanceInsight {
  batch: string;
  track: string;
  rate: number; // 0-100
  total: number;
}

export interface FacultyOnLeave {
  leaveRequestId: string;
  facultyId: string;
  facultyName: string;
  fromDate: string;
  toDate: string;
}

export interface TpoFacultySummaryData {
  date: string;
  total: number;
  active: number;
  onLeave: FacultyOnLeave[];
  presentCount: number;
}

// ── Leave Request payloads ────────────────────────────────────────────────
export interface CreateLeaveRequestPayload {
  fromDate: string;
  toDate: string;
  reason: string;
}

export interface RejectLeaveRequestPayload {
  reviewNote?: string;
}

// ── Attendance workspace support types ────────────────────────────────────
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface MarkAttendancePayload {
  candidateId: string;
  batch: string;
  track: string;
  date: string;
  status: AttendanceStatus;
  note?: string;
}

export interface BulkAttendancePayload {
  batch: string;
  track: string;
  date: string;
  records: Array<{ candidateId: string; status: AttendanceStatus; note?: string }>;
}

export interface UpdateAttendancePayload {
  status?: AttendanceStatus;
  note?: string;
}

export interface AttendanceListOptions {
  page?: number;
  limit?: number;
  batch?: string;
  track?: string;
  candidateId?: string;
  status?: AttendanceStatus;
  dateFrom?: string;
  dateTo?: string;
}

export interface CandidateHistoryOptions {
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface AttendanceSummaryOptions {
  batch?: string;
  track?: string;
  candidateId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceRate: number;
}

export interface BatchAttendanceOverviewRow {
  batch: string;
  track: string;
  facultyName?: string;
  totalCandidates: number;
  present: number;
  absent: number;
}

export interface BatchAttendanceOverview {
  date: string;
  batches: BatchAttendanceOverviewRow[];
  totals: { totalBatches: number; totalPresent: number; totalAbsent: number };
}

export interface FacultyAttendanceOverviewRow {
  facultyId: string;
  fullName: string;
  department?: string;
  status: 'present' | 'absent' | 'not_marked';
}

export interface FacultyAttendanceOverview {
  date: string;
  faculty: FacultyAttendanceOverviewRow[];
  totals: { totalFaculty: number; present: number; absent: number };
}

// ── Faculty workspace ("my day") ──────────────────────────────────────────
export interface FacultyWorkspaceSelf {
  _id: string;
  instituteId: string;
  fullName: string;
  employeeId: string;
  email?: string;
  phone?: string;
  department?: string;
  tracks: string[];
  assignedBatches: string[];
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface TodayBatchSession {
  scheduleId: string;
  batch: string;
  track: string;
  startTime: string;
  endTime: string;
  room?: string;
  attendanceMarked: boolean;
  attendanceCount: number;
  totalCandidates: number;
}

export interface FacultyWeekEntry {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  track: string;
  batch: string;
  room?: string;
  scheduleId: string;
}

export interface FacultyWorkspaceData {
  faculty: FacultyWorkspaceSelf;
  todaySessions: TodayBatchSession[];
  todayDayOfWeek: number;
  weekSchedule: Array<{ dayOfWeek: number; entries: FacultyWeekEntry[] }>;
  attendanceSummary: {
    sessionsMarkedToday: number;
    totalSessionsToday: number;
  };
  generatedAt: string;
}

// ── Training Plan — generation, day edits, TPO oversight, alerts ─────────
export interface GenerateTrainingPlanPayload {
  batch: string;
  track: string;
}

export interface TrainingPlanGenerationWarning {
  message: string;
}

export interface TrainingPlanGenerationResult {
  plan: TrainingPlan;
  warnings: TrainingPlanGenerationWarning[];
}

export interface SetTrainingPlanDayStatusPayload {
  date: string;
  status: TrainingPlanStatus;
}

export interface EditTrainingPlanDayPayload {
  date: string;
  moduleId?: string;
  moduleName?: string;
  title?: string;
  blockType?: TrainingPlanBlockType;
}

export interface MoveTrainingPlanDayPayload {
  fromDate: string;
  toDate: string;
}

/** One row per faculty+batch+track combination with a plan — TPO's
 *  read-only oversight listing (`GET /training-plan/tpo/overview`). */
export interface TrainingPlanTpoOverviewEntry {
  facultyId: string;
  facultyName: string;
  batch: string;
  track: string;
  hasPlan: boolean;
  totalDays: number;
  completedDays: number;
}

export type TrainingPlanAlertSeverity = 'critical' | 'warning' | 'info';

export interface TrainingPlanAlert {
  _id: string;
  instituteId: string;
  facultyId: string;
  facultyName: string;
  batch?: string;
  track?: string;
  severity: TrainingPlanAlertSeverity;
  message: string;
  createdAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Candidate Portal ─────────────────────────────────────────────────────
// Everything below backs the candidate-facing (student) side of the app:
// resume, interview/aptitude practice, company-tagged prep, proctored tests,
// and a read-only LeetCode stats pull. Kept as its own dedicated content
// model (PracticeQuestion/PracticeSheet) rather than retrofitted onto the
// faculty-authored BankQuestion/Worksheet machinery — the two serve
// different authors and different integrity requirements (a candidate must
// never be able to see a Test's answer key, whereas the question bank's
// AI-extraction/paper-generation pipeline has no such constraint).
// ═══════════════════════════════════════════════════════════════════════════

// ── Resume / Candidate Profile ────────────────────────────────────────────

export interface ResumeEducationEntry {
  degree: string;
  institution: string;
  year: string;
  score?: string;
}

export interface ResumeExperienceEntry {
  company: string;
  role: string;
  duration: string;
  description?: string;
}

export interface ResumeProjectEntry {
  title: string;
  description?: string;
  techStack: string[];
  link?: string;
}

export interface ResumeLinks {
  github?: string;
  linkedin?: string;
  portfolio?: string;
}

export interface CandidateProfile {
  _id: string;
  instituteId: string;
  candidateId: string;
  headline?: string;
  summary?: string;
  education: ResumeEducationEntry[];
  experience: ResumeExperienceEntry[];
  projects: ResumeProjectEntry[];
  skills: string[];
  links: ResumeLinks;
  leetcodeUsername?: string;
  resumeFileUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type SaveCandidateProfilePayload = Partial<Omit<CandidateProfile, '_id' | 'instituteId' | 'candidateId' | 'createdAt' | 'updatedAt' | 'resumeFileUrl'>>;

export interface LeetCodeBadge {
  id: string;
  name: string;
  /** Absolute URL — relative LeetCode paths are resolved server-side. */
  iconUrl: string;
}

export interface LeetCodeStats {
  username: string;
  ranking?: number;
  totalSolved: number;
  totalQuestions: number;
  easySolved: number;
  easyTotal: number;
  mediumSolved: number;
  mediumTotal: number;
  hardSolved: number;
  hardTotal: number;
  badgeCount: number;
  /** Best-effort — LeetCode's public API doesn't label which badge is most recent, so this is badges[0]. */
  recentBadge?: LeetCodeBadge;
  /** Day-start unix seconds (as string) → submission count, for the current LeetCode calendar year. */
  submissionCalendar: Record<string, number>;
  totalActiveDays: number;
  /** Longest run of consecutive active days found within the returned calendar window (not all-time). */
  maxStreak: number;
  fetchedAt: string;
}

// ── Practice Library (PI / GD / Aptitude / Reasoning / Company) ──────────

export type PracticeCategory = 'aptitude' | 'reasoning' | 'pi' | 'gd' | 'company';
export type PracticeQuestionType = 'mcq' | 'open_ended';
export type PracticeDifficulty = 'easy' | 'medium' | 'hard';

export interface PracticeQuestion {
  _id: string;
  instituteId: string;
  category: PracticeCategory;
  /** Set when category is 'company' — e.g. "TCS", "Infosys", "Google". */
  companyName?: string;
  questionText: string;
  questionType: PracticeQuestionType;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  /** Talking points for open-ended PI/GD prep — never "graded", just guidance. */
  guidancePoints?: string[];
  difficulty?: PracticeDifficulty;
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePracticeQuestionPayload {
  category: PracticeCategory;
  companyName?: string;
  questionText: string;
  questionType: PracticeQuestionType;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  guidancePoints?: string[];
  difficulty?: PracticeDifficulty;
  tags?: string[];
}

export type UpdatePracticeQuestionPayload = Partial<CreatePracticeQuestionPayload>;

export interface PracticeQuestionListOptions {
  category?: PracticeCategory;
  companyName?: string;
  difficulty?: PracticeDifficulty;
  search?: string;
  page?: number;
  limit?: number;
}

/** Distinct company names in use — backs the company-filter chip list. */
export interface PracticeCompanyList {
  companies: string[];
}

export interface PracticeSheet {
  _id: string;
  instituteId: string;
  title: string;
  batch: string;
  category: PracticeCategory;
  questionIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePracticeSheetPayload {
  title: string;
  batch: string;
  category: PracticeCategory;
  questionIds: string[];
}

// ── Data Import (bulk CSV/Excel upload with AI-assisted column mapping) ────
export type ImportType = 'training-schedule' | 'faculty' | 'candidates';
export type ImportStatus = 'mapping' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'rolled_back';
export type ImportRowStatus = 'pending' | 'valid' | 'invalid' | 'duplicate' | 'created' | 'skipped';
export type DuplicateStrategy = 'skip' | 'overwrite' | 'create';

export interface ImportField {
  field: string;
  label: string;
  required: boolean;
  description?: string;
}

export type ImportTemplates = Record<ImportType, ImportField[]>;

export interface ImportRow {
  rowNumber: number;
  raw: Record<string, string>;
  mapped: Record<string, unknown>;
  errors: string[];
  status: ImportRowStatus;
  entityId?: string;
}

export interface ImportSession {
  _id: string;
  instituteId: string;
  importType: ImportType;
  originalFileName: string;
  totalRows: number;
  status: ImportStatus;
  rawHeaders: string[];
  columnMapping: Record<string, string>;
  duplicateStrategy: DuplicateStrategy;
  rows: ImportRow[];
  createdEntityIds: string[];
  errorMessage?: string;
  createdBy: string;
  confirmedAt?: string;
  rolledBackAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Proctored Tests ────────────────────────────────────────────────────────

export type TestStatus = 'draft' | 'published' | 'closed';
export type TestQuestionType = 'mcq' | 'short_answer';

/** A question as frozen into a Test at creation time — deliberately a snapshot,
 *  not a live BankQuestion reference, so editing/deleting a bank question can
 *  never change a test candidates have already started. */
export interface TestQuestionSnapshot {
  questionText: string;
  questionType: TestQuestionType;
  options?: string[];
  correctAnswer?: string;
  marks: number;
}

/** Same snapshot, minus the answer key — what a candidate's client receives. */
export type TestQuestionForCandidate = Omit<TestQuestionSnapshot, 'correctAnswer'>;

export interface Test {
  _id: string;
  instituteId: string;
  title: string;
  batch: string;
  track?: string;
  questions: TestQuestionSnapshot[];
  totalMarks: number;
  durationMinutes: number;
  /** Number of proctoring violations tolerated before an attempt auto-submits. */
  violationLimit: number;
  status: TestStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTestPayload {
  title: string;
  batch: string;
  track?: string;
  questions: TestQuestionSnapshot[];
  durationMinutes: number;
  violationLimit: number;
}

/** What a candidate sees in their test list / when starting one. */
export interface TestForCandidate {
  _id: string;
  title: string;
  batch: string;
  track?: string;
  totalMarks: number;
  durationMinutes: number;
  violationLimit: number;
  questionCount: number;
  /** Set once the candidate has an attempt in progress or submitted for this test. */
  attemptStatus?: TestAttemptStatus;
}

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

export interface TestViolation {
  type: TestViolationType;
  at: string;
  detail?: string;
}

export interface TestAnswer {
  questionIndex: number;
  selectedOption?: string;
  answerText?: string;
}

export interface TestAttempt {
  _id: string;
  instituteId: string;
  testId: string;
  candidateId: string;
  startedAt: string;
  submittedAt?: string;
  autoSubmitted: boolean;
  answers: TestAnswer[];
  violations: TestViolation[];
  score?: number;
  status: TestAttemptStatus;
}

/** Returned once a candidate starts a test — the question set (no answer keys) plus the attempt id. */
export interface StartTestAttemptResult {
  attempt: TestAttempt;
  questions: TestQuestionForCandidate[];
  durationMinutes: number;
  violationLimit: number;
  serverTime: string;
}

export interface SubmitAnswerPayload {
  questionIndex: number;
  selectedOption?: string;
  answerText?: string;
}

export interface LogViolationPayload {
  type: TestViolationType;
  detail?: string;
}

export interface LogViolationResult {
  violationCount: number;
  limit: number;
  autoSubmitted: boolean;
}

/** TPO/faculty-facing attempt review — includes the answer key and per-question correctness. */
export interface TestAttemptReview {
  attempt: TestAttempt;
  candidateName: string;
  test: Test;
}
