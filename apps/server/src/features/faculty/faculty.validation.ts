import { z } from 'zod';

export const createFacultySchema = z.object({
  fullName: z.string().min(1).max(100).trim(),
  gender: z.enum(['male', 'female', 'other']),
  dateOfBirth: z.string().optional(),
  employeeId: z.string().min(1).trim(),
  phone: z.string().min(1).trim(),
  alternatePhone: z.string().optional(),
  email: z.string().email().optional(),
  department: z.string().optional(),
  tracks: z.array(z.string()).optional(),
  assignedBatches: z.array(z.string()).optional(),
  experienceYears: z.number().min(0).optional(),
  joiningDate: z.string().optional(),
  remarks: z.string().optional(),
});

export const updateFacultySchema = createFacultySchema.partial();

export const changeStatusSchema = z.object({
  employmentStatus: z.enum(['applicant', 'active', 'on_leave', 'suspended', 'resigned', 'retired', 'inactive']),
});

export const createLoginSchema = z.object({
  loginEmail: z.string().email('Enter a valid email address').toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
