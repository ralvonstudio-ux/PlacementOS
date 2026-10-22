import { z } from 'zod';

const ratingScore = z.number().min(1).max(5);

export const createTrainerFeedbackSchema = z.object({
  facultyId: z.string().min(1, 'facultyId is required'),
  track: z.string().min(1, 'track is required').trim(),
  isAnonymous: z.boolean(),
  ratings: z.object({
    subjectKnowledge: ratingScore,
    teachingQuality: ratingScore,
    communication: ratingScore,
    punctuality: ratingScore,
  }),
  comment: z.string().max(500).trim().optional(),
});

export const trainerFeedbackListFiltersSchema = z.object({
  facultyId: z.string().optional(),
  batch: z.string().optional(),
  track: z.string().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD').optional(),
});

export type CreateTrainerFeedbackInput = z.infer<typeof createTrainerFeedbackSchema>;
export type TrainerFeedbackListFiltersInput = z.infer<typeof trainerFeedbackListFiltersSchema>;
