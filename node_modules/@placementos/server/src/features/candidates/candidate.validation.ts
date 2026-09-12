import { z } from 'zod';

export const createCandidateSchema = z.object({
  fullName: z.string().min(1).max(100).trim(),
  rollNumber: z.string().min(1).trim(),
  batch: z.string().min(1).trim(),
  department: z.string().min(1).trim(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  placementYear: z.string().min(1).trim(),
  status: z.enum(['active', 'inactive', 'placed']).optional(),
});

export const updateCandidateSchema = createCandidateSchema.partial();

export const createLoginSchema = z.object({
  loginEmail: z.string().email('Enter a valid email address').toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const listCandidateSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  search: z.string().trim().optional(),
  batch: z.string().trim().optional(),
  department: z.string().trim().optional(),
  placementYear: z.string().trim().optional(),
  status: z.enum(['active', 'inactive', 'placed']).optional(),
});
