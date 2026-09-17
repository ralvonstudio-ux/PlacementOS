import mongoose, { Document, Schema } from 'mongoose';

export type NotificationType = 'test_access_code' | 'staff_message';
export type NotificationRecipientRole = 'candidate' | 'faculty';
export type NotificationPriority = 'normal' | 'high';

export interface INotification extends Document {
  instituteId: string;
  /** Candidate id or Faculty id, depending on `recipientRole`. */
  recipientId: string;
  recipientRole: NotificationRecipientRole;
  type: NotificationType;
  title: string;
  body: string;
  relatedTestId?: string;
  priority: NotificationPriority;
  /** Shared across every recipient of one "Send Message" action — lets the sender see
   *  aggregate acknowledgment ("12/20 acknowledged") and drill into who has/hasn't. */
  broadcastId?: string;
  readAt?: Date;
  /** 'high' priority notifications force a blocking overlay until this is set —
   *  distinct from `readAt`, which a candidate/faculty member can get just by opening
   *  the list. Unset for 'normal' priority notifications (never required). */
  acknowledgedAt?: Date;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    instituteId: { type: String, required: true, index: true },
    recipientId: { type: String, required: true },
    recipientRole: { type: String, enum: ['candidate', 'faculty'], required: true, default: 'candidate' },
    type: { type: String, enum: ['test_access_code', 'staff_message'], required: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    relatedTestId: { type: String },
    priority: { type: String, enum: ['normal', 'high'], required: true, default: 'normal' },
    broadcastId: { type: String, index: true },
    readAt: { type: Date },
    acknowledgedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

notificationSchema.index({ instituteId: 1, recipientRole: 1, recipientId: 1, createdAt: -1 });
notificationSchema.index({ instituteId: 1, broadcastId: 1 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
