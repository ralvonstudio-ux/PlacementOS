import { z } from 'zod';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const createLeaveRequestSchema = z
  .object({
    fromDate: dateStr,
    toDate: dateStr,
    reason: z.string().min(1, 'Reason is required').max(500).trim(),
  })
  .refine((data) => data.toDate >= data.fromDate, {
    message: 'toDate must be on or after fromDate',
    path: ['toDate'],
  });

export const rejectLeaveRequestSchema = z.object({
  reviewNote: z.string().max(300).trim().optional(),
});

export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;
export type RejectLeaveRequestInput = z.infer<typeof rejectLeaveRequestSchema>;
