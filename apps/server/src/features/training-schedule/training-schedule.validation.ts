import { z } from 'zod';

const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:mm');

export const createTrainingScheduleSchema = z
  .object({
    batch: z.string().min(1).trim(),
    track: z.string().min(1).trim(),
    facultyId: z.string().min(1),
    dayOfWeek: z.number().int().min(1).max(6),
    startTime: timeStr,
    endTime: timeStr,
    room: z.string().trim().optional(),
    placementYear: z.string().min(1).trim(),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: 'endTime must be after startTime',
    path: ['endTime'],
  });

export const updateTrainingScheduleSchema = z
  .object({
    batch: z.string().min(1).trim().optional(),
    track: z.string().min(1).trim().optional(),
    facultyId: z.string().min(1).optional(),
    dayOfWeek: z.number().int().min(1).max(6).optional(),
    startTime: timeStr.optional(),
    endTime: timeStr.optional(),
    room: z.string().trim().optional(),
    placementYear: z.string().min(1).trim().optional(),
  })
  .refine((data) => !data.startTime || !data.endTime || data.endTime > data.startTime, {
    message: 'endTime must be after startTime',
    path: ['endTime'],
  });

export const listTrainingScheduleSchema = z.object({
  batch: z.string().trim().optional(),
  track: z.string().trim().optional(),
  facultyId: z.string().trim().optional(),
  dayOfWeek: z.coerce.number().int().min(1).max(6).optional(),
  placementYear: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
