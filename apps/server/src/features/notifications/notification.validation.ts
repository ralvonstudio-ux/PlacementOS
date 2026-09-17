import { z } from 'zod';

export const sendStaffMessageSchema = z
  .object({
    candidateIds: z.array(z.string().min(1)).default([]),
    facultyIds: z.array(z.string().min(1)).default([]),
    title: z.string().trim().min(1, 'Title is required').max(200),
    body: z.string().trim().min(1, 'Message is required').max(2000),
    priority: z.enum(['normal', 'high']).default('normal'),
  })
  .refine((v) => v.candidateIds.length > 0 || v.facultyIds.length > 0, {
    message: 'Select at least one recipient',
    path: ['candidateIds'],
  });

export type SendStaffMessageInput = z.infer<typeof sendStaffMessageSchema>;
