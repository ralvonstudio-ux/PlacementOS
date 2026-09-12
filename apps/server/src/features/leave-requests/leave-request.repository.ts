import { LeaveRequest, ILeaveRequest } from './leave-request.model';

interface CreateInput {
  instituteId: string;
  facultyId: string;
  requestedByUserId: string;
  fromDate: string;
  toDate: string;
  reason: string;
}

export const leaveRequestRepository = {
  async create(data: CreateInput): Promise<ILeaveRequest> {
    return LeaveRequest.create(data);
  },

  async findMine(instituteId: string, facultyId: string): Promise<ILeaveRequest[]> {
    return LeaveRequest.find({ instituteId, facultyId }).sort({ createdAt: -1 }).limit(50).lean<ILeaveRequest[]>();
  },

  async findPending(instituteId: string): Promise<ILeaveRequest[]> {
    return LeaveRequest.find({ instituteId, status: 'pending' }).sort({ createdAt: -1 }).limit(200).lean<ILeaveRequest[]>();
  },

  /** Approved leave requests whose date range covers the given date — backs "faculty on leave today". */
  async findApprovedForDate(instituteId: string, date: string): Promise<ILeaveRequest[]> {
    return LeaveRequest.find({
      instituteId,
      status: 'approved',
      fromDate: { $lte: date },
      toDate: { $gte: date },
    }).lean<ILeaveRequest[]>();
  },

  async findById(id: string, instituteId: string): Promise<ILeaveRequest | null> {
    return LeaveRequest.findOne({ _id: id, instituteId });
  },

  async markApproved(id: string, reviewedBy: string): Promise<ILeaveRequest | null> {
    return LeaveRequest.findByIdAndUpdate(
      id,
      { $set: { status: 'approved', reviewedBy, reviewedAt: new Date() } },
      { new: true }
    ).lean<ILeaveRequest>();
  },

  async markRejected(id: string, reviewedBy: string, reviewNote?: string): Promise<ILeaveRequest | null> {
    return LeaveRequest.findByIdAndUpdate(
      id,
      { $set: { status: 'rejected', reviewedBy, reviewNote, reviewedAt: new Date() } },
      { new: true }
    ).lean<ILeaveRequest>();
  },

  async markCancelled(id: string): Promise<ILeaveRequest | null> {
    return LeaveRequest.findByIdAndUpdate(id, { $set: { status: 'cancelled' } }, { new: true }).lean<ILeaveRequest>();
  },
};
