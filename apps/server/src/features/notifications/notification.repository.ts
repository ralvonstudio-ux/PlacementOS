import { Notification, INotification, NotificationType } from './notification.model';

export interface CreateNotificationInput {
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  relatedTestId?: string;
}

export const notificationRepository = {
  /** System-generated fan-out (e.g. one test opening for a whole batch) — not user input,
   *  so this bypasses any request-shaped validation layer. */
  async createForRecipients(instituteId: string, notifications: CreateNotificationInput[]): Promise<void> {
    if (notifications.length === 0) return;
    await Notification.insertMany(notifications.map((n) => ({ ...n, instituteId })));
  },

  async listForRecipient(instituteId: string, recipientId: string, limit = 50): Promise<INotification[]> {
    return Notification.find({ instituteId, recipientId }).sort({ createdAt: -1 }).limit(limit).lean<INotification[]>();
  },

  async countUnread(instituteId: string, recipientId: string): Promise<number> {
    return Notification.countDocuments({ instituteId, recipientId, readAt: { $exists: false } });
  },

  async markRead(id: string, instituteId: string, recipientId: string): Promise<INotification | null> {
    return Notification.findOneAndUpdate(
      { _id: id, instituteId, recipientId },
      { $set: { readAt: new Date() } },
      { new: true }
    );
  },

  async markAllRead(instituteId: string, recipientId: string): Promise<void> {
    await Notification.updateMany({ instituteId, recipientId, readAt: { $exists: false } }, { $set: { readAt: new Date() } });
  },
};
