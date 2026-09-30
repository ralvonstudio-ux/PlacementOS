import { Test, ITest, TestAttempt, ITestAttempt, ITestViolation, ITestAnswer, ITestProctoringInfo, ITestQuestionResult } from './test.model';
import { CreateTestInput } from './test.validation';

export const testRepository = {
  async create(instituteId: string, createdBy: string, data: CreateTestInput): Promise<ITest> {
    const totalMarks = data.questions.reduce((sum, q) => sum + q.marks, 0);
    return Test.create({ ...data, totalMarks, instituteId, createdBy });
  },

  async findById(id: string, instituteId: string): Promise<ITest | null> {
    return Test.findOne({ _id: id, instituteId, isDeleted: false });
  },

  async findAll(instituteId: string): Promise<ITest[]> {
    return Test.find({ instituteId, isDeleted: false }).sort({ createdAt: -1 }).lean<ITest[]>();
  },

  async update(id: string, instituteId: string, data: Partial<CreateTestInput> & { status?: ITest['status'] }): Promise<ITest | null> {
    const $set: Record<string, unknown> = { ...data };
    if (data.questions) $set.totalMarks = data.questions.reduce((sum, q) => sum + q.marks, 0);
    return Test.findOneAndUpdate({ _id: id, instituteId, isDeleted: false }, { $set }, { new: true });
  },

  async review(
    id: string,
    instituteId: string,
    data: { status: 'approved' | 'rejected'; reviewNote?: string; reviewedBy: string; reviewedAt: Date }
  ): Promise<ITest | null> {
    return Test.findOneAndUpdate({ _id: id, instituteId, isDeleted: false }, { $set: data }, { new: true });
  },

  async softDelete(id: string, instituteId: string): Promise<boolean> {
    const res = await Test.updateOne({ _id: id, instituteId, isDeleted: false }, { $set: { isDeleted: true, deletedAt: new Date() } });
    return res.modifiedCount > 0;
  },
};

export const testAttemptRepository = {
  async findByAssignmentAndCandidate(assignmentId: string, candidateId: string, instituteId: string): Promise<ITestAttempt | null> {
    return TestAttempt.findOne({ assignmentId, candidateId, instituteId });
  },

  async findById(id: string, instituteId: string): Promise<ITestAttempt | null> {
    return TestAttempt.findOne({ _id: id, instituteId });
  },

  /** `questionCount` seeds a fresh Fisher-Yates shuffle of [0..questionCount) — this
   *  candidate's own question order for the attempt's whole lifetime (see
   *  ITestAttempt.questionOrder). */
  async create(instituteId: string, testId: string, assignmentId: string, candidateId: string, questionCount: number, proctoring?: ITestProctoringInfo): Promise<ITestAttempt> {
    const questionOrder = Array.from({ length: questionCount }, (_, i) => i);
    for (let i = questionOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questionOrder[i], questionOrder[j]] = [questionOrder[j], questionOrder[i]];
    }
    return TestAttempt.create({ instituteId, testId, assignmentId, candidateId, startedAt: new Date(), status: 'in_progress', questionOrder, proctoring });
  },

  /** Called each time a candidate re-enters an already-started attempt — folds in any new
   *  IP address seen and bumps the resume count (mirrors a proctoring platform's "Resume
   *  Count" field). */
  async recordResume(attemptId: string, ip?: string): Promise<ITestAttempt | null> {
    return TestAttempt.findByIdAndUpdate(
      attemptId,
      { $inc: { resumeCount: 1 }, ...(ip ? { $addToSet: { 'proctoring.ipAddresses': ip } } : {}) },
      { new: true }
    );
  },

  async markViewed(attemptId: string, questionIndex: number): Promise<void> {
    await TestAttempt.updateOne({ _id: attemptId }, { $addToSet: { viewedQuestionIndexes: questionIndex } });
  },

  async upsertAnswer(attemptId: string, answer: ITestAnswer): Promise<ITestAttempt | null> {
    await TestAttempt.updateOne({ _id: attemptId, 'answers.questionIndex': answer.questionIndex }, { $set: { 'answers.$': answer } });
    const updated = await TestAttempt.findById(attemptId);
    if (updated && !updated.answers.some((a) => a.questionIndex === answer.questionIndex)) {
      updated.answers.push(answer);
      await updated.save();
    }
    return updated;
  },

  async pushViolation(attemptId: string, violation: ITestViolation): Promise<ITestAttempt | null> {
    return TestAttempt.findByIdAndUpdate(attemptId, { $push: { violations: violation } }, { new: true });
  },

  async submit(attemptId: string, data: { autoSubmitted: boolean; score?: number; questionResults?: ITestQuestionResult[] }): Promise<ITestAttempt | null> {
    return TestAttempt.findByIdAndUpdate(
      attemptId,
      { $set: { status: 'submitted', submittedAt: new Date(), autoSubmitted: data.autoSubmitted, score: data.score, questionResults: data.questionResults } },
      { new: true }
    );
  },

  /** Every attempt for a test — backs the faculty/TPO review screen. */
  async findByTest(testId: string, instituteId: string): Promise<ITestAttempt[]> {
    return TestAttempt.find({ testId, instituteId }).lean<ITestAttempt[]>();
  },

  /** Every submitted attempt for a test — used to compute topper/average/least scores across
   *  candidates for the result-analysis screen. */
  async findSubmittedByTest(testId: string, instituteId: string): Promise<ITestAttempt[]> {
    return TestAttempt.find({ testId, instituteId, status: 'submitted' }).lean<ITestAttempt[]>();
  },
};
