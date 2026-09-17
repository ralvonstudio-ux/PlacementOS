import { TestAssignment, ITestAssignment } from './test.model';
import { CreateAssignmentInput } from './test.validation';

export const testAssignmentRepository = {
  async create(instituteId: string, testId: string, createdBy: string, data: CreateAssignmentInput): Promise<ITestAssignment> {
    return TestAssignment.create({ ...data, instituteId, testId, createdBy, status: 'active' });
  },

  async findById(id: string, instituteId: string): Promise<ITestAssignment | null> {
    return TestAssignment.findOne({ _id: id, instituteId });
  },

  /** Every assignment ever created for one paper — newest first. */
  async findByTest(testId: string, instituteId: string): Promise<ITestAssignment[]> {
    return TestAssignment.find({ testId, instituteId }).sort({ createdAt: -1 }).lean<ITestAssignment[]>();
  },

  /** Active assignments a given candidate can see — targeted at their batch, or at them by name. */
  async findActiveFor(instituteId: string, candidateId: string, batch: string): Promise<ITestAssignment[]> {
    return TestAssignment.find({
      instituteId,
      status: 'active',
      $or: [
        { targetType: 'batch', batch },
        { targetType: 'candidates', candidateIds: candidateId },
      ],
    })
      .sort({ createdAt: -1 })
      .lean<ITestAssignment[]>();
  },

  /** Every active assignment across every paper — backs the Messages "send access code" picker. */
  async findAllActive(instituteId: string): Promise<ITestAssignment[]> {
    return TestAssignment.find({ instituteId, status: 'active' }).sort({ createdAt: -1 }).lean<ITestAssignment[]>();
  },

  async setAccessCode(id: string, instituteId: string, accessCodeHash: string): Promise<ITestAssignment | null> {
    return TestAssignment.findOneAndUpdate(
      { _id: id, instituteId },
      { $set: { accessCodeHash, accessCodeIssuedAt: new Date() } },
      { new: true }
    );
  },

  async close(id: string, instituteId: string): Promise<ITestAssignment | null> {
    return TestAssignment.findOneAndUpdate({ _id: id, instituteId }, { $set: { status: 'closed' } }, { new: true });
  },
};
