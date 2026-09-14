import { notificationRepository } from './notification.repository';
import { INotification } from './notification.model';
import { NotFoundError } from '../../middlewares/errorHandler';
import { AuthContext } from '../../lib/auth-context';
import { resolveCandidateId } from '../candidates/candidate.service';
import type { Notification as NotificationApiShape } from '@placementos/types';

const toApiShape = (n: INotification): NotificationApiShape => ({
  _id: String((n as unknown as { _id: { toString(): string } })._id),
  type: n.type,
  title: n.title,
  body: n.body,
  relatedTestId: n.relatedTestId,
  readAt: n.readAt ? new Date(n.readAt).toISOString() : undefined,
  createdAt: new Date(n.createdAt).toISOString(),
});

export const notificationService = {
  async listMine(ctx: AuthContext): Promise<{ notifications: NotificationApiShape[]; unreadCount: number }> {
    const candidateId = await resolveCandidateId(ctx);
    const [notifications, unreadCount] = await Promise.all([
      notificationRepository.listForRecipient(ctx.instituteId, candidateId),
      notificationRepository.countUnread(ctx.instituteId, candidateId),
    ]);
    return { notifications: notifications.map(toApiShape), unreadCount };
  },

  async markRead(id: string, ctx: AuthContext): Promise<NotificationApiShape> {
    const candidateId = await resolveCandidateId(ctx);
    const updated = await notificationRepository.markRead(id, ctx.instituteId, candidateId);
    if (!updated) throw new NotFoundError('Notification');
    return toApiShape(updated);
  },

  async markAllRead(ctx: AuthContext): Promise<void> {
    const candidateId = await resolveCandidateId(ctx);
    await notificationRepository.markAllRead(ctx.instituteId, candidateId);
  },
};
