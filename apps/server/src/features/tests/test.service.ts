import { testRepository, testAttemptRepository } from './test.repository';
import { createTestSchema, updateTestSchema, submitAnswerSchema, logViolationSchema } from './test.validation';
import { ITest, ITestAttempt } from './test.model';
import { NotFoundError, ValidationError, ForbiddenError } from '../../middlewares/errorHandler';
import { AuthContext } from '../../lib/auth-context';
import { candidateRepository } from '../candidates/candidate.repository';
import { resolveCandidateId } from '../candidates/candidate.service';
import { assertFacultyCanAccessQuestionBank } from '../training-schedule/training-schedule.service';
import type {
  Test as TestApiShape,
  TestForCandidate,
  StartTestAttemptResult,
  TestAttempt as TestAttemptApiShape,
  LogViolationResult,
  TestAttemptReview,
} from '@placementos/types';

const toTestApiShape = (t: ITest): TestApiShape => ({
  _id: String((t as unknown as { _id: { toString(): string } })._id),
  instituteId: t.instituteId,
  title: t.title,
  batch: t.batch,
  track: t.track,
  questions: t.questions,
  totalMarks: t.totalMarks,
  durationMinutes: t.durationMinutes,
  violationLimit: t.violationLimit,
  status: t.status,
  createdBy: t.createdBy,
  createdAt: new Date(t.createdAt).toISOString(),
  updatedAt: new Date(t.updatedAt).toISOString(),
});

const toAttemptApiShape = (a: ITestAttempt): TestAttemptApiShape => ({
  _id: String((a as unknown as { _id: { toString(): string } })._id),
  instituteId: a.instituteId,
  testId: a.testId,
  candidateId: a.candidateId,
  startedAt: new Date(a.startedAt).toISOString(),
  submittedAt: a.submittedAt ? new Date(a.submittedAt).toISOString() : undefined,
  autoSubmitted: a.autoSubmitted,
  answers: a.answers,
  violations: a.violations.map((v) => ({ type: v.type, at: new Date(v.at).toISOString(), detail: v.detail })),
  score: a.score,
  status: a.status,
});

/** Auto-grades MCQ + exact-match short-answer questions. Open-ended answers with no
 *  correctAnswer set simply don't contribute — a human reviewer can still read them
 *  in the attempt review screen. */
function scoreAttempt(test: ITest, attempt: ITestAttempt): number {
  let score = 0;
  for (const answer of attempt.answers) {
    const question = test.questions[answer.questionIndex];
    if (!question?.correctAnswer) continue;
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
    if (ctx.role === 'faculty') await assertFacultyCanAccessQuestionBank(ctx, data.batch, data.track ?? '');
    const test = await testRepository.create(ctx.instituteId, ctx.userId, data);
    return toTestApiShape(test);
  },

  async update(id: string, rawInput: unknown, ctx: AuthContext): Promise<TestApiShape> {
    const data = updateTestSchema.parse(rawInput);
    const existing = await testRepository.findById(id, ctx.instituteId);
    if (!existing) throw new NotFoundError('Test');
    if (existing.status !== 'draft') throw new ValidationError('Only a draft test can be edited');

    const updated = await testRepository.update(id, ctx.instituteId, data);
    if (!updated) throw new NotFoundError('Test');
    return toTestApiShape(updated);
  },

  async publish(id: string, ctx: AuthContext): Promise<TestApiShape> {
    const existing = await testRepository.findById(id, ctx.instituteId);
    if (!existing) throw new NotFoundError('Test');
    const updated = await testRepository.update(id, ctx.instituteId, { status: 'published' } as never);
    if (!updated) throw new NotFoundError('Test');
    return toTestApiShape(updated);
  },

  async close(id: string, ctx: AuthContext): Promise<TestApiShape> {
    const updated = await testRepository.update(id, ctx.instituteId, { status: 'closed' } as never);
    if (!updated) throw new NotFoundError('Test');
    return toTestApiShape(updated);
  },

  async list(ctx: AuthContext, batch?: string): Promise<TestApiShape[]> {
    const tests = await testRepository.findAll(ctx.instituteId, batch);
    return tests.map(toTestApiShape);
  },

  async remove(id: string, ctx: AuthContext): Promise<void> {
    const deleted = await testRepository.softDelete(id, ctx.instituteId);
    if (!deleted) throw new NotFoundError('Test');
  },

  /** Every attempt for a test, with the candidate's name and the test's own answer key
   *  — faculty/TPO review screen only. */
  async getReview(testId: string, ctx: AuthContext): Promise<TestAttemptReview[]> {
    const test = await testRepository.findById(testId, ctx.instituteId);
    if (!test) throw new NotFoundError('Test');

    const attempts = await testAttemptRepository.findByTest(testId, ctx.instituteId);
    const candidateIds = [...new Set(attempts.map((a) => a.candidateId))];
    const candidates = candidateIds.length
      ? await candidateRepository.findAllForSchoolByIds(candidateIds, ctx.instituteId)
      : [];
    const nameById = new Map(candidates.map((c) => [String((c as unknown as { _id: { toString(): string } })._id), c.fullName]));

    return attempts.map((a) => ({
      attempt: toAttemptApiShape(a),
      candidateName: nameById.get(a.candidateId) ?? 'Unknown',
      test: toTestApiShape(test),
    }));
  },

  // ── Candidate-facing ─────────────────────────────────────────────────────

  async listMine(ctx: AuthContext): Promise<TestForCandidate[]> {
    const candidateId = await resolveCandidateId(ctx);
    const candidate = await candidateRepository.findById(candidateId, ctx.instituteId);
    if (!candidate) throw new NotFoundError('Candidate');

    const tests = await testRepository.findPublishedForBatch(ctx.instituteId, candidate.batch);
    const results: TestForCandidate[] = [];
    for (const t of tests) {
      const attempt = await testAttemptRepository.findByTestAndCandidate(String((t as unknown as { _id: { toString(): string } })._id), candidateId, ctx.instituteId);
      results.push({
        _id: String((t as unknown as { _id: { toString(): string } })._id),
        title: t.title,
        batch: t.batch,
        track: t.track,
        totalMarks: t.totalMarks,
        durationMinutes: t.durationMinutes,
        violationLimit: t.violationLimit,
        questionCount: t.questions.length,
        attemptStatus: attempt?.status,
      });
    }
    return results;
  },

  async start(testId: string, ctx: AuthContext): Promise<StartTestAttemptResult> {
    const candidateId = await resolveCandidateId(ctx);
    const candidate = await candidateRepository.findById(candidateId, ctx.instituteId);
    if (!candidate) throw new NotFoundError('Candidate');

    const test = await testRepository.findById(testId, ctx.instituteId);
    if (!test || test.status !== 'published' || test.batch !== candidate.batch) throw new NotFoundError('Test');

    let attempt = await testAttemptRepository.findByTestAndCandidate(testId, candidateId, ctx.instituteId);
    if (attempt && attempt.status === 'submitted') throw new ForbiddenError('You have already submitted this test');
    if (!attempt) attempt = await testAttemptRepository.create(ctx.instituteId, testId, candidateId);

    return {
      attempt: toAttemptApiShape(attempt),
      questions: test.questions.map((q) => ({ questionText: q.questionText, questionType: q.questionType, options: q.options, marks: q.marks })),
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
      const score = updated ? scoreAttempt(test, updated) : undefined;
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

    const score = scoreAttempt(test, attempt);
    const updated = await testAttemptRepository.submit(attemptId, { autoSubmitted: false, score });
    if (!updated) throw new NotFoundError('Test attempt');
    return toAttemptApiShape(updated);
  },
};
