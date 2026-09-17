import { Notification, INotification, NotificationType, NotificationRecipientRole, NotificationPriority } from './notification.model';

export interface CreateNotificationInput {
  recipientId: string;
  recipientRole: NotificationRecipientRole;
  type: NotificationType;
  title: string;
  body: string;
  relatedTestId?: string;
  priority?: NotificationPriority;
  broadcastId?: string;
}

export interface BroadcastSummaryRow {
  broadcastId: string;
  title: string;
  body: string;
  priority: NotificationPriority;
  audience: NotificationRecipientRole[];
  recipientCount: number;
  acknowledgedCount: number;
  createdAt: Date;
}

export const notificationRepository = {
  /** System-generated fan-out (e.g. one test opening for a whole batch) — not user input,
   *  so this bypasses any request-shaped validation layer. */
  async createForRecipients(instituteId: string, notifications: CreateNotificationInput[]): Promise<void> {
    if (notifications.length === 0) return;
    await Notification.insertMany(notifications.map((n) => ({ ...n, instituteId })));
  },

  async listForRecipient(instituteId: string, recipientRole: NotificationRecipientRole, recipientId: string, limit = 50): Promise<INotification[]> {
    return Notification.find({ instituteId, recipientRole, recipientId }).sort({ createdAt: -1 }).limit(limit).lean<INotification[]>();
  },

  async countUnread(instituteId: string, recipientRole: NotificationRecipientRole, recipientId: string): Promise<number> {
    return Notification.countDocuments({ instituteId, recipientRole, recipientId, readAt: { $exists: false } });
  },

  async markRead(id: string, instituteId: string, recipientRole: NotificationRecipientRole, recipientId: string): Promise<INotification | null> {
    return Notification.findOneAndUpdate(
      { _id: id, instituteId, recipientRole, recipientId },
      { $set: { readAt: new Date() } },
      { new: true }
    );
  },

  async markAllRead(instituteId: string, recipientRole: NotificationRecipientRole, recipientId: string): Promise<void> {
    await Notification.updateMany({ instituteId, recipientRole, recipientId, readAt: { $exists: false } }, { $set: { readAt: new Date() } });
  },

  async acknowledge(id: string, instituteId: string, recipientRole: NotificationRecipientRole, recipientId: string): Promise<INotification | null> {
    return Notification.findOneAndUpdate(
      { _id: id, instituteId, recipientRole, recipientId },
      { $set: { readAt: new Date(), acknowledgedAt: new Date() } },
      { new: true }
    );
  },

  /** Every 'high' priority notification for this recipient that's still unacknowledged —
   *  what the blocking overlay renders. Oldest first, so they clear them in the order sent. */
  async listUnacknowledged(instituteId: string, recipientRole: NotificationRecipientRole, recipientId: string): Promise<INotification[]> {
    return Notification.find({ instituteId, recipientRole, recipientId, priority: 'high', acknowledgedAt: { $exists: false } })
      .sort({ createdAt: 1 })
      .lean<INotification[]>();
  },

  /** Staff-facing — one row per broadcastId this institute has sent, newest first. */
  async findBroadcastSummaries(instituteId: string, limit = 30): Promise<BroadcastSummaryRow[]> {
    const rows = await Notification.aggregate([
      { $match: { instituteId, broadcastId: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$broadcastId',
          title: { $first: '$title' },
          body: { $first: '$body' },
          priority: { $first: '$priority' },
          audience: { $addToSet: '$recipientRole' },
          recipientCount: { $sum: 1 },
          acknowledgedCount: { $sum: { $cond: [{ $ifNull: ['$acknowledgedAt', false] }, 1, 0] } },
          createdAt: { $min: '$createdAt' },
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: limit },
    ]);
    return rows.map((r) => ({
      broadcastId: r._id,
      title: r.title,
      body: r.body,
      priority: r.priority,
      audience: r.audience,
      recipientCount: r.recipientCount,
      acknowledgedCount: r.acknowledgedCount,
      createdAt: r.createdAt,
    }));
  },

  async findByBroadcastId(instituteId: string, broadcastId: string): Promise<INotification[]> {
    return Notification.find({ instituteId, broadcastId }).lean<INotification[]>();
  },
};
