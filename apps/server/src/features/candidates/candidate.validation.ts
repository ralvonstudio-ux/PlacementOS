import { z } from 'zod';

// CSV imports hand every cell over as a string, and a blank cell means "not provided".
const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess((v) => (v === '' || v === null || v === undefined ? undefined : Number(v)), schema.optional());

export const createCandidateSchema = z.object({
  fullName: z.string().min(1).max(100).trim(),
  rollNumber: z.string().min(1).trim(),
  batch: z.string().min(1).trim(),
  department: z.string().min(1).trim(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  placementYear: z.string().min(1).trim(),
  status: z.enum(['active', 'inactive', 'placed']).optional(),
  cgpa: optionalNumber(z.number({ invalid_type_error: 'CGPA must be a number' }).min(0).max(10)),
  activeBacklogs: optionalNumber(z.number({ invalid_type_error: 'Backlogs must be a number' }).int().min(0)),
});

export const updateCandidateSchema = createCandidateSchema.partial();

/** Faculty-scoped update — only the note, never roll number/department/etc. which stay
 *  admin/TPO-only via updateCandidateSchema. */
export const updateFacultyNoteSchema = z.object({
  facultyNote: z.string().max(2000).trim().optional().default(''),
});

export const createLoginSchema = z.object({
  loginEmail: z.string().email('Enter a valid email address').toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const bulkCreateLoginsSchema = z.object({
  candidateIds: z.array(z.string().min(1)).max(500).optional(),
  batch: z.string().trim().min(1).optional(),
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
