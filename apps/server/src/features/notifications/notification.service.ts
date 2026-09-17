import crypto from 'crypto';
import { notificationRepository } from './notification.repository';
import { sendStaffMessageSchema } from './notification.validation';
import { INotification, NotificationRecipientRole } from './notification.model';
import { NotFoundError, ValidationError } from '../../middlewares/errorHandler';
import { AuthContext } from '../../lib/auth-context';
import { resolveCandidateId } from '../candidates/candidate.service';
import { candidateRepository } from '../candidates/candidate.repository';
import { facultyRepository } from '../faculty/faculty.repository';
import { resolveFacultyId } from '../training-schedule/training-schedule.service';
import type { Notification as NotificationApiShape, NotificationBroadcastSummary, NotificationBroadcastRecipient } from '@placementos/types';

const toApiShape = (n: INotification): NotificationApiShape => ({
  _id: String((n as unknown as { _id: { toString(): string } })._id),
  type: n.type,
  title: n.title,
  body: n.body,
  relatedTestId: n.relatedTestId,
  priority: n.priority,
  broadcastId: n.broadcastId,
  readAt: n.readAt ? new Date(n.readAt).toISOString() : undefined,
  acknowledgedAt: n.acknowledgedAt ? new Date(n.acknowledgedAt).toISOString() : undefined,
  createdAt: new Date(n.createdAt).toISOString(),
});

/** A candidate and a faculty member reach this identically — resolve whichever the
 *  logged-in role actually is, once, for every recipient-scoped method below. */
async function resolveMyRecipient(ctx: AuthContext): Promise<{ role: NotificationRecipientRole; id: string }> {
  if (ctx.role === 'faculty') return { role: 'faculty', id: await resolveFacultyId(ctx) };
  return { role: 'candidate', id: await resolveCandidateId(ctx) };
}

export const notificationService = {
  async listMine(ctx: AuthContext): Promise<{ notifications: NotificationApiShape[]; unreadCount: number }> {
    const { role, id } = await resolveMyRecipient(ctx);
    const [notifications, unreadCount] = await Promise.all([
      notificationRepository.listForRecipient(ctx.instituteId, role, id),
      notificationRepository.countUnread(ctx.instituteId, role, id),
    ]);
    return { notifications: notifications.map(toApiShape), unreadCount };
  },

  /** Every 'high' priority notification still awaiting acknowledgment — what the
   *  blocking, blurred overlay polls for and renders. */
  async listUnacknowledged(ctx: AuthContext): Promise<NotificationApiShape[]> {
    const { role, id } = await resolveMyRecipient(ctx);
    const notifications = await notificationRepository.listUnacknowledged(ctx.instituteId, role, id);
    return notifications.map(toApiShape);
  },

  async markRead(id: string, ctx: AuthContext): Promise<NotificationApiShape> {
    const { role, id: recipientId } = await resolveMyRecipient(ctx);
    const updated = await notificationRepository.markRead(id, ctx.instituteId, role, recipientId);
    if (!updated) throw new NotFoundError('Notification');
    return toApiShape(updated);
  },

  async markAllRead(ctx: AuthContext): Promise<void> {
    const { role, id } = await resolveMyRecipient(ctx);
    await notificationRepository.markAllRead(ctx.instituteId, role, id);
  },

  /** The action a 'high' priority notification forces before its overlay will clear. */
  async acknowledge(id: string, ctx: AuthContext): Promise<NotificationApiShape> {
    const { role, id: recipientId } = await resolveMyRecipient(ctx);
    const updated = await notificationRepository.acknowledge(id, ctx.instituteId, role, recipientId);
    if (!updated) throw new NotFoundError('Notification');
    return toApiShape(updated);
  },

  // ── Staff-facing (admin/tpo/faculty) ────────────────────────────────────────

  /** Staff-composed, one-way announcement to a chosen set of candidates and/or faculty —
   *  the general-purpose counterpart to `testService.sendAccessCode`, for anything that
   *  isn't a test access code. Every recipient shares one broadcastId so the sender can
   *  later see "X/Y acknowledged" and drill into who has. */
  async sendStaffMessage(rawInput: unknown, ctx: AuthContext): Promise<{ sentCount: number }> {
    const { candidateIds, facultyIds, title, body, priority } = sendStaffMessageSchema.parse(rawInput);

    const [candidates, faculty] = await Promise.all([
      candidateIds.length > 0 ? candidateRepository.findAllForSchoolByIds(candidateIds, ctx.instituteId) : Promise.resolve([]),
      facultyIds.length > 0 ? facultyRepository.findAllForSchoolByIds(facultyIds, ctx.instituteId) : Promise.resolve([]),
    ]);
    if (candidates.length === 0 && faculty.length === 0) throw new ValidationError('None of the selected recipients could be found');

    const broadcastId = crypto.randomUUID();
    await notificationRepository.createForRecipients(ctx.instituteId, [
      ...candidates.map((c) => ({
        recipientId: String((c as unknown as { _id: { toString(): string } })._id),
        recipientRole: 'candidate' as const,
        type: 'staff_message' as const,
        title,
        body,
        priority,
        broadcastId,
      })),
      ...faculty.map((f) => ({
        recipientId: String((f as unknown as { _id: { toString(): string } })._id),
        recipientRole: 'faculty' as const,
        type: 'staff_message' as const,
        title,
        body,
        priority,
        broadcastId,
      })),
    ]);
    return { sentCount: candidates.length + faculty.length };
  },

  /** Staff-facing — every broadcast this institute has sent, with an acknowledgment count. */
  async listBroadcasts(ctx: AuthContext): Promise<NotificationBroadcastSummary[]> {
    const rows = await notificationRepository.findBroadcastSummaries(ctx.instituteId);
    return rows.map((r) => ({
      broadcastId: r.broadcastId,
      title: r.title,
      body: r.body,
      priority: r.priority,
      audience: r.audience,
      recipientCount: r.recipientCount,
      acknowledgedCount: r.acknowledgedCount,
      createdAt: new Date(r.createdAt).toISOString(),
    }));
  },

  /** Staff-facing drill-down — who a broadcast went to, and whether/when each acknowledged. */
  async getBroadcastRecipients(broadcastId: string, ctx: AuthContext): Promise<NotificationBroadcastRecipient[]> {
    const rows = await notificationRepository.findByBroadcastId(ctx.instituteId, broadcastId);
    if (rows.length === 0) throw new NotFoundError('Broadcast');

    const candidateIds = rows.filter((r) => r.recipientRole === 'candidate').map((r) => r.recipientId);
    const facultyIds = rows.filter((r) => r.recipientRole === 'faculty').map((r) => r.recipientId);
    const [candidates, faculty] = await Promise.all([
      candidateRepository.findAllForSchoolByIds(candidateIds, ctx.instituteId),
      facultyRepository.findAllForSchoolByIds(facultyIds, ctx.instituteId),
    ]);
    const nameById = new Map<string, string>();
    for (const c of candidates) nameById.set(String((c as unknown as { _id: { toString(): string } })._id), c.fullName);
    for (const f of faculty) nameById.set(String((f as unknown as { _id: { toString(): string } })._id), f.fullName);

    return rows
      .map((r) => ({
        recipientId: r.recipientId,
        recipientRole: r.recipientRole,
        name: nameById.get(r.recipientId) ?? 'Unknown',
        acknowledgedAt: r.acknowledgedAt ? new Date(r.acknowledgedAt).toISOString() : undefined,
        readAt: r.readAt ? new Date(r.readAt).toISOString() : undefined,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
};
