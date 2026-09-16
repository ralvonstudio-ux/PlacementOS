import { Test, ITest, TestAttempt, ITestAttempt, ITestViolation, ITestAnswer } from './test.model';
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

  async create(instituteId: string, testId: string, assignmentId: string, candidateId: string): Promise<ITestAttempt> {
    return TestAttempt.create({ instituteId, testId, assignmentId, candidateId, startedAt: new Date(), status: 'in_progress' });
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

  async submit(attemptId: string, data: { autoSubmitted: boolean; score?: number }): Promise<ITestAttempt | null> {
    return TestAttempt.findByIdAndUpdate(
      attemptId,
      { $set: { status: 'submitted', submittedAt: new Date(), autoSubmitted: data.autoSubmitted, score: data.score } },
      { new: true }
    );
  },

  /** Every attempt for a test — backs the faculty/TPO review screen. */
  async findByTest(testId: string, instituteId: string): Promise<ITestAttempt[]> {
    return TestAttempt.find({ testId, instituteId }).lean<ITestAttempt[]>();
  },
};
