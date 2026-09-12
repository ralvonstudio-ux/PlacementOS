import mongoose, { Document, Schema } from 'mongoose';
import type { UserRole, UserStatus } from '@placementos/types';

export type { UserRole, UserStatus };

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  username?: string;
  phone?: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  tokenVersion: number;
  avatarUrl?: string;
  lastLoginAt?: Date;
  instituteId: string;
  deletedAt?: Date;
  createdBy?: string;
  updatedBy?: string;
  employeeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    phone: { type: String },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['admin', 'tpo', 'faculty'],
      required: true,
    },
    status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
    tokenVersion: { type: Number, default: 0 },
    avatarUrl: { type: String },
    lastLoginAt: { type: Date },
    instituteId: { type: String, required: true, index: true },
    deletedAt: { type: Date },
    createdBy: { type: String },
    updatedBy: { type: String },
    employeeId: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ username: 1 }, { unique: true, sparse: true });
userSchema.index({ instituteId: 1, status: 1 });
userSchema.index({ instituteId: 1, role: 1 });
userSchema.index({ instituteId: 1, employeeId: 1 }, { sparse: true });

export const User = mongoose.model<IUser>('User', userSchema);
