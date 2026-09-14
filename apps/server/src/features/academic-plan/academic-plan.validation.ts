import { z } from 'zod';

export const generateAcademicPlanSchema = z.object({
  batch: z.string({ required_error: 'batch is required' }).min(1).trim(),
  track: z.string({ required_error: 'track is required' }).min(1).trim(),
  title: z.string().trim().max(150).optional(),
  syllabusText: z.string({ required_error: 'syllabusText is required' }).trim().min(20, 'Paste or upload more of the syllabus — that looks too short to plan from.'),
  totalLectures: z.number().int().min(1).max(300),
  totalWeeks: z.number().int().min(1).max(52),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD').optional(),
});

export const getAcademicPlanSchema = z.object({
  batch: z.string().min(1).trim(),
  track: z.string().min(1).trim(),
  facultyId: z.string().optional(),
});

const sessionUpdateSchema = z.object({
  lectureNumber: z.number().int().min(1),
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  week: z.number().int().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['planned', 'completed', 'skipped']).optional(),
});

export const editSessionSchema = sessionUpdateSchema;

export const reorderSessionsSchema = z.object({
  sessions: z.array(z.object({ lectureNumber: z.number().int().min(1), week: z.number().int().min(1), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).min(1),
});

export const addSessionSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  week: z.number().int().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type GenerateAcademicPlanInput = z.infer<typeof generateAcademicPlanSchema>;
export type GetAcademicPlanInput = z.infer<typeof getAcademicPlanSchema>;
export type EditSessionInput = z.infer<typeof editSessionSchema>;
export type ReorderSessionsInput = z.infer<typeof reorderSessionsSchema>;
export type AddSessionInput = z.infer<typeof addSessionSchema>;
