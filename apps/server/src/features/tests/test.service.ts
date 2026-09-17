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
} from './test.validation';
import { ITest, ITestAttempt, ITestAssignment, ITestQuestionSnapshot } from './test.model';
import { NotFoundError, ValidationError, ForbiddenError } from '../../middlewares/errorHandler';
import { AuthContext } from '../../lib/auth-context';
import { candidateRepository } from '../candidates/candidate.repository';
import { resolveCandidateId } from '../candidates/candidate.service';
import { notificationRepository } from '../notifications/notification.repository';
import { assertFacultyCanAccessQuestionBank } from '../training-schedule/training-schedule.service';
import { testGeneratorService } from './test-generator.service';
import { isJudge0Configured, runOnJudge0 } from '../../lib/judge0';
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
} from '@placementos/types';

const idOf = (doc: unknown) => String((doc as { _id: { toString(): string } })._id);

const toTestApiShape = (t: ITest): TestApiShape => ({
  _id: idOf(t),
  instituteId: t.instituteId,
  title: t.title,
  track: t.track,
  questions: t.questions,
  totalMarks: t.totalMarks,
  durationMinutes: t.durationMinutes,
  violationLimit: t.violationLimit,
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
  answers: a.answers,
  violations: a.violations.map((v) => ({ type: v.type, at: new Date(v.at).toISOString(), detail: v.detail })),
  score: a.score,
  status: a.status,
});

const ACCESS_CODE_SALT_ROUNDS = 10;
const ACCESS_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I — avoids look-alike mistypes

function generateAccessCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) code += ACCESS_CODE_ALPHABET[Math.floor(Math.random() * ACCESS_CODE_ALPHABET.length)];
  return code;
}

/** Runs `code` against every one of a coding question's test cases via Judge0 and reports
 *  per-case pass/fail. Shared by the candidate-facing "Run" endpoint (visible cases only) and
 *  by scoring at submit time (all cases, including hidden ones). Compares stdout trimmed of
 *  trailing whitespace — the same tolerance every judge (including Judge0 itself) applies, so a
 *  correct solution isn't marked wrong over a trailing newline. */
async function runAgainstTestCases(code: string, language: NonNullable<ITestQuestionSnapshot['allowedLanguages']>[number], cases: NonNullable<ITestQuestionSnapshot['testCases']>): Promise<RunCodeResult> {
  if (!isJudge0Configured()) {
    return { status: 'not_configured', results: [], allPassed: false };
  }

  const results: RunCodeCaseResult[] = [];
  for (const testCase of cases) {
    const run = await runOnJudge0({ code, language, stdin: testCase.input });

    if (run.statusId === 6) {
      // Compilation error — same for every case, so surface it once and stop.
      return { status: 'compile_error', compileError: run.compileOutput || run.stderr, results: [], allPassed: false };
    }

    const stdout = run.stdout.trimEnd();
    const expected = testCase.expectedOutput.trimEnd();
    results.push({
      hidden: testCase.hidden,
      passed: run.statusId === 3 && stdout === expected, // 3 = "Accepted" (ran to completion)
      input: testCase.input,
      expectedOutput: testCase.expectedOutput,
      stdout: run.stdout,
      stderr: run.stderr,
    });
  }

  const allPassed = results.length > 0 && results.every((r) => r.passed);
  return { status: 'ok', results, allPassed };
}

/** Auto-grades MCQ, exact-match short-answer, and coding questions. Open-ended answers with
 *  no correctAnswer set simply don't contribute — a human reviewer can still read them in the
 *  attempt review screen. Coding questions award proportional marks based on the fraction of
 *  test cases (visible + hidden) the candidate's last-saved code passes; if Judge0 isn't
 *  configured, or the question has no test cases, they contribute 0 (manual review only). */
async function scoreAttempt(test: ITest, attempt: ITestAttempt): Promise<number> {
  let score = 0;
  for (const answer of attempt.answers) {
    const question = test.questions[answer.questionIndex];
    if (!question) continue;

    if (question.questionType === 'coding') {
      if (!answer.code || !answer.language || !question.testCases?.length || !isJudge0Configured()) continue;
      try {
        const result = await runAgainstTestCases(answer.code, answer.language, question.testCases);
        if (result.status === 'ok' && result.results.length > 0) {
          const passedCount = result.results.filter((r) => r.passed).length;
          score += Math.round(question.marks * (passedCount / result.results.length));
        }
      } catch {
        // Judge0 unreachable at submit time — treat as unscored rather than failing the whole submit.
      }
      continue;
    }

    if (!question.correctAnswer) continue;
    const given = question.questionType === 'mcq' ? answer.selectedOption : answer.answerText;
    if (given?.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase()) {
      score += question.marks;
    }
  }
  return score;
}

export const testService = {
  // ── Faculty / TPO authoring ────────────────────────────────────────────────

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
      questions,
      durationMinutes: input.durationMinutes,
      violationLimit: input.violationLimit,
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
          questionCount: test.questions.length,
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

  // ── Candidate-facing ─────────────────────────────────────────────────────

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
        batch: a.targetType === 'batch' ? a.batch : undefined,
        track: test.track,
        totalMarks: test.totalMarks,
        durationMinutes: test.durationMinutes,
        violationLimit: test.violationLimit,
        questionCount: test.questions.length,
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

    // A returning candidate resuming an in-progress attempt doesn't need to re-enter the code —
    // only the very first start of an attempt is gated on it.
    if (!attempt) {
      if (!assignment.accessCodeHash) {
        throw new ForbiddenError('This test has not been unlocked yet — wait for your access code from your TPO/faculty.');
      }

      const { accessCode } = startTestSchema.parse(rawInput);
      const isValid = await bcrypt.compare(accessCode, assignment.accessCodeHash);
      if (!isValid) throw new ForbiddenError('Incorrect access code');

      attempt = await testAttemptRepository.create(ctx.instituteId, assignment.testId, assignmentId, candidateId);
    }

    return {
      attempt: toAttemptApiShape(attempt),
      questions: test.questions.map((q) => ({
        questionText: q.questionText,
        questionType: q.questionType,
        options: q.options,
        marks: q.marks,
        allowedLanguages: q.allowedLanguages,
        starterCode: q.starterCode,
        // Hidden test cases are never sent to the candidate's client.
        testCases: q.testCases?.filter((tc) => !tc.hidden),
      })),
      durationMinutes: test.durationMinutes,
      violationLimit: test.violationLimit,
      serverTime: new Date().toISOString(),
    };
  },

  async submitAnswer(attemptId: string, rawInput: unknown, ctx: AuthContext): Promise<TestAttemptApiShape> {
    const data = submitAnswerSchema.parse(rawInput);
    const candidateId = await resolveCandidateId(ctx);
    const attempt = await testAttemptRepository.findById(attemptId, ctx.instituteId);
    if (!attempt || attempt.candidateId !== candidateId) throw new NotFoundError('Test attempt');
    if (attempt.status !== 'in_progress') throw new ValidationError('This attempt has already been submitted');

    const updated = await testAttemptRepository.upsertAnswer(attemptId, data);
    if (!updated) throw new NotFoundError('Test attempt');
    return toAttemptApiShape(updated);
  },

  /** Logs one proctoring violation and auto-submits the attempt the moment the
   *  test's configured limit is exceeded — the whole point of a violation limit
   *  is that it's enforced server-side, not trusted to the client to honor. */
  async logViolation(attemptId: string, rawInput: unknown, ctx: AuthContext): Promise<LogViolationResult> {
    const data = logViolationSchema.parse(rawInput);
    const candidateId = await resolveCandidateId(ctx);
    const attempt = await testAttemptRepository.findById(attemptId, ctx.instituteId);
    if (!attempt || attempt.candidateId !== candidateId) throw new NotFoundError('Test attempt');
    if (attempt.status !== 'in_progress') {
      return { violationCount: attempt.violations.length, limit: 0, autoSubmitted: attempt.autoSubmitted };
    }

    const test = await testRepository.findById(attempt.testId, ctx.instituteId);
    if (!test) throw new NotFoundError('Test');

    const updated = await testAttemptRepository.pushViolation(attemptId, { type: data.type, at: new Date(), detail: data.detail });
    const violationCount = updated?.violations.length ?? attempt.violations.length + 1;

    let autoSubmitted = false;
    if (violationCount > test.violationLimit) {
      const score = updated ? await scoreAttempt(test, updated) : undefined;
      await testAttemptRepository.submit(attemptId, { autoSubmitted: true, score });
      autoSubmitted = true;
    }

    return { violationCount, limit: test.violationLimit, autoSubmitted };
  },

  async submit(attemptId: string, ctx: AuthContext): Promise<TestAttemptApiShape> {
    const candidateId = await resolveCandidateId(ctx);
    const attempt = await testAttemptRepository.findById(attemptId, ctx.instituteId);
    if (!attempt || attempt.candidateId !== candidateId) throw new NotFoundError('Test attempt');
    if (attempt.status !== 'in_progress') throw new ValidationError('This attempt has already been submitted');

    const test = await testRepository.findById(attempt.testId, ctx.instituteId);
    if (!test) throw new NotFoundError('Test');

    const score = await scoreAttempt(test, attempt);
    const updated = await testAttemptRepository.submit(attemptId, { autoSubmitted: false, score });
    if (!updated) throw new NotFoundError('Test attempt');
    return toAttemptApiShape(updated);
  },

  /** Candidate-facing "Run" — executes against a coding question's *visible* sample test
   *  cases only (never the hidden ones used for scoring), and never persists anything. */
  async runCode(attemptId: string, rawInput: unknown, ctx: AuthContext): Promise<RunCodeResult> {
    const data = runCodeSchema.parse(rawInput);
    const candidateId = await resolveCandidateId(ctx);
    const attempt = await testAttemptRepository.findById(attemptId, ctx.instituteId);
    if (!attempt || attempt.candidateId !== candidateId) throw new NotFoundError('Test attempt');
    if (attempt.status !== 'in_progress') throw new ValidationError('This attempt has already been submitted');

    const test = await testRepository.findById(attempt.testId, ctx.instituteId);
    if (!test) throw new NotFoundError('Test');

    const question = test.questions[data.questionIndex];
    if (!question || question.questionType !== 'coding') throw new ValidationError('Question is not a coding question');
    if (!question.allowedLanguages?.includes(data.language)) throw new ValidationError('That language is not allowed for this question');

    const visibleCases = question.testCases?.filter((tc) => !tc.hidden) ?? [];
    if (visibleCases.length === 0) return { status: 'ok', results: [], allPassed: true };

    return runAgainstTestCases(data.code, data.language, visibleCases);
  },
};
