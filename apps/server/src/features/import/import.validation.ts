import { z } from 'zod';

export const importTypeSchema = z.enum(['training-schedule', 'faculty', 'candidates']);

export const updateMappingSchema = z.object({
  columnMapping: z.record(z.string(), z.string()),
});

export const setDuplicateStrategySchema = z.object({
  duplicateStrategy: z.enum(['skip', 'overwrite', 'create']),
});

export const updateRowSchema = z.object({
  raw: z.record(z.string(), z.string()),
});

export const addRowSchema = z.object({
  raw: z.record(z.string(), z.string()),
});

export const listImportSessionsSchema = z.object({
  importType: importTypeSchema.optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
