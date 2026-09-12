import { z } from 'zod';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const statusEnum = z.enum(['present', 'absent', 'late', 'excused']);

export const singleAttendanceSchema = z.object({
  candidateId: z.string().min(1),
  batch: z.string().min(1).trim(),
  track: z.string().min(1).trim(),
  date: dateStr,
  status: statusEnum,
  note: z.string().trim().max(500).optional(),
});

export const bulkAttendanceSchema = z.object({
  batch: z.string().min(1).trim(),
  track: z.string().min(1).trim(),
  date: dateStr,
  records: z
    .array(
      z.object({
        candidateId: z.string().min(1),
        status: statusEnum,
        note: z.string().trim().max(500).optional(),
      })
    )
    .min(1)
    .max(500),
});

export const updateAttendanceSchema = z.object({
  status: statusEnum.optional(),
  note: z.string().trim().max(500).optional(),
});

export const overviewSchema = z.object({
  date: dateStr.optional(),
});

export const listAttendanceSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  date: dateStr.optional(),
  dateFrom: dateStr.optional(),
  dateTo: dateStr.optional(),
  batch: z.string().trim().optional(),
  track: z.string().trim().optional(),
  status: statusEnum.optional(),
  candidateId: z.string().trim().optional(),
});

export const candidateHistorySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(400).optional(),
  dateFrom: dateStr.optional(),
  dateTo: dateStr.optional(),
  status: statusEnum.optional(),
});

export const batchAttendanceSchema = z.object({
  date: dateStr,
});

export const summarySchema = z.object({
  candidateId: z.string().trim().optional(),
  batch: z.string().trim().optional(),
  track: z.string().trim().optional(),
  dateFrom: dateStr.optional(),
  dateTo: dateStr.optional(),
});
