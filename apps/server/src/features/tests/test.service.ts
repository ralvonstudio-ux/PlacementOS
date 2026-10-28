import bcrypt from 'bcrypt';
import { testRepository, testAttemptRepository } from './test.repository';
import { testAssignmentRepository } from './test-assignment.repository';
import {
  createTestSchema,
  updateTestSchema,
  createAssignmentSchema,
  startTestSchema,
  sendAccessCodeSchema,
  submitAnswerSchema,
  logViolationSchema,
  generateTestDraftSchema,
  reviewTestSchema,
  runCodeSchema,
  submitCodeSchema,
  markViewedSchema,
  mediaRequirementsSchema,
} from './test.validation';
import { ITest, ITestAttempt, ITestAssignment, ITestQuestionSnapshot, ITestSection, CodingLanguage, ITestQuestionResult, QuestionResultStatus, ITestAttemptEvent, TestAttemptEventType } from './test.model';
import { SAMPLE_TEST_TEMPLATE } from './sample-test.template';
import { drawQuestionOrder, paperQuestionCount } from './test-paper';
import { NotFoundError, ValidationError, ForbiddenError, ConflictError } from '../../middlewares/errorHandler';
import { AuthContext } from '../../lib/auth-context';
import { candidateRepository } from '../candidates/candidate.repository';
import { resolveCandidateId } from '../candidates/candidate.service';
import { notificationRepository } from '../notifications/notification.repository';
import { assertFacultyCanAccessQuestionBank } from '../training-schedule/training-schedule.service';
import { testGeneratorService } from './test-generator.service';
import { isJudge0Configured, runOnJudge0, runBatchOnJudge0 } from '../../lib/judge0';
import { Semaphore } from '../../lib/semaphore';
import type {
  Test as TestApiShape,
  TestAssignment as TestAssignmentApiShape,
  TestAssignmentWithTest,
  TestForCandidate,
  StartTestAttemptResult,
  TestAttempt as TestAttemptApiShape,
  LogViolationResult,
  TestAttemptReview,
  RunCodeResult,
  RunCodeCaseResult,
  SubmitCodeResult,
  CreateTestPayload,
  TestResultAnalysis,
  TestSectionPerformance,
  TestTopicAnalysisRow,
  TestMonitor,
  TestMonitorRow,
  TestAttemptEvent as TestAttemptEventApiShape,
  TestHeartbeatResult,
  TestViolationType,
} from '@placementos/types';

const idOf = (doc: unknown) => String((doc as { _id: { toString(): string } })._id);

/** Tests created before sections existed have none — they read as one implicit section. */
const sectionsOf = (t: Pick<ITest, 'sections'>): ITestSection[] =>
  t.sections?.length ? t.sections.map((s) => ({ title: s.title, description: s.description, pickCount: s.pickCount })) : [{ title: 'Questions' }];

const toTestApiShape = (t: ITest): TestApiShape => ({
  _id: idOf(t),
  instituteId: t.instituteId,
  title: t.title,
  track: t.track,
  description: t.description,
  instructions: t.instructions,
  sections: sectionsOf(t),
  questions: t.questions,
  totalMarks: t.totalMarks,
  durationMinutes: t.durationMinutes,
  violationLimit: t.violationLimit,
  allowedFullscreenExits: t.allowedFullscreenExits ?? 1,
  // Tests created before these settings existed always required both.
  requireCamera: t.requireCamera ?? true,
  requireScreenShare: t.requireScreenShare ?? true,
  status: t.status,
  contentName: t.contentName,
  topic: t.topic,
  aiGenerated: t.aiGenerated,
  aiReview: t.aiReview,
  reviewNote: t.reviewNote,
  reviewedBy: t.reviewedBy,
  reviewedAt: t.reviewedAt ? new Date(t.reviewedAt).toISOString() : undefined,
  createdBy: t.createdBy,
  createdAt: new Date(t.createdAt).toISOString(),
  updatedAt: new Date(t.updatedAt).toISOString(),
});

const toAssignmentApiShape = (a: ITestAssignment): TestAssignmentApiShape => ({
  _id: idOf(a),
  instituteId: a.instituteId,
  testId: a.testId,
  targetType: a.targetType,
  batch: a.batch,
  candidateIds: a.candidateIds,
  scheduledAt: a.scheduledAt ? new Date(a.scheduledAt).toISOString() : undefined,
  codeIssued: !!a.accessCodeIssuedAt,
  status: a.status,
  createdBy: a.createdBy,
  createdAt: new Date(a.createdAt).toISOString(),
  updatedAt: new Date(a.updatedAt).toISOString(),
});

const assignmentLabel = (a: Pick<ITestAssignment, 'targetType' | 'batch' | 'candidateIds'>) =>
  a.targetType === 'batch' ? a.batch ?? '' : `${a.candidateIds?.length ?? 0} student(s)`;

const toAttemptApiShape = (a: ITestAttempt): TestAttemptApiShape => ({
  _id: idOf(a),
  instituteId: a.instituteId,
  testId: a.testId,
  assignmentId: a.assignmentId,
  candidateId: a.candidateId,
  startedAt: new Date(a.startedAt).toISOString(),
  submittedAt: a.submittedAt ? new Date(a.submittedAt).toISOString() : undefined,
  autoSubmitted: a.autoSubmitted,
  answers: a.answers.map((ans) => ({
    questionIndex: ans.questionIndex,
    selectedOption: ans.selectedOption,
    answerText: ans.answerText,
    code: ans.code,
    language: ans.language,
    submission: ans.submission
      ? { ...ans.submission, submittedAt: new Date(ans.submission.submittedAt).toISOString() }
      : undefined,
  })),
  violations: a.violations.map((v) => ({ type: v.type, at: new Date(v.at).toISOString(), detail: v.detail })),
  score: a.score,
  status: a.status,
  viewedQuestionIndexes: a.viewedQuestionIndexes,
  proctoring: a.proctoring ? { ipAddresses: a.proctoring.ipAddresses, os: a.proctoring.os, browser: a.proctoring.browser } : undefined,
  resumeCount: a.resumeCount,
  questionResults: a.questionResults,
  terminationReason: a.terminationReason,
});

/** Best-effort User-Agent sniff — just enough to fill "OS Used" / "Browser Used" on the
 *  result-analysis screen, not a real device-detection library. */
function parseUserAgent(ua?: string): { os?: string; browser?: string } {
  if (!ua) return {};
  const os = /windows/i.test(ua) ? 'Windows' : /mac os/i.test(ua) ? 'macOS' : /android/i.test(ua) ? 'Android' : /iphone|ipad/i.test(ua) ? 'iOS' : /linux/i.test(ua) ? 'Linux' : undefined;
  const browser = /edg\//i.test(ua) ? 'Edge' : /chrome\//i.test(ua) ? 'Chrome' : /firefox\//i.test(ua) ? 'Firefox' : /safari\//i.test(ua) ? 'Safari' : undefined;
  return { os, browser };
}

/** This attempt's paper: the paper-order indexes of the questions this candidate was dealt,
 *  in the order they see them — a subset of the test when sections draw from a pool. Falls
 *  back to every question in paper order for attempts created before randomization existed
 *  (or a corrupt stored order). */
function orderFor(attempt: ITestAttempt, questionCount: number): number[] {
  const stored = attempt.questionOrder ?? [];
  if (stored.length > 0 && stored.length <= questionCount && stored.every((i) => i >= 0 && i < questionCount)) return stored;
  return Array.from({ length: questionCount }, (_, i) => i);
}

// ── Session lock & audit trail ────────────────────────────────────────────────
// An attempt is driven by exactly one browser session at a time (the client sends a per-tab
// id in X-Attempt-Session). A second window/device is refused while the first is alive, and
// a resume from a network the attempt has never been on needs staff approval — so nobody else
// can sit the test for a candidate. Everything is recorded in `attempt.events`.

/** A session is "alive" if it was heard from within this window (heartbeat is every 15s). */
const LIVE_WINDOW_MS = 45_000;
/** Server-side backstop for the timer: an attempt this far past its duration is closed. */
const OVERTIME_GRACE_MS = 60_000;

const deviceOf = (userAgent?: string) => {
  const { os, browser } = parseUserAgent(userAgent);
  return [os, browser].filter(Boolean).join(' · ') || undefined;
};

const eventOf = (type: TestAttemptEventType, ctx: AuthContext, detail?: string): ITestAttemptEvent => ({
  type,
  at: new Date(),
  ip: ctx.ip,
  device: deviceOf(ctx.userAgent),
  detail,
});

const isLive = (attempt: Pick<ITestAttempt, 'status' | 'activeSession'>) =>
  attempt.status === 'in_progress' && !!attempt.activeSession && Date.now() - new Date(attempt.activeSession.lastSeenAt).getTime() < LIVE_WINDOW_MS;

/** Every candidate request on an open attempt goes through this: only the attempt's active
 *  session may act on it, and a changed IP on that session is recorded. */
async function assertActiveSession(attempt: ITestAttempt, ctx: AuthContext): Promise<void> {
  const active = attempt.activeSession;
  if (active && ctx.attemptSessionId !== active.id) {
    throw new ConflictError('This test is now open in another window or device — this window has been disconnected.');
  }
  const ipChanged = !!ctx.ip && !!active?.ip && ctx.ip !== active.ip;
  await testAttemptRepository.touchSession(idOf(attempt), ctx.ip, ipChanged ? eventOf('ip_changed', ctx, `${active!.ip} → ${ctx.ip}`) : undefined);
}

/** Loads the caller's own in-progress attempt and checks its session. */
async function loadOwnOpenAttempt(attemptId: string, ctx: AuthContext): Promise<ITestAttempt> {
  const candidateId = await resolveCandidateId(ctx);
  const attempt = await testAttemptRepository.findById(attemptId, ctx.instituteId);
  if (!attempt || attempt.candidateId !== candidateId) throw new NotFoundError('Test attempt');
  if (attempt.status !== 'in_progress') throw new ValidationError('This attempt has already been submitted');
  await assertActiveSession(attempt, ctx);
  return attempt;
}

/** Grades and closes an attempt on the system's or staff's behalf, logging why. */
async function endAttempt(test: ITest, attempt: ITestAttempt, reason: string, event: ITestAttemptEvent): Promise<ITestAttempt | null> {
  const graded = await scoreAttemptDetailed(test, attempt);
  return testAttemptRepository.submit(idOf(attempt), {
    autoSubmitted: true,
    score: graded.score,
    questionResults: graded.questionResults,
    terminationReason: reason,
    event,
  });
}

/** Client-facing question indexes are always positions in the candidate's shuffled order —
 *  this maps one back to the paper's own original index before it's persisted or used to
 *  look up `test.questions`. */
function toOriginalIndex(order: number[], clientIndex: number): number {
  return order[clientIndex] ?? clientIndex;
}

function toClientIndex(order: number[], originalIndex: number): number {
  const i = order.indexOf(originalIndex);
  return i === -1 ? originalIndex : i;
}

/** Rebuilds an attempt's answers/viewedQuestionIndexes with question indexes translated from
 *  the paper's original order into this candidate's shuffled client-facing order. Reads each
 *  answer field explicitly rather than spreading it — `answers` are Mongoose subdocuments, and
 *  `{ ...a }` copies their internal `$__`/`_doc`/`__parentArray` bookkeeping as if they were
 *  plain data, corrupting the JSON response. */
function remapAttemptForClient(attempt: TestAttemptApiShape, order: number[]): TestAttemptApiShape {
  return {
    ...attempt,
    answers: attempt.answers.map((a) => ({
      questionIndex: toClientIndex(order, a.questionIndex),
      selectedOption: a.selectedOption,
      answerText: a.answerText,
      code: a.code,
      language: a.language,
      submission: a.submission,
    })),
    viewedQuestionIndexes: (attempt.viewedQuestionIndexes ?? []).map((i) => toClientIndex(order, i)),
  };
}

const ACCESS_CODE_SALT_ROUNDS = 10;
const ACCESS_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I — avoids look-alike mistypes

function generateAccessCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) code += ACCESS_CODE_ALPHABET[Math.floor(Math.random() * ACCESS_CODE_ALPHABET.length)];
  return code;
}

// Caps how many Judge0 batches this process has in flight at once — a whole class can hit
// Run/Submit at the same moment, and a final submit judges every coding question.
const judge0Semaphore = new Semaphore(6);

/** Trailing whitespace on each line and trailing blank lines never decide a verdict — and
 *  Windows line endings in a pasted expected output compare equal to Linux ones. */
const normalizeOutput = (s: string) => s.replace(/\r\n/g, '\n').split('\n').map((l) => l.trimEnd()).join('\n').trimEnd();

/** Hidden cases are judged but never revealed — the candidate learns only pass/fail. */
const maskHidden = (r: RunCodeCaseResult): RunCodeCaseResult =>
  r.hidden ? { hidden: true, passed: r.passed, input: '', expectedOutput: '', stdout: '', stderr: '' } : r;

/** Runs `code` against every one of a coding question's test cases via Judge0 and reports
 *  per-case pass/fail. Shared by the candidate-facing "Run" endpoint (visible cases only) and
 *  by scoring at submit time (all cases, including hidden ones). Compares stdout trimmed of
 *  trailing whitespace — the same tolerance every judge (including Judge0 itself) applies, so a
 *  correct solution isn't marked wrong over a trailing newline. */
async function runAgainstTestCases(code: string, language: NonNullable<ITestQuestionSnapshot['allowedLanguages']>[number], cases: NonNullable<ITestQuestionSnapshot['testCases']>): Promise<RunCodeResult> {
  if (!isJudge0Configured()) {
    return { status: 'not_configured', results: [], allPassed: false };
  }

  // All cases go to Judge0 as one batch; results keep the cases' order.
  const runs = await judge0Semaphore.run(() => runBatchOnJudge0({ code, language, stdins: cases.map((testCase) => testCase.input) }));

  const compileFailure = runs.find((run) => run.statusId === 6);
  if (compileFailure) {
    // Compilation error — same for every case, so surface it once.
    return { status: 'compile_error', compileError: compileFailure.compileOutput || compileFailure.stderr, results: [], allPassed: false };
  }

  const results: RunCodeCaseResult[] = cases.map((testCase, i) => {
    const run = runs[i];
    return {
      hidden: testCase.hidden,
      passed: run.statusId === 3 && normalizeOutput(run.stdout) === normalizeOutput(testCase.expectedOutput), // 3 = "Accepted"
      input: testCase.input,
      expectedOutput: testCase.expectedOutput,
      stdout: run.stdout,
      // Runtime errors / time limits carry no stderr of their own — fall back to the status text.
      stderr: run.stderr || (run.statusId > 3 ? run.status : ''),
    };
  });

  const allPassed = results.length > 0 && results.every((r) => r.passed);
  return { status: 'ok', results, allPassed };
}

/** Auto-grades MCQ, exact-match short-answer, and coding questions, and classifies every
 *  question into a `QuestionResultStatus` for the result-analysis screen along the way.
 *  Open-ended answers with no correctAnswer set are marked 'partial' (0 marks, needs a human
 *  reviewer) rather than contributing to score. Coding questions award proportional marks
 *  based on the fraction of test cases (visible + hidden) the candidate's last-saved code
 *  passes — 'correct' if all pass, 'wrong' if none do, 'partial' otherwise. A verdict from the
 *  candidate's own "Submit code" is reused while the code is unchanged; otherwise the code is
 *  judged here (all coding questions concurrently). If Judge0 isn't configured, or the
 *  question has no test cases, they're 'partial' with 0 marks (manual review only). An
 *  unanswered question is 'skipped' if the candidate's client ever reported it as viewed,
 *  otherwise 'not_viewed'. */
async function scoreAttemptDetailed(test: ITest, attempt: ITestAttempt): Promise<{ score: number; questionResults: ITestQuestionResult[] }> {
  const viewed = new Set(attempt.viewedQuestionIndexes ?? []);
  const answerByIndex = new Map(attempt.answers.map((a) => [a.questionIndex, a]));

  const codingResult = (question: ITestQuestionSnapshot, questionIndex: number, passedCount: number, totalCount: number): ITestQuestionResult => {
    const marksObtained = Math.round(question.marks * (passedCount / totalCount));
    const status: QuestionResultStatus = passedCount === totalCount ? 'correct' : passedCount === 0 ? 'wrong' : 'partial';
    return { questionIndex, status, marksObtained };
  };

  const questionResults = await Promise.all(
    orderFor(attempt, test.questions.length).map(async (i): Promise<ITestQuestionResult> => {
      const question = test.questions[i];
      const answer = answerByIndex.get(i);
      const hasAnswer = !!answer && !!(answer.selectedOption?.trim() || answer.answerText?.trim() || answer.code?.trim());
      if (!answer || !hasAnswer) return { questionIndex: i, status: viewed.has(i) ? 'skipped' : 'not_viewed', marksObtained: 0 };

      if (question.questionType === 'coding') {
        if (!answer.code || !answer.language || !question.testCases?.length) return { questionIndex: i, status: 'partial', marksObtained: 0 };
        const sub = answer.submission;
        if (sub && sub.code === answer.code && sub.language === answer.language && sub.totalCount > 0) {
          return codingResult(question, i, sub.passedCount, sub.totalCount);
        }
        if (!isJudge0Configured()) return { questionIndex: i, status: 'partial', marksObtained: 0 };
        try {
          const result = await runAgainstTestCases(answer.code, answer.language, question.testCases);
          if (result.status === 'compile_error') return { questionIndex: i, status: 'wrong', marksObtained: 0 };
          if (result.status !== 'ok' || result.results.length === 0) return { questionIndex: i, status: 'partial', marksObtained: 0 };
          return codingResult(question, i, result.results.filter((r) => r.passed).length, result.results.length);
        } catch {
          // Judge0 unreachable at submit time — treat as unscored rather than failing the whole submit.
          return { questionIndex: i, status: 'partial', marksObtained: 0 };
        }
      }

      if (!question.correctAnswer) return { questionIndex: i, status: 'partial', marksObtained: 0 };
      const given = question.questionType === 'mcq' ? answer.selectedOption : answer.answerText;
      const isCorrect = given?.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
      return { questionIndex: i, status: isCorrect ? 'correct' : 'wrong', marksObtained: isCorrect ? question.marks : 0 };
    })
  );

  return { score: questionResults.reduce((sum, r) => sum + r.marksObtained, 0), questionResults };
}

export const testService = {
  // ── Faculty / TPO authoring ────────────────────────────────────────────────

  /** A ready-made two-section (10 MCQ + 5 coding) assessment the builder can start from. */
  getSampleTemplate(): CreateTestPayload {
    return structuredClone(SAMPLE_TEST_TEMPLATE) as CreateTestPayload;
  },

  async create(rawInput: unknown, ctx: AuthContext): Promise<TestApiShape> {
    const data = createTestSchema.parse(rawInput);
    const test = await testRepository.create(ctx.instituteId, ctx.userId, data);
    return toTestApiShape(test);
  },

  /** AI-drafts a full test from uploaded/pasted content — saved straight away as a
   *  draft (not just returned) so the faculty member can edit it like any other test
   *  before submitting it for approval. */
  async generateDraft(rawInput: unknown, ctx: AuthContext): Promise<TestApiShape> {
    const input = generateTestDraftSchema.parse(rawInput);
    const { questions, aiReview } = await testGeneratorService.generateDraft(input);

    const test = await testRepository.create(ctx.instituteId, ctx.userId, {
      title: input.title,
      track: input.track,
      // AI drafts are a single section; the faculty member can split them up when editing.
      questions: questions.map((q) => ({ ...q, sectionIndex: 0 })),
      durationMinutes: input.durationMinutes,
      violationLimit: input.violationLimit,
      allowedFullscreenExits: 1,
      requireCamera: true,
      requireScreenShare: true,
      contentName: input.contentName,
      topic: input.topic,
      sourceContent: input.sourceContent,
      aiGenerated: true,
      aiReview,
    });
    return toTestApiShape(test);
  },

  async update(id: string, rawInput: unknown, ctx: AuthContext): Promise<TestApiShape> {
    const data = updateTestSchema.parse(rawInput);
    const existing = await testRepository.findById(id, ctx.instituteId);
    if (!existing) throw new NotFoundError('Test');
    if (existing.status !== 'draft' && existing.status !== 'rejected') {
      throw new ValidationError('Only a draft or rejected test can be edited');
    }

    // Editing a rejected test moves it back to draft — it needs to be resubmitted.
    const patch = existing.status === 'rejected' ? { ...data, status: 'draft' as const } : data;
    const updated = await testRepository.update(id, ctx.instituteId, patch);
    if (!updated) throw new NotFoundError('Test');
    return toTestApiShape(updated);
  },

  /** Turns the camera / screen-share requirement on or off, whatever the test's status — a lab
   *  without webcams is usually discovered after the paper is approved. */
  async setMediaRequirements(id: string, rawInput: unknown, ctx: AuthContext): Promise<TestApiShape> {
    const data = mediaRequirementsSchema.parse(rawInput);
    const existing = await testRepository.findById(id, ctx.instituteId);
    if (!existing) throw new NotFoundError('Test');
    const updated = await testRepository.update(id, ctx.instituteId, data as never);
    if (!updated) throw new NotFoundError('Test');
    return toTestApiShape(updated);
  },

  /** Faculty action: draft/rejected -> pending_approval, for a TPO/admin to review. */
  async submitForApproval(id: string, ctx: AuthContext): Promise<TestApiShape> {
    const existing = await testRepository.findById(id, ctx.instituteId);
    if (!existing) throw new NotFoundError('Test');
    if (existing.status !== 'draft' && existing.status !== 'rejected') {
      throw new ValidationError('Only a draft or rejected test can be submitted for approval');
    }
    const updated = await testRepository.update(id, ctx.instituteId, { status: 'pending_approval' } as never);
    if (!updated) throw new NotFoundError('Test');
    return toTestApiShape(updated);
  },

  /** TPO/admin action: pending_approval -> approved or rejected. */
  async review(id: string, rawInput: unknown, ctx: AuthContext): Promise<TestApiShape> {
    const { decision, reviewNote } = reviewTestSchema.parse(rawInput);
    const existing = await testRepository.findById(id, ctx.instituteId);
    if (!existing) throw new NotFoundError('Test');
    if (existing.status !== 'pending_approval') throw new ValidationError('Only a test pending approval can be reviewed');

    const updated = await testRepository.review(id, ctx.instituteId, { status: decision, reviewNote, reviewedBy: ctx.userId, reviewedAt: new Date() });
    if (!updated) throw new NotFoundError('Test');
    return toTestApiShape(updated);
  },

  /** Staff-only: sends this approved paper out to a batch or a named list of candidates.
   *  One paper can be assigned many times — to different batches, or again later — without
   *  ever needing re-approval. */
  async createAssignment(testId: string, rawInput: unknown, ctx: AuthContext): Promise<TestAssignmentApiShape> {
    const data = createAssignmentSchema.parse(rawInput);
    const test = await testRepository.findById(testId, ctx.instituteId);
    if (!test) throw new NotFoundError('Test');
    if (test.status !== 'approved') throw new ValidationError('Only an approved test can be assigned');

    if (data.targetType === 'batch') {
      if (ctx.role === 'faculty') await assertFacultyCanAccessQuestionBank(ctx, data.batch!, test.track ?? '');
    } else if (ctx.role === 'faculty') {
      throw new ForbiddenError('Only a TPO/admin can assign a test to specific students');
    }

    const assignment = await testAssignmentRepository.create(ctx.instituteId, testId, ctx.userId, data);
    return toAssignmentApiShape(assignment);
  },

  async listAssignments(testId: string, ctx: AuthContext): Promise<TestAssignmentApiShape[]> {
    const test = await testRepository.findById(testId, ctx.instituteId);
    if (!test) throw new NotFoundError('Test');
    const assignments = await testAssignmentRepository.findByTest(testId, ctx.instituteId);
    return assignments.map(toAssignmentApiShape);
  },

  /** Every active assignment across every paper — backs the Messages "send access code" picker. */
  async listAllAssignments(ctx: AuthContext): Promise<TestAssignmentWithTest[]> {
    const assignments = await testAssignmentRepository.findAllActive(ctx.instituteId);
    const testIds = [...new Set(assignments.map((a) => a.testId))];
    const tests = await Promise.all(testIds.map((id) => testRepository.findById(id, ctx.instituteId)));
    const testById = new Map(tests.filter((t): t is ITest => !!t).map((t) => [idOf(t), t]));

    return assignments
      .map((a): TestAssignmentWithTest | null => {
        const test = testById.get(a.testId);
        if (!test) return null;
        return {
          ...toAssignmentApiShape(a),
          testTitle: test.title,
          track: test.track,
          totalMarks: test.totalMarks,
          durationMinutes: test.durationMinutes,
          questionCount: paperQuestionCount(test.questions, test.sections),
        };
      })
      .filter((a): a is TestAssignmentWithTest => !!a);
  },

  /** Staff-only: (re)generates the assignment's access code and delivers it — as a notification
   *  containing the one-time plaintext — to exactly the given candidates, and no one else.
   *  Regenerating overwrites any previously issued code, so a later send to a
   *  different/expanded group invalidates whatever was sent before; staff should include
   *  everyone who still needs it in one call. The plaintext exists only in this function's
   *  memory for the one request — it's never returned to the caller or logged, only
   *  bcrypt-hashed at rest (same primitive the app already uses for login passwords) and
   *  embedded straight into the notifications. */
  async sendAssignmentAccessCode(assignmentId: string, rawInput: unknown, ctx: AuthContext): Promise<{ sentCount: number }> {
    const { candidateIds } = sendAccessCodeSchema.parse(rawInput);
    const assignment = await testAssignmentRepository.findById(assignmentId, ctx.instituteId);
    if (!assignment) throw new NotFoundError('Test assignment');
    if (assignment.status !== 'active') throw new ValidationError('Only an active assignment can have its access code sent');

    const test = await testRepository.findById(assignment.testId, ctx.instituteId);
    if (!test) throw new NotFoundError('Test');

    const candidates = await candidateRepository.findAllForSchoolByIds(candidateIds, ctx.instituteId);
    const eligible =
      assignment.targetType === 'batch'
        ? candidates.filter((c) => c.batch === assignment.batch)
        : candidates.filter((c) => assignment.candidateIds?.includes(idOf(c)));
    const recipientIds = eligible.map((c) => idOf(c));
    if (recipientIds.length === 0) throw new ValidationError("None of the selected candidates are within this assignment's target");

    const code = generateAccessCode();
    const accessCodeHash = await bcrypt.hash(code, ACCESS_CODE_SALT_ROUNDS);
    await testAssignmentRepository.setAccessCode(assignmentId, ctx.instituteId, accessCodeHash);

    await notificationRepository.createForRecipients(
      ctx.instituteId,
      recipientIds.map((id) => ({
        recipientId: id,
        recipientRole: 'candidate' as const,
        type: 'test_access_code' as const,
        title: `${test.title} — access code`,
        body: `Your access code is ${code}. Enter it on the test's start screen — it works once you begin.`,
        relatedTestId: idOf(test),
      }))
    );

    return { sentCount: recipientIds.length };
  },

  async closeAssignment(assignmentId: string, ctx: AuthContext): Promise<TestAssignmentApiShape> {
    const updated = await testAssignmentRepository.close(assignmentId, ctx.instituteId);
    if (!updated) throw new NotFoundError('Test assignment');
    return toAssignmentApiShape(updated);
  },

  /** Faculty see only their own tests (drafts/pending/etc. from other faculty aren't
   *  theirs to browse); TPO/admin see everything, since approval requires seeing every
   *  faculty member's pending submissions. */
  async list(ctx: AuthContext): Promise<TestApiShape[]> {
    const tests = await testRepository.findAll(ctx.instituteId);
    const scoped = ctx.role === 'faculty' ? tests.filter((t) => t.createdBy === ctx.userId) : tests;
    return scoped.map(toTestApiShape);
  },

  async remove(id: string, ctx: AuthContext): Promise<void> {
    const deleted = await testRepository.softDelete(id, ctx.instituteId);
    if (!deleted) throw new NotFoundError('Test');
  },

  /** Every attempt for a test, with the candidate's name and the test's own answer key
   *  — faculty/TPO review screen only. Attempts come from every assignment ever sent out
   *  for this paper, each labeled with the sendout it came from. */
  async getReview(testId: string, ctx: AuthContext): Promise<TestAttemptReview[]> {
    const test = await testRepository.findById(testId, ctx.instituteId);
    if (!test) throw new NotFoundError('Test');

    const attempts = await testAttemptRepository.findByTest(testId, ctx.instituteId);
    const candidateIds = [...new Set(attempts.map((a) => a.candidateId))];
    const candidates = candidateIds.length
      ? await candidateRepository.findAllForSchoolByIds(candidateIds, ctx.instituteId)
      : [];
    const nameById = new Map(candidates.map((c) => [idOf(c), c.fullName]));

    const assignmentIds = [...new Set(attempts.map((a) => a.assignmentId))];
    const assignments = await Promise.all(assignmentIds.map((id) => testAssignmentRepository.findById(id, ctx.instituteId)));
    const labelById = new Map(
      assignments.filter((a): a is NonNullable<typeof a> => !!a).map((a) => [idOf(a), assignmentLabel(a)])
    );

    return attempts.map((a) => ({
      attempt: toAttemptApiShape(a),
      candidateName: nameById.get(a.candidateId) ?? 'Unknown',
      test: toTestApiShape(test),
      assignmentLabel: labelById.get(a.assignmentId),
    }));
  },

  /** Examly-style "Result & Analysis" breakdown for one candidate's attempt — topper/average/
   *  least scores are computed across every submitted attempt for this same test. Faculty/TPO
   *  review screen only (needs the answer key). */
  async getResultAnalysis(testId: string, attemptId: string, ctx: AuthContext): Promise<TestResultAnalysis> {
    const test = await testRepository.findById(testId, ctx.instituteId);
    if (!test) throw new NotFoundError('Test');

    const attempt = await testAttemptRepository.findById(attemptId, ctx.instituteId);
    if (!attempt || attempt.testId !== testId) throw new NotFoundError('Test attempt');

    const candidate = await candidateRepository.findById(attempt.candidateId, ctx.instituteId);
    const allSubmitted = await testAttemptRepository.findSubmittedByTest(testId, ctx.instituteId);

    // Older/in-progress attempts may not have questionResults persisted yet — grade on the fly
    // rather than requiring a re-submit just to view analysis.
    const questionResults = attempt.questionResults?.length ? attempt.questionResults : (await scoreAttemptDetailed(test, attempt)).questionResults;

    // A per-question section label wins; otherwise the question's builder section (e.g.
    // "Section B — Coding"), so sectioned tests break down by section with no extra tagging.
    const testSections = sectionsOf(test);
    const sectionOf = (q: ITestQuestionSnapshot) =>
      q.section?.trim() || (test.sections?.length ? testSections[q.sectionIndex ?? 0]?.title : undefined) || 'General';
    // With question pools each candidate answers a subset — analyse only their own paper.
    const onPaper = new Set(orderFor(attempt, test.questions.length));
    const paper = test.questions.map((q, i) => ({ q, i })).filter(({ i }) => onPaper.has(i));
    const sectionNames = [...new Set(paper.map(({ q }) => sectionOf(q)))];

    const sectionScoresFor = (results: ITestQuestionResult[] | undefined): Record<string, number> => {
      const scores: Record<string, number> = {};
      for (const name of sectionNames) scores[name] = 0;
      for (const r of results ?? []) {
        const q = test.questions[r.questionIndex];
        if (q && sectionOf(q) in scores) scores[sectionOf(q)] += r.marksObtained;
      }
      return scores;
    };

    const allSectionScores = allSubmitted.map((a) => sectionScoresFor(a.questionResults));
    const mySectionScores = sectionScoresFor(questionResults);

    const sections: TestSectionPerformance[] = sectionNames.map((name) => {
      const indexesInSection = new Set(paper.filter(({ q }) => sectionOf(q) === name).map(({ i }) => i));
      const qs = paper.filter(({ q }) => sectionOf(q) === name).map(({ q }) => q);
      const myResults = questionResults.filter((r) => indexesInSection.has(r.questionIndex));
      const scoresAcross = allSectionScores.map((s) => s[name] ?? 0);

      return {
        section: name,
        totalMarks: qs.reduce((sum, q) => sum + q.marks, 0),
        myScore: mySectionScores[name] ?? 0,
        topperScore: scoresAcross.length ? Math.max(...scoresAcross) : 0,
        averageScore: scoresAcross.length ? Math.round((scoresAcross.reduce((a, b) => a + b, 0) / scoresAcross.length) * 100) / 100 : 0,
        leastScore: scoresAcross.length ? Math.min(...scoresAcross) : 0,
        totalQuestions: qs.length,
        attempted: myResults.filter((r) => r.status !== 'skipped' && r.status !== 'not_viewed').length,
        correct: myResults.filter((r) => r.status === 'correct').length,
        wrong: myResults.filter((r) => r.status === 'wrong').length,
        partial: myResults.filter((r) => r.status === 'partial').length,
        skipped: myResults.filter((r) => r.status === 'skipped').length,
        notViewed: myResults.filter((r) => r.status === 'not_viewed').length,
      };
    });

    const totalRow: TestSectionPerformance = sections.reduce(
      (acc, s) => ({
        section: 'Total',
        totalMarks: acc.totalMarks + s.totalMarks,
        myScore: acc.myScore + s.myScore,
        topperScore: acc.topperScore + s.topperScore,
        averageScore: Math.round((acc.averageScore + s.averageScore) * 100) / 100,
        leastScore: acc.leastScore + s.leastScore,
        totalQuestions: acc.totalQuestions + s.totalQuestions,
        attempted: acc.attempted + s.attempted,
        correct: acc.correct + s.correct,
        wrong: acc.wrong + s.wrong,
        partial: acc.partial + s.partial,
        skipped: acc.skipped + s.skipped,
        notViewed: acc.notViewed + s.notViewed,
      }),
      { section: 'Total', totalMarks: 0, myScore: 0, topperScore: 0, averageScore: 0, leastScore: 0, totalQuestions: 0, attempted: 0, correct: 0, wrong: 0, partial: 0, skipped: 0, notViewed: 0 }
    );

    // Topic-wise analysis, two levels: "Topic" = section (Numerical/Verbal/Reasoning Ability…),
    // "Sub Topic" = the question's own `topic` tag (Simple Interest, Time and Work…).
    const subject = test.track?.trim() || 'Aptitude';
    const resultByIndex = new Map(questionResults.map((r) => [r.questionIndex, r]));

    type CountAgg = { topic: string; subTopic: string; correct: number; partial: number; wrong: number; skipped: number; notViewed: number; total: number };
    const countMap = new Map<string, CountAgg>();
    type MarksAgg = { topic: string; subTopic: string; correctMarks: number; partialMarks: number; totalMarks: number };
    const marksMap = new Map<string, MarksAgg>();

    paper.forEach(({ q, i }) => {
      const topic = sectionOf(q);
      const subTopic = q.topic?.trim() || 'General';
      const key = `${topic}::${subTopic}`;
      const r = resultByIndex.get(i);
      const status: QuestionResultStatus = r?.status ?? 'not_viewed';

      const countEntry = countMap.get(key) ?? { topic, subTopic, correct: 0, partial: 0, wrong: 0, skipped: 0, notViewed: 0, total: 0 };
      countEntry.total += 1;
      if (status === 'correct') countEntry.correct += 1;
      else if (status === 'partial') countEntry.partial += 1;
      else if (status === 'wrong') countEntry.wrong += 1;
      else if (status === 'skipped') countEntry.skipped += 1;
      else countEntry.notViewed += 1;
      countMap.set(key, countEntry);

      const marksEntry = marksMap.get(key) ?? { topic, subTopic, correctMarks: 0, partialMarks: 0, totalMarks: 0 };
      marksEntry.totalMarks += q.marks;
      if (status === 'correct') marksEntry.correctMarks += r?.marksObtained ?? 0;
      if (status === 'partial') marksEntry.partialMarks += r?.marksObtained ?? 0;
      marksMap.set(key, marksEntry);
    });

    const countWiseAnalysis: TestTopicAnalysisRow[] = [...countMap.values()].map((e) => ({
      subject,
      topic: e.topic,
      subTopic: e.subTopic,
      accuracy: e.total ? Math.round((e.correct / e.total) * 100) : 0,
      correct: e.correct,
      partial: e.partial,
      wrong: e.wrong,
      skipped: e.skipped,
      notViewed: e.notViewed,
      total: e.total,
    }));

    const marksWiseAnalysis: TestTopicAnalysisRow[] = [...marksMap.values()].map((e) => ({
      subject,
      topic: e.topic,
      subTopic: e.subTopic,
      accuracy: e.totalMarks ? Math.round((e.correctMarks / e.totalMarks) * 100) : 0,
      correct: e.correctMarks,
      partial: e.partialMarks,
      wrong: 0,
      skipped: 0,
      notViewed: 0,
      total: e.totalMarks,
    }));

    const topPerforming = countWiseAnalysis.filter((r) => r.total > 0 && r.accuracy === 100).map((r) => r.subTopic).slice(0, 5);
    const leastPerforming = countWiseAnalysis.filter((r) => r.total > 0 && r.accuracy === 0).map((r) => r.subTopic).slice(0, 5);

    const durationSeconds = attempt.submittedAt
      ? Math.max(0, Math.round((new Date(attempt.submittedAt).getTime() - new Date(attempt.startedAt).getTime()) / 1000))
      : 0;

    return {
      candidateName: candidate?.fullName ?? 'Unknown',
      candidateEmail: candidate?.email,
      batch: candidate?.batch,
      testTitle: test.title,
      track: test.track,
      ipAddresses: attempt.proctoring?.ipAddresses ?? [],
      tabSwitches: attempt.violations.filter((v) => v.type === 'tab_switch').length,
      violationCount: attempt.violations.length,
      autoSubmitted: !!attempt.autoSubmitted,
      os: attempt.proctoring?.os,
      browser: attempt.proctoring?.browser,
      durationSeconds,
      startedAt: new Date(attempt.startedAt).toISOString(),
      submittedAt: attempt.submittedAt ? new Date(attempt.submittedAt).toISOString() : undefined,
      resumeCount: attempt.resumeCount ?? 0,
      totalMarks: test.totalMarks,
      myScore: totalRow.myScore,
      sections,
      totalRow,
      topPerforming,
      leastPerforming,
      countWiseAnalysis,
      marksWiseAnalysis,
      questions: paper.map(({ q, i }) => {
        const answer = attempt.answers.find((a) => a.questionIndex === i);
        const r = resultByIndex.get(i);
        return {
          questionIndex: i,
          section: sectionOf(q),
          questionText: q.questionText,
          questionType: q.questionType,
          options: q.options,
          correctAnswer: q.correctAnswer,
          selectedOption: answer?.selectedOption,
          answerText: answer?.answerText,
          marks: q.marks,
          marksObtained: r?.marksObtained ?? 0,
          status: r?.status ?? 'not_viewed',
          level: q.level,
          topic: q.topic,
          subTopic: q.subTopic,
        };
      }),
    };
  },

  // ── Candidate-facing ─────────────────────────────────────────────────────

  /** The candidate's own Result & Analysis for an assignment — only once they've submitted. */
  async getMyResultAnalysis(assignmentId: string, ctx: AuthContext): Promise<TestResultAnalysis> {
    const candidateId = await resolveCandidateId(ctx);
    const attempt = await testAttemptRepository.findByAssignmentAndCandidate(assignmentId, candidateId, ctx.instituteId);
    if (!attempt) throw new NotFoundError('Test attempt');
    if (attempt.status !== 'submitted') throw new ForbiddenError('Your result is available once the test is submitted');
    return testService.getResultAnalysis(attempt.testId, idOf(attempt), ctx);
  },

  async listMine(ctx: AuthContext): Promise<TestForCandidate[]> {
    const candidateId = await resolveCandidateId(ctx);
    const candidate = await candidateRepository.findById(candidateId, ctx.instituteId);
    if (!candidate) throw new NotFoundError('Candidate');

    const assignments = await testAssignmentRepository.findActiveFor(ctx.instituteId, candidateId, candidate.batch);
    const results: TestForCandidate[] = [];
    for (const a of assignments) {
      const test = await testRepository.findById(a.testId, ctx.instituteId);
      if (!test) continue;
      const assignmentId = idOf(a);
      const attempt = await testAttemptRepository.findByAssignmentAndCandidate(assignmentId, candidateId, ctx.instituteId);
      results.push({
        _id: assignmentId,
        title: test.title,
        description: test.description,
        instructions: test.instructions,
        sectionCount: sectionsOf(test).length,
        batch: a.targetType === 'batch' ? a.batch : undefined,
        track: test.track,
        totalMarks: test.totalMarks,
        durationMinutes: test.durationMinutes,
        violationLimit: test.violationLimit,
        requireCamera: test.requireCamera ?? true,
        requireScreenShare: test.requireScreenShare ?? true,
        questionCount: paperQuestionCount(test.questions, test.sections),
        scheduledAt: a.scheduledAt ? new Date(a.scheduledAt).toISOString() : undefined,
        codeIssued: !!a.accessCodeIssuedAt,
        attemptStatus: attempt?.status,
        score: attempt?.status === 'submitted' ? attempt.score : undefined,
      });
    }
    return results;
  },

  async start(assignmentId: string, rawInput: unknown, ctx: AuthContext): Promise<StartTestAttemptResult> {
    const candidateId = await resolveCandidateId(ctx);
    const candidate = await candidateRepository.findById(candidateId, ctx.instituteId);
    if (!candidate) throw new NotFoundError('Candidate');

    const assignment = await testAssignmentRepository.findById(assignmentId, ctx.instituteId);
    const eligible =
      !!assignment &&
      assignment.status === 'active' &&
      (assignment.targetType === 'batch' ? assignment.batch === candidate.batch : assignment.candidateIds?.includes(candidateId));
    if (!assignment || !eligible) throw new NotFoundError('Test');

    const test = await testRepository.findById(assignment.testId, ctx.instituteId);
    if (!test) throw new NotFoundError('Test');
    if (assignment.scheduledAt && new Date() < new Date(assignment.scheduledAt)) {
      throw new ForbiddenError(`This test opens at ${new Date(assignment.scheduledAt).toLocaleString()}`);
    }

    let attempt = await testAttemptRepository.findByAssignmentAndCandidate(assignmentId, candidateId, ctx.instituteId);
    if (attempt && attempt.status === 'submitted') throw new ForbiddenError('You have already submitted this test');

    const sessionId = ctx.attemptSessionId;
    if (!sessionId) throw new ValidationError('Missing test session — reload the page and try again.');
    const session = { id: sessionId, ip: ctx.ip, device: deviceOf(ctx.userAgent) };

    // A returning candidate resuming an in-progress attempt doesn't need to re-enter the code —
    // only the very first start of an attempt is gated on it.
    if (!attempt) {
      if (!assignment.accessCodeHash) {
        throw new ForbiddenError('This test has not been unlocked yet — wait for your access code from your TPO/faculty.');
      }

      const { accessCode } = startTestSchema.parse(rawInput);
      const isValid = await bcrypt.compare(accessCode, assignment.accessCodeHash);
      if (!isValid) throw new ForbiddenError('Incorrect access code');

      const { os, browser } = parseUserAgent(ctx.userAgent);
      attempt = await testAttemptRepository.create(
        ctx.instituteId,
        assignment.testId,
        assignmentId,
        candidateId,
        drawQuestionOrder(test.questions, test.sections),
        { ipAddresses: ctx.ip ? [ctx.ip] : [], os, browser },
        session,
        eventOf('started', ctx)
      );
    } else {
      const active = attempt.activeSession;
      const sameSession = active?.id === sessionId;
      if (!sameSession) {
        // Another window/device is still driving this attempt — refuse, don't steal it.
        if (isLive(attempt)) {
          await testAttemptRepository.pushEvent(idOf(attempt), eventOf('session_blocked', ctx, `Second window refused while the test is live on ${active!.ip ?? 'another device'}`));
          throw new ConflictError('This test is already open in another browser or device. Only one session can run a test at a time — close it there first.');
        }
        // A network this attempt has never been on needs staff to vouch for it first.
        const knownIps = attempt.proctoring?.ipAddresses ?? [];
        if (ctx.ip && knownIps.length > 0 && !knownIps.includes(ctx.ip) && !attempt.allowNewDevice) {
          await testAttemptRepository.pushEvent(idOf(attempt), eventOf('session_blocked', ctx, `Resume from a new network refused (known: ${knownIps.join(', ')})`), { newDeviceBlocked: true });
          throw new ForbiddenError('This test was started on a different network/device. Ask your TPO or faculty to allow this device from the test monitor, then try again.');
        }
      }
      const eventType: TestAttemptEventType = sameSession || !active ? 'resumed' : 'session_takeover';
      const detail = eventType === 'session_takeover' ? `Took over from ${active!.ip ?? 'unknown IP'}${attempt.allowNewDevice ? ' (allowed by staff)' : ''}` : undefined;
      attempt = (await testAttemptRepository.openSession(idOf(attempt), session, { newSession: !sameSession }, eventOf(eventType, ctx, detail))) ?? attempt;
    }

    // Past its time already (e.g. the candidate closed the tab and came back much later) —
    // close it now rather than reopening an expired paper.
    if (Date.now() > new Date(attempt.startedAt).getTime() + test.durationMinutes * 60_000 + OVERTIME_GRACE_MS) {
      await endAttempt(test, attempt, 'Time limit reached', eventOf('auto_submitted', ctx, 'Time limit reached'));
      throw new ForbiddenError('The time for this test is over — your attempt has been submitted.');
    }

    // Each candidate sees the paper's questions in their own shuffled order — defeats a
    // "Q4 is B" cheat-sheet passed between candidates on the same paper. The client only ever
    // deals in positions within *this* shuffled order, so the attempt's answers/viewed indexes
    // (stored against the paper's original order) are translated here before being returned.
    const order = orderFor(attempt, test.questions.length);
    const attemptForClient = remapAttemptForClient(toAttemptApiShape(attempt), order);

    return {
      attempt: attemptForClient,
      title: test.title,
      description: test.description,
      instructions: test.instructions,
      sections: sectionsOf(test),
      questions: order.map((originalIndex) => {
        const q = test.questions[originalIndex];
        return {
          questionText: q.questionText,
          questionType: q.questionType,
          options: q.options,
          marks: q.marks,
          sectionIndex: q.sectionIndex ?? 0,
          allowedLanguages: q.allowedLanguages,
          starterCode: q.starterCode,
          // Hidden test cases are never sent to the candidate's client.
          testCases: q.testCases?.filter((tc) => !tc.hidden),
        };
      }),
      durationMinutes: test.durationMinutes,
      violationLimit: test.violationLimit,
      allowedFullscreenExits: test.allowedFullscreenExits ?? 1,
      requireCamera: test.requireCamera ?? true,
      requireScreenShare: test.requireScreenShare ?? true,
      fullscreenExitsUsed: attempt.violations.filter((v) => v.type === 'fullscreen_exit').length,
      serverTime: new Date().toISOString(),
    };
  },

  async submitAnswer(attemptId: string, rawInput: unknown, ctx: AuthContext): Promise<TestAttemptApiShape> {
    const data = submitAnswerSchema.parse(rawInput);
    const attempt = await loadOwnOpenAttempt(attemptId, ctx);

    const test = await testRepository.findById(attempt.testId, ctx.instituteId);
    if (!test) throw new NotFoundError('Test');
    const order = orderFor(attempt, test.questions.length);

    const updated = await testAttemptRepository.upsertAnswer(attemptId, { ...data, questionIndex: toOriginalIndex(order, data.questionIndex) });
    if (!updated) throw new NotFoundError('Test attempt');
    return remapAttemptForClient(toAttemptApiShape(updated), order);
  },

  /** Logs one proctoring violation and auto-submits the attempt the moment the
   *  test's configured limit is exceeded — the whole point of a violation limit
   *  is that it's enforced server-side, not trusted to the client to honor. */
  async logViolation(attemptId: string, rawInput: unknown, ctx: AuthContext): Promise<LogViolationResult> {
    const data = logViolationSchema.parse(rawInput);
    const candidateId = await resolveCandidateId(ctx);
    const attempt = await testAttemptRepository.findById(attemptId, ctx.instituteId);
    if (!attempt || attempt.candidateId !== candidateId) throw new NotFoundError('Test attempt');
    const test = await testRepository.findById(attempt.testId, ctx.instituteId);
    if (!test) throw new NotFoundError('Test');
    const allowedFullscreenExits = test.allowedFullscreenExits ?? 1;
    const fullscreenExitsOf = (a: ITestAttempt) => a.violations.filter((v) => v.type === 'fullscreen_exit').length;

    if (attempt.status !== 'in_progress') {
      return {
        violationCount: attempt.violations.length,
        limit: test.violationLimit,
        autoSubmitted: attempt.autoSubmitted,
        fullscreenExitsUsed: fullscreenExitsOf(attempt),
        allowedFullscreenExits,
        terminationReason: attempt.terminationReason,
      };
    }
    await assertActiveSession(attempt, ctx);

    const label = data.detail ? `${data.type}: ${data.detail}` : data.type;
    const updated = (await testAttemptRepository.pushViolation(attemptId, { type: data.type, at: new Date(), detail: data.detail }, eventOf('violation', ctx, label))) ?? attempt;
    const violationCount = updated.violations.length;
    const fullscreenExitsUsed = fullscreenExitsOf(updated);

    // Zero tolerance for extensions and extra screens; fullscreen exits have their own small
    // allowance; everything else counts toward the general violation limit.
    let terminationReason: string | undefined;
    if (data.type === 'extension_detected') terminationReason = `Browser extension detected${data.detail ? ` — ${data.detail}` : ''}`;
    else if (data.type === 'multiple_screens') terminationReason = 'Multiple screens detected';
    else if (data.type === 'fullscreen_exit' && fullscreenExitsUsed > allowedFullscreenExits) terminationReason = `Left fullscreen ${fullscreenExitsUsed} times (allowed ${allowedFullscreenExits})`;
    else if (violationCount > test.violationLimit) terminationReason = `Violation limit exceeded (${violationCount} of ${test.violationLimit} allowed)`;

    if (terminationReason) await endAttempt(test, updated, terminationReason, eventOf('auto_submitted', ctx, terminationReason));

    return { violationCount, limit: test.violationLimit, autoSubmitted: !!terminationReason, fullscreenExitsUsed, allowedFullscreenExits, terminationReason };
  },

  /** Best-effort telemetry from the candidate's client — records that a question was
   *  actually displayed, so an unanswered question can be told apart as 'skipped' (seen,
   *  left blank) vs 'not_viewed' (never reached) in result analysis. Silently ignored once
   *  the attempt is no longer in progress. */
  async markViewed(attemptId: string, rawInput: unknown, ctx: AuthContext): Promise<void> {
    const { questionIndex } = markViewedSchema.parse(rawInput);
    const candidateId = await resolveCandidateId(ctx);
    const attempt = await testAttemptRepository.findById(attemptId, ctx.instituteId);
    if (!attempt || attempt.candidateId !== candidateId) throw new NotFoundError('Test attempt');
    if (attempt.status !== 'in_progress') return;
    await assertActiveSession(attempt, ctx);

    const test = await testRepository.findById(attempt.testId, ctx.instituteId);
    if (!test) throw new NotFoundError('Test');
    const order = orderFor(attempt, test.questions.length);

    await testAttemptRepository.markViewed(attemptId, toOriginalIndex(order, questionIndex));
  },

  async submit(attemptId: string, ctx: AuthContext): Promise<TestAttemptApiShape> {
    const attempt = await loadOwnOpenAttempt(attemptId, ctx);

    const test = await testRepository.findById(attempt.testId, ctx.instituteId);
    if (!test) throw new NotFoundError('Test');

    const { score, questionResults } = await scoreAttemptDetailed(test, attempt);
    const updated = await testAttemptRepository.submit(attemptId, { autoSubmitted: false, score, questionResults, event: eventOf('submitted', ctx, `Score ${score}/${test.totalMarks}`) });
    if (!updated) throw new ValidationError('This attempt has already been submitted');
    return toAttemptApiShape(updated);
  },

  /** Candidate client pings every ~15s: keeps the session alive (and the session lock held),
   *  records IP changes, closes an attempt that's run past its time, and tells a window that
   *  was ended by staff/violations — or replaced by another session — to stop. */
  async heartbeat(attemptId: string, ctx: AuthContext): Promise<TestHeartbeatResult> {
    const candidateId = await resolveCandidateId(ctx);
    const attempt = await testAttemptRepository.findById(attemptId, ctx.instituteId);
    if (!attempt || attempt.candidateId !== candidateId) throw new NotFoundError('Test attempt');
    if (attempt.status !== 'in_progress') return { status: attempt.status, autoSubmitted: attempt.autoSubmitted, terminationReason: attempt.terminationReason };

    await assertActiveSession(attempt, ctx);

    const test = await testRepository.findById(attempt.testId, ctx.instituteId);
    if (test && Date.now() > new Date(attempt.startedAt).getTime() + test.durationMinutes * 60_000 + OVERTIME_GRACE_MS) {
      await endAttempt(test, attempt, 'Time limit reached', eventOf('auto_submitted', ctx, 'Time limit reached'));
      return { status: 'submitted', autoSubmitted: true, terminationReason: 'Time limit reached' };
    }
    return { status: 'in_progress', autoSubmitted: false };
  },

  // ── Staff: live monitor & control ─────────────────────────────────────────

  /** Everyone a test was sent to — started or not — with their attempt's live status, IPs,
   *  devices, violations and full audit trail. Backs the staff monitor page and its exports. */
  async getMonitor(testId: string, ctx: AuthContext): Promise<TestMonitor> {
    const test = await testRepository.findById(testId, ctx.instituteId);
    if (!test) throw new NotFoundError('Test');

    const [attempts, assignments] = await Promise.all([
      testAttemptRepository.findByTest(testId, ctx.instituteId),
      testAssignmentRepository.findByTest(testId, ctx.instituteId),
    ]);

    // Who was this test sent to? (batch sendouts -> the batch's candidates; named sendouts -> those.)
    const targets = new Map<string, string>(); // candidateId -> assignment label
    for (const a of assignments) {
      const label = assignmentLabel(a);
      const ids =
        a.targetType === 'batch' && a.batch
          ? (await candidateRepository.findByBatch(ctx.instituteId, a.batch)).map((c) => idOf(c))
          : a.candidateIds ?? [];
      ids.forEach((id) => { if (!targets.has(id)) targets.set(id, label); });
    }
    const labelByAssignment = new Map(assignments.map((a) => [idOf(a), assignmentLabel(a)]));

    const candidateIds = [...new Set([...targets.keys(), ...attempts.map((a) => a.candidateId)])];
    const candidates = candidateIds.length ? await candidateRepository.findAllForSchoolByIds(candidateIds, ctx.instituteId) : [];
    const candidateById = new Map(candidates.map((c) => [idOf(c), c]));

    const questionCount = paperQuestionCount(test.questions, test.sections);
    const iso = (d?: Date) => (d ? new Date(d).toISOString() : undefined);

    const rowFor = (candidateId: string, attempt?: ITestAttempt): TestMonitorRow => {
      const c = candidateById.get(candidateId);
      const base = {
        candidateId,
        candidateName: c?.fullName ?? 'Unknown',
        rollNumber: c?.rollNumber,
        email: c?.email,
        batch: c?.batch,
        totalMarks: test.totalMarks,
        questionCount,
      };
      if (!attempt) {
        return {
          ...base,
          assignmentLabel: targets.get(candidateId),
          status: 'not_started',
          online: false,
          answeredCount: 0,
          ipAddresses: [],
          ipChanges: 0,
          sessionCount: 0,
          resumeCount: 0,
          violationCount: 0,
          violationsByType: {},
          fullscreenExits: 0,
          tabSwitches: 0,
          newDeviceBlocked: false,
          timeline: [],
        };
      }

      const violationsByType: Partial<Record<TestViolationType, number>> = {};
      for (const v of attempt.violations) violationsByType[v.type] = (violationsByType[v.type] ?? 0) + 1;

      // Violations are logged as events (with IP) since the audit trail existed; older
      // attempts only have the bare violations list, so fall back to that.
      const events = attempt.events ?? [];
      const hasViolationEvents = events.some((e) => e.type === 'violation');
      const timeline: TestAttemptEventApiShape[] = [
        ...events.map((e) => ({ type: e.type, at: new Date(e.at).toISOString(), ip: e.ip, device: e.device, detail: e.detail })),
        ...(hasViolationEvents ? [] : attempt.violations.map((v) => ({ type: 'violation' as const, at: new Date(v.at).toISOString(), detail: v.detail ? `${v.type}: ${v.detail}` : v.type }))),
      ].sort((a, b) => a.at.localeCompare(b.at));

      const ipAddresses = attempt.proctoring?.ipAddresses ?? [];
      return {
        ...base,
        attemptId: idOf(attempt),
        assignmentLabel: labelByAssignment.get(attempt.assignmentId),
        status: attempt.status === 'in_progress' ? 'in_progress' : attempt.autoSubmitted ? 'auto_submitted' : 'submitted',
        online: isLive(attempt),
        lastSeenAt: iso(attempt.activeSession?.lastSeenAt),
        startedAt: iso(attempt.startedAt),
        submittedAt: iso(attempt.submittedAt),
        score: attempt.status === 'submitted' ? attempt.score : undefined,
        answeredCount: attempt.answers.filter((a) => a.selectedOption?.trim() || a.answerText?.trim() || a.code?.trim()).length,
        currentIp: attempt.activeSession?.ip ?? ipAddresses[ipAddresses.length - 1],
        ipAddresses,
        ipChanges: Math.max(0, ipAddresses.length - 1),
        sessionCount: attempt.sessionCount ?? 1,
        resumeCount: attempt.resumeCount ?? 0,
        os: attempt.proctoring?.os,
        browser: attempt.proctoring?.browser,
        violationCount: attempt.violations.length,
        violationsByType,
        fullscreenExits: violationsByType.fullscreen_exit ?? 0,
        tabSwitches: violationsByType.tab_switch ?? 0,
        terminationReason: attempt.terminationReason,
        newDeviceBlocked: !!attempt.newDeviceBlocked,
        timeline,
      };
    };

    const attemptedCandidates = new Set(attempts.map((a) => a.candidateId));
    const rows = [
      ...attempts.map((a) => rowFor(a.candidateId, a)),
      ...[...targets.keys()].filter((id) => !attemptedCandidates.has(id)).map((id) => rowFor(id)),
    ].sort((a, b) => a.candidateName.localeCompare(b.candidateName));

    return {
      testId,
      title: test.title,
      track: test.track,
      totalMarks: test.totalMarks,
      durationMinutes: test.durationMinutes,
      violationLimit: test.violationLimit,
      allowedFullscreenExits: test.allowedFullscreenExits ?? 1,
      questionCount,
      poolSize: test.questions.length,
      generatedAt: new Date().toISOString(),
      rows,
    };
  },

  /** Staff: lets a candidate whose resume from a new network/device was refused continue there. */
  async allowNewDevice(attemptId: string, ctx: AuthContext): Promise<void> {
    const attempt = await testAttemptRepository.findById(attemptId, ctx.instituteId);
    if (!attempt) throw new NotFoundError('Test attempt');
    if (attempt.status !== 'in_progress') throw new ValidationError('This attempt is already submitted');
    await testAttemptRepository.pushEvent(attemptId, eventOf('new_device_allowed', ctx, `Allowed by ${ctx.displayName}`), {
      allowNewDevice: true,
      newDeviceBlocked: false,
      // Release the lock so the new device doesn't also have to wait out the old session.
      'activeSession.lastSeenAt': new Date(0),
    });
  },

  /** Staff: ends a candidate's attempt now (grades what they've answered). */
  async forceSubmit(attemptId: string, ctx: AuthContext): Promise<void> {
    const attempt = await testAttemptRepository.findById(attemptId, ctx.instituteId);
    if (!attempt) throw new NotFoundError('Test attempt');
    if (attempt.status !== 'in_progress') throw new ValidationError('This attempt is already submitted');
    const test = await testRepository.findById(attempt.testId, ctx.instituteId);
    if (!test) throw new NotFoundError('Test');
    const reason = `Ended by ${ctx.displayName}`;
    await endAttempt(test, attempt, reason, eventOf('force_submitted', ctx, reason));
  },

  /** Candidate-facing "Run" — executes against a coding question's *visible* sample test
   *  cases only (never the hidden ones used for scoring), or once against the candidate's own
   *  custom input. Never persists anything. */
  async runCode(attemptId: string, rawInput: unknown, ctx: AuthContext): Promise<RunCodeResult> {
    const data = runCodeSchema.parse(rawInput);
    const { question } = await loadCodingQuestion(attemptId, data, ctx);

    if (data.customInput !== undefined) {
      if (!isJudge0Configured()) return { status: 'not_configured', results: [], allPassed: false };
      const run = await judge0Semaphore.run(() => runOnJudge0({ code: data.code, language: data.language, stdin: data.customInput ?? '' }));
      if (run.statusId === 6) return { status: 'compile_error', compileError: run.compileOutput || run.stderr, results: [], allPassed: false };
      return { status: 'ok', results: [], allPassed: false, custom: { stdout: run.stdout, stderr: run.stderr, status: run.status, time: run.time } };
    }

    const visibleCases = question.testCases?.filter((tc) => !tc.hidden) ?? [];
    if (visibleCases.length === 0) return { status: 'ok', results: [], allPassed: true };

    return runAgainstTestCases(data.code, data.language, visibleCases);
  },

  /** Candidate-facing "Submit code" — saves the code as the question's answer and judges it
   *  against every test case, hidden included. The verdict is stored on the answer and reused
   *  at final scoring as long as the code isn't changed afterwards. Hidden cases come back
   *  masked: pass/fail only. */
  async submitCode(attemptId: string, rawInput: unknown, ctx: AuthContext): Promise<SubmitCodeResult> {
    const data = submitCodeSchema.parse(rawInput);
    const { question, originalIndex } = await loadCodingQuestion(attemptId, data, ctx);

    await testAttemptRepository.upsertAnswer(attemptId, { questionIndex: originalIndex, code: data.code, language: data.language });

    const cases = question.testCases ?? [];
    const result = await runAgainstTestCases(data.code, data.language, cases);
    // A compile error passes nothing — recorded too, so a broken final version scores 0
    // without being re-judged.
    const passedCount = result.status === 'ok' ? result.results.filter((r) => r.passed).length : 0;
    if (result.status !== 'not_configured') {
      await testAttemptRepository.pushEvent(attemptId, eventOf('code_submitted', ctx, `Q${data.questionIndex + 1} · ${data.language} · ${passedCount}/${cases.length} cases`));
      await testAttemptRepository.setSubmission(attemptId, originalIndex, {
        code: data.code,
        language: data.language,
        passedCount,
        totalCount: cases.length,
        submittedAt: new Date(),
      });
    }

    return { ...result, results: result.results.map(maskHidden), passedCount, totalCount: cases.length };
  },
};

/** Shared guard for Run / Submit code: the attempt is the caller's and still open, and the
 *  question is a coding question that allows the chosen language. `data.questionIndex` is a
 *  position in the candidate's shuffled order; `originalIndex` is the paper's own index, which
 *  is what gets persisted. */
async function loadCodingQuestion(attemptId: string, data: { questionIndex: number; language: CodingLanguage }, ctx: AuthContext) {
  const attempt = await loadOwnOpenAttempt(attemptId, ctx);

  const test = await testRepository.findById(attempt.testId, ctx.instituteId);
  if (!test) throw new NotFoundError('Test');

  const originalIndex = toOriginalIndex(orderFor(attempt, test.questions.length), data.questionIndex);
  const question = test.questions[originalIndex];
  if (!question || question.questionType !== 'coding') throw new ValidationError('Question is not a coding question');
  if (!question.allowedLanguages?.includes(data.language)) throw new ValidationError('That language is not allowed for this question');
  return { attempt, test, question, originalIndex };
}
