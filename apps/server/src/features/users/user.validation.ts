import { z } from 'zod';

export const createUserSchema = z.object({
  firstName: z.string().min(1).max(50).trim(),
  lastName: z.string().min(1).max(50).trim(),
  email: z.string().email().toLowerCase(),
  phone: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['admin', 'tpo', 'faculty']),
});

export const updateUserSchema = z
  .object({
    firstName: z.string().min(1).max(50).trim().optional(),
    lastName: z.string().min(1).max(50).trim().optional(),
    email: z.string().email().toLowerCase().optional(),
    phone: z.string().optional(),
    password: z.string().min(8).optional(),
    role: z.enum(['admin', 'tpo', 'faculty']).optional(),
    status: z.enum(['active', 'inactive', 'suspended']).optional(),
  })
  .strict();

export const statusChangeSchema = z.object({
  status: z.enum(['active', 'inactive', 'suspended']),
});

export const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  firstName: z.string().min(1).max(50).trim(),
  lastName: z.string().min(1).max(50).trim(),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['tpo', 'faculty']),
  instituteId: z.string().min(1, 'instituteId is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

/** Self-service profile edit — deliberately name-only (no email/role/status), unlike
 *  updateUserSchema which is the admin/TPO-only staff-management endpoint. */
export const updateMeSchema = z
  .object({
    firstName: z.string().min(1).max(50).trim().optional(),
    lastName: z.string().min(1).max(50).trim().optional(),
  })
  .strict();
