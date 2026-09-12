import { z } from 'zod';

export const createTrainingModuleSchema = z.object({
  track: z.string().min(1).trim(),
  name: z.string().min(1).trim(),
  description: z.string().trim().max(1000).optional(),
  order: z.number().int().min(0).optional(),
  estimatedPeriods: z.number().int().min(1).optional(),
});

export const updateTrainingModuleSchema = z.object({
  track: z.string().min(1).trim().optional(),
  name: z.string().min(1).trim().optional(),
  description: z.string().trim().max(1000).optional(),
  order: z.number().int().min(0).optional(),
  estimatedPeriods: z.number().int().min(1).optional(),
});

export const listTrainingModuleSchema = z.object({
  track: z.string().trim().optional(),
});

export const setModuleProgressSchema = z.object({
  batch: z.string().min(1).trim(),
  track: z.string().min(1).trim(),
  status: z.enum(['not_started', 'in_progress', 'completed']),
});

export const listModuleProgressSchema = z.object({
  batch: z.string().min(1).trim(),
  track: z.string().min(1).trim(),
});
