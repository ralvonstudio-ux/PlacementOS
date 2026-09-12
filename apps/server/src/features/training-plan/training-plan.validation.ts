import { z } from 'zod';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const generateTrainingPlanSchema = z.object({
  batch: z.string().min(1).trim(),
  track: z.string().min(1).trim(),
});

export const getWeekPlanSchema = z.object({
  batch: z.string().min(1).trim(),
  track: z.string().min(1).trim(),
  weekStartDate: dateStr.optional(),
  facultyId: z.string().trim().optional(),
});

export const getMonthPlanSchema = z.object({
  batch: z.string().min(1).trim(),
  track: z.string().min(1).trim(),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Expected YYYY-MM'),
  facultyId: z.string().trim().optional(),
});

export const setDayStatusSchema = z.object({
  date: dateStr,
  status: z.enum(['planned', 'in_progress', 'completed', 'skipped']),
});

export const editDaySchema = z.object({
  date: dateStr,
  moduleId: z.string().optional(),
  moduleName: z.string().trim().optional(),
  title: z.string().trim().max(200).optional(),
  blockType: z.enum(['module', 'assessment', 'event', 'holiday', 'other']).optional(),
});

export const moveDaySchema = z
  .object({
    fromDate: dateStr,
    toDate: dateStr,
  })
  .refine((data) => data.fromDate !== data.toDate, { message: 'fromDate and toDate must differ', path: ['toDate'] });
