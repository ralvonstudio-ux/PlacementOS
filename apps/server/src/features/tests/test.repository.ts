import { Test, ITest, TestAttempt, ITestAttempt, ITestViolation, ITestAnswer, ITestProctoringInfo, ITestQuestionResult, ITestAttemptEvent } from './test.model';
import { CreateTestInput } from './test.validation';
import { paperTotalMarks } from './test-paper';

export const testRepository = {
  async create(instituteId: string, createdBy: string, data: CreateTestInput): Promise<ITest> {
    const totalMarks = paperTotalMarks(data.questions, data.sections);
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
    if (data.questions || data.sections) {
      const existing = await Test.findOne({ _id: id, instituteId, isDeleted: false }).lean<ITest>();
      if (existing) $set.totalMarks = paperTotalMarks(data.questions ?? existing.questions, data.sections ?? existing.sections);
    }
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

  /** `questionOrder` is this candidate's drawn paper (see drawQuestionOrder) — fixed for the
   *  attempt's whole lifetime. The opening browser session becomes the attempt's active one. */
  async create(
    instituteId: string,
    testId: string,
    assignmentId: string,
    candidateId: string,
    questionOrder: number[],
    proctoring: ITestProctoringInfo,
    session: { id: string; ip?: string; device?: string },
    event: ITestAttemptEvent
  ): Promise<ITestAttempt> {
    return TestAttempt.create({
      instituteId,
      testId,
      assignmentId,
      candidateId,
      startedAt: new Date(),
      status: 'in_progress',
      questionOrder,
      proctoring,
      activeSession: { ...session, lastSeenAt: new Date() },
      sessionCount: 1,
      events: [event],
    });
  },

  /** Hands the attempt to a (re)opening browser session: bumps the resume count, counts a new
   *  session, folds in its IP, clears any pending new-device block and logs the event. */
  async openSession(attemptId: string, session: { id: string; ip?: string; device?: string }, opts: { newSession: boolean }, event: ITestAttemptEvent): Promise<ITestAttempt | null> {
    return TestAttempt.findByIdAndUpdate(
      attemptId,
      {
        $set: { activeSession: { ...session, lastSeenAt: new Date() }, newDeviceBlocked: false, allowNewDevice: false },
        $inc: { resumeCount: 1, ...(opts.newSession ? { sessionCount: 1 } : {}) },
        $push: { events: event },
        ...(session.ip ? { $addToSet: { 'proctoring.ipAddresses': session.ip } } : {}),
      },
      { new: true }
    );
  },

  /** Marks the active session as alive; a changed IP on the same session is recorded and logged. */
  async touchSession(attemptId: string, ip: string | undefined, ipChangedEvent?: ITestAttemptEvent): Promise<void> {
    await TestAttempt.updateOne(
      { _id: attemptId },
      {
        $set: { 'activeSession.lastSeenAt': new Date(), ...(ip ? { 'activeSession.ip': ip } : {}) },
        ...(ip ? { $addToSet: { 'proctoring.ipAddresses': ip } } : {}),
        ...(ipChangedEvent ? { $push: { events: ipChangedEvent } } : {}),
      }
    );
  },

  async pushEvent(attemptId: string, event: ITestAttemptEvent, $set: Record<string, unknown> = {}): Promise<void> {
    await TestAttempt.updateOne({ _id: attemptId }, { $push: { events: event }, ...(Object.keys($set).length ? { $set } : {}) });
  },

  async markViewed(attemptId: string, questionIndex: number): Promise<void> {
    await TestAttempt.updateOne({ _id: attemptId }, { $addToSet: { viewedQuestionIndexes: questionIndex } });
  },

  /** Merges the given fields into the question's stored answer (creating it if missing) —
   *  merging, not replacing, so an autosave carrying only `code` doesn't wipe the chosen
   *  `language` or the last code submission. */
  async upsertAnswer(attemptId: string, answer: ITestAnswer): Promise<ITestAttempt | null> {
    const $set = Object.fromEntries(
      Object.entries(answer)
        .filter(([key, value]) => key !== 'questionIndex' && value !== undefined)
        .map(([key, value]) => [`answers.$.${key}`, value])
    );
    const res = Object.keys($set).length
      ? await TestAttempt.updateOne({ _id: attemptId, 'answers.questionIndex': answer.questionIndex }, { $set })
      : { matchedCount: await TestAttempt.countDocuments({ _id: attemptId, 'answers.questionIndex': answer.questionIndex }) };
    if (res.matchedCount === 0) {
      // The $ne guard keeps two racing first-saves from pushing duplicate entries.
      await TestAttempt.updateOne({ _id: attemptId, 'answers.questionIndex': { $ne: answer.questionIndex } }, { $push: { answers: answer } });
    }
    return TestAttempt.findById(attemptId);
  },

  async setSubmission(attemptId: string, questionIndex: number, submission: NonNullable<ITestAnswer['submission']>): Promise<void> {
    await TestAttempt.updateOne({ _id: attemptId, 'answers.questionIndex': questionIndex }, { $set: { 'answers.$.submission': submission } });
  },

  async pushViolation(attemptId: string, violation: ITestViolation, event: ITestAttemptEvent): Promise<ITestAttempt | null> {
    return TestAttempt.findByIdAndUpdate(
      attemptId,
      { $push: { violations: violation, events: event }, $set: { 'activeSession.lastSeenAt': new Date() } },
      { new: true }
    );
  },

  /** Ends the attempt. Guarded on `in_progress` so two racing submits (e.g. a violation
   *  auto-submit and the candidate's own click) can't both score it. */
  async submit(
    attemptId: string,
    data: { autoSubmitted: boolean; score?: number; questionResults?: ITestQuestionResult[]; terminationReason?: string; event?: ITestAttemptEvent }
  ): Promise<ITestAttempt | null> {
    return TestAttempt.findOneAndUpdate(
      { _id: attemptId, status: 'in_progress' },
      {
        $set: {
          status: 'submitted',
          submittedAt: new Date(),
          autoSubmitted: data.autoSubmitted,
          score: data.score,
          questionResults: data.questionResults,
          ...(data.terminationReason ? { terminationReason: data.terminationReason } : {}),
        },
        ...(data.event ? { $push: { events: data.event } } : {}),
      },
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
