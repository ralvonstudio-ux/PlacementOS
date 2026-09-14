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
    slotId: z.string().optional(),
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
    slotId: z.string().optional(),
  })
  .refine((data) => !data.startTime || !data.endTime || data.endTime > data.startTime, {
    message: 'endTime must be after startTime',
    path: ['endTime'],
  });

// ── Period slots ────────────────────────────────────────────────────────────
export const createPeriodSlotSchema = z.object({
  name: z.string().min(1).max(50).trim(),
  startTime: timeStr,
  endTime: timeStr,
  isBreak: z.boolean().optional(),
  daysApplicable: z.array(z.number().int().min(1).max(6)).optional(),
});

export const updatePeriodSlotSchema = createPeriodSlotSchema.partial();

export const reorderPeriodSlotsSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

// ── Master grid ─────────────────────────────────────────────────────────────
export const masterGridQuerySchema = z.object({
  placementYear: z.string().min(1).trim(),
  batch: z.string().trim().optional(),
});

export const setMasterGridCellSchema = z.object({
  batch: z.string().min(1).trim(),
  track: z.string().min(1).trim(),
  facultyId: z.string().min(1),
  dayOfWeek: z.number().int().min(1).max(6),
  slotId: z.string().min(1),
  placementYear: z.string().min(1).trim(),
  room: z.string().trim().optional(),
  entryId: z.string().optional(),
});

// ── Substitutes ─────────────────────────────────────────────────────────────
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const createSubstituteSchema = z.object({
  date: dateStr,
  entryId: z.string().min(1),
  reason: z.string().max(500).trim().optional(),
  substituteFacultyId: z.string().min(1).optional(),
});

export const updateSubstituteSchema = z.object({
  substituteFacultyId: z.string().min(1).optional(),
  status: z.enum(['pending', 'assigned', 'cancelled']).optional(),
  reason: z.string().max(500).trim().optional(),
});

export const listSubstitutesSchema = z.object({
  date: dateStr.optional(),
  status: z.enum(['pending', 'assigned', 'cancelled']).optional(),
  facultyId: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
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
