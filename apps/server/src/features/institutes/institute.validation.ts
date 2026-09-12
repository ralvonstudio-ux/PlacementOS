import { z } from 'zod';

export const createInstituteSchema = z.object({
  name: z.string().min(1).max(150).trim(),
  code: z.string().min(1).max(20).trim().toUpperCase(),
  address: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
});

export const updateInstituteSchema = createInstituteSchema.partial();
