import { z } from 'zod';

const CATEGORIES = ['aptitude', 'reasoning', 'pi', 'gd', 'company'] as const;
const QUESTION_TYPES = ['mcq', 'open_ended'] as const;
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
const AUDIENCES = ['all', 'batches', 'students'] as const;

const audienceFields = {
  audience: z.enum(AUDIENCES).optional(),
  batches: z.array(z.string().trim().min(1)).optional(),
  candidateIds: z.array(z.string().trim().min(1)).optional(),
};

const audienceTargetRefine = (v: { audience?: (typeof AUDIENCES)[number]; batches?: string[]; candidateIds?: string[] }) =>
  v.audience !== 'batches' || (v.batches?.length ?? 0) > 0;
const audienceStudentRefine = (v: { audience?: (typeof AUDIENCES)[number]; candidateIds?: string[] }) =>
  v.audience !== 'students' || (v.candidateIds?.length ?? 0) > 0;

export const createPracticeQuestionSchema = z
  .object({
    category: z.enum(CATEGORIES),
    companyName: z.string().trim().optional(),
    questionText: z.string().min(1).trim(),
    questionType: z.enum(QUESTION_TYPES),
    options: z.array(z.string()).optional(),
    correctAnswer: z.string().trim().optional(),
    explanation: z.string().trim().max(2500).optional(),
    guidancePoints: z.array(z.string()).optional(),
    difficulty: z.enum(DIFFICULTIES).optional(),
    tags: z.array(z.string()).optional(),
    ...audienceFields,
  })
  .refine(audienceTargetRefine, { message: 'Pick at least one batch', path: ['batches'] })
  .refine(audienceStudentRefine, { message: 'Pick at least one student', path: ['candidateIds'] })
  .refine((v) => v.category !== 'company' || !!v.companyName?.trim(), {
    message: 'companyName is required for category "company"',
    path: ['companyName'],
  })
  .refine((v) => v.questionType !== 'mcq' || (v.options && v.options.filter((o) => o.trim()).length >= 2), {
    message: 'An MCQ question needs at least 2 options',
    path: ['options'],
  });

export const updatePracticeQuestionSchema = z
  .object({
    category: z.enum(CATEGORIES).optional(),
    companyName: z.string().trim().optional(),
    questionText: z.string().min(1).trim().optional(),
    questionType: z.enum(QUESTION_TYPES).optional(),
    options: z.array(z.string()).optional(),
    correctAnswer: z.string().trim().optional(),
    explanation: z.string().trim().max(2500).optional(),
    guidancePoints: z.array(z.string()).optional(),
    difficulty: z.enum(DIFFICULTIES).optional(),
    tags: z.array(z.string()).optional(),
    ...audienceFields,
  })
  .refine(audienceTargetRefine, { message: 'Pick at least one batch', path: ['batches'] })
  .refine(audienceStudentRefine, { message: 'Pick at least one student', path: ['candidateIds'] });

export const assignPracticeQuestionsSchema = z
  .object({
    questionIds: z.array(z.string()).min(1, 'Select at least one question'),
    audience: z.enum(AUDIENCES),
    batches: z.array(z.string().trim().min(1)).optional(),
    candidateIds: z.array(z.string().trim().min(1)).optional(),
  })
  .refine(audienceTargetRefine, { message: 'Pick at least one batch', path: ['batches'] })
  .refine(audienceStudentRefine, { message: 'Pick at least one student', path: ['candidateIds'] });

export const listPracticeQuestionSchema = z.object({
  category: z.enum(CATEGORIES).optional(),
  companyName: z.string().trim().optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const createPracticeSheetSchema = z.object({
  title: z.string().min(1).trim(),
  batch: z.string().min(1).trim(),
  category: z.enum(CATEGORIES),
  questionIds: z.array(z.string()).min(1, 'Select at least one question'),
});

export type CreatePracticeQuestionInput = z.infer<typeof createPracticeQuestionSchema>;
export type UpdatePracticeQuestionInput = z.infer<typeof updatePracticeQuestionSchema>;
export type ListPracticeQuestionInput = z.infer<typeof listPracticeQuestionSchema>;
export type AssignPracticeQuestionsInput = z.infer<typeof assignPracticeQuestionsSchema>;
export type CreatePracticeSheetInput = z.infer<typeof createPracticeSheetSchema>;
