import mongoose, { Document, Schema } from 'mongoose';

export type NotificationType = 'test_access_code';

export interface INotification extends Document {
  instituteId: string;
  /** Candidate id (see candidate.model) — the only recipient kind this supports today. */
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  relatedTestId?: string;
  readAt?: Date;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    instituteId: { type: String, required: true, index: true },
    recipientId: { type: String, required: true },
    type: { type: String, enum: ['test_access_code'], required: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    relatedTestId: { type: String },
    readAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

notificationSchema.index({ instituteId: 1, recipientId: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
