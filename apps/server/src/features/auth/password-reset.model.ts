import mongoose, { Document, Schema } from 'mongoose';

/** One live "forgot password" code per user. Only a hash of the code is stored; the document
 *  expires on its own (TTL index) a little after the code stops being valid. */
export interface IPasswordReset extends Document {
  userId: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  lastSentAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const passwordResetSchema = new Schema<IPasswordReset>(
  {
    userId: { type: String, required: true, unique: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false }
);

// Mongo removes the document once expiresAt has passed (checked roughly every minute).
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordReset = mongoose.model<IPasswordReset>('PasswordReset', passwordResetSchema);
