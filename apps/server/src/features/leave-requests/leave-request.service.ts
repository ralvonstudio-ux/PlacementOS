import { leaveRequestRepository } from './leave-request.repository';
import { User } from '../users/user.model';
import { Faculty, IFaculty } from '../faculty/faculty.model';
import { ForbiddenError, NotFoundError, ValidationError } from '../../middlewares/errorHandler';
import { AuthContext } from '../../lib/auth-context';
import { createLeaveRequestSchema, rejectLeaveRequestSchema } from './leave-request.validation';
import type { ILeaveRequest } from './leave-request.model';
import type { LeaveRequest as LeaveRequestApiShape } from '@placementos/types';

/** Resolves the Faculty profile linked to the logged-in user's account, by loginEmail. */
async function resolveFaculty(ctx: AuthContext): Promise<IFaculty & { _id: { toString(): string } }> {
  const user = (await User.findById(ctx.userId).select('email').lean()) as { email?: string } | null;
  if (!user?.email) throw new ForbiddenError('Your user account has no email — cannot link to a faculty profile');

  const faculty = (await Faculty.findOne({ instituteId: ctx.instituteId, loginEmail: user.email, isDeleted: false }).lean()) as unknown as
    | (IFaculty & { _id: { toString(): string } })
    | null;
  if (!faculty) throw new NotFoundError('Faculty profile not found. Ask your administrator to set your login email on the faculty record.');

  return faculty;
}

const toApiShape = (req: ILeaveRequest, facultyName?: string): LeaveRequestApiShape => ({
  _id: String((req as unknown as { _id: { toString(): string } })._id),
  instituteId: req.instituteId,
  facultyId: req.facultyId,
  fromDate: req.fromDate,
  toDate: req.toDate,
  reason: req.reason,
  status: req.status,
  reviewedBy: req.reviewedBy,
  reviewedAt: req.reviewedAt ? new Date(req.reviewedAt).toISOString() : undefined,
  reviewNote: req.reviewNote,
  createdAt: new Date(req.createdAt).toISOString(),
  updatedAt: new Date(req.updatedAt).toISOString(),
  facultyName,
});

async function withFacultyNames(instituteId: string, requests: ILeaveRequest[]): Promise<LeaveRequestApiShape[]> {
  const facultyIds = [...new Set(requests.map((r) => r.facultyId))];
  const faculty = facultyIds.length
    ? await Faculty.find({ _id: { $in: facultyIds }, instituteId }).select('fullName').lean<{ _id: unknown; fullName: string }[]>()
    : [];
  const nameById = new Map(faculty.map((f) => [String(f._id), f.fullName]));
  return requests.map((r) => toApiShape(r, nameById.get(r.facultyId)));
}

export const leaveRequestService = {
  async create(rawInput: unknown, ctx: AuthContext): Promise<LeaveRequestApiShape> {
    const input = createLeaveRequestSchema.parse(rawInput);
    const faculty = await resolveFaculty(ctx);

    const request = await leaveRequestRepository.create({
      instituteId: ctx.instituteId,
      facultyId: String(faculty._id),
      requestedByUserId: ctx.userId,
      fromDate: input.fromDate,
      toDate: input.toDate,
      reason: input.reason,
    });

    return toApiShape(request, faculty.fullName);
  },

  async getById(id: string, ctx: AuthContext): Promise<LeaveRequestApiShape> {
    const request = await leaveRequestRepository.findById(id, ctx.instituteId);
    if (!request) throw new NotFoundError('Leave request');

    const canReview = ctx.role === 'admin' || ctx.role === 'tpo';
    if (!canReview && request.requestedByUserId !== ctx.userId) {
      throw new ForbiddenError('You can only view your own leave requests');
    }

    const [result] = await withFacultyNames(ctx.instituteId, [request]);
    return result;
  },

  async listMine(ctx: AuthContext): Promise<LeaveRequestApiShape[]> {
    const faculty = await resolveFaculty(ctx);
    const requests = await leaveRequestRepository.findMine(ctx.instituteId, String(faculty._id));
    return requests.map((r) => toApiShape(r, faculty.fullName));
  },

  async listPending(ctx: AuthContext): Promise<LeaveRequestApiShape[]> {
    const requests = await leaveRequestRepository.findPending(ctx.instituteId);
    return withFacultyNames(ctx.instituteId, requests);
  },

  async approve(id: string, ctx: AuthContext): Promise<LeaveRequestApiShape> {
    const request = await leaveRequestRepository.findById(id, ctx.instituteId);
    if (!request) throw new NotFoundError('Leave request');
    if (request.status !== 'pending') throw new ValidationError('This request has already been reviewed.');

    const updated = await leaveRequestRepository.markApproved(id, ctx.userId);
    if (!updated) throw new NotFoundError('Leave request');

    const [result] = await withFacultyNames(ctx.instituteId, [updated]);
    return result;
  },

  async reject(id: string, rawInput: unknown, ctx: AuthContext): Promise<LeaveRequestApiShape> {
    const { reviewNote } = rejectLeaveRequestSchema.parse(rawInput);

    const request = await leaveRequestRepository.findById(id, ctx.instituteId);
    if (!request) throw new NotFoundError('Leave request');
    if (request.status !== 'pending') throw new ValidationError('This request has already been reviewed.');

    const updated = await leaveRequestRepository.markRejected(id, ctx.userId, reviewNote);
    if (!updated) throw new NotFoundError('Leave request');

    const [result] = await withFacultyNames(ctx.instituteId, [updated]);
    return result;
  },

  async cancel(id: string, ctx: AuthContext): Promise<LeaveRequestApiShape> {
    const request = await leaveRequestRepository.findById(id, ctx.instituteId);
    if (!request) throw new NotFoundError('Leave request');
    if (request.requestedByUserId !== ctx.userId) throw new ForbiddenError('You can only cancel your own leave requests');
    if (request.status !== 'pending') throw new ValidationError('Only a pending request can be cancelled.');

    const updated = await leaveRequestRepository.markCancelled(id);
    if (!updated) throw new NotFoundError('Leave request');

    const [result] = await withFacultyNames(ctx.instituteId, [updated]);
    return result;
  },
};
