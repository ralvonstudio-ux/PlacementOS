import { z } from 'zod';

export const sendStaffMessageSchema = z.object({
  candidateIds: z.array(z.string().min(1)).min(1, 'Select at least one recipient'),
  title: z.string().trim().min(1, 'Title is required').max(200),
  body: z.string().trim().min(1, 'Message is required').max(2000),
});

export type SendStaffMessageInput = z.infer<typeof sendStaffMessageSchema>;
