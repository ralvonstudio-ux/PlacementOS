import { z } from 'zod';

const testQuestionSchema = z
  .object({
    questionText: z.string().min(1).trim(),
    questionType: z.enum(['mcq', 'short_answer']),
    options: z.array(z.string()).optional(),
    correctAnswer: z.string().trim().optional(),
    marks: z.number().min(0),
  })
  .refine((v) => v.questionType !== 'mcq' || (v.options && v.options.filter((o) => o.trim()).length >= 2), {
    message: 'An MCQ question needs at least 2 options',
    path: ['options'],
  });

export const createTestSchema = z.object({
  title: z.string().min(1).trim(),
  batch: z.string().min(1).trim(),
  track: z.string().trim().optional(),
  questions: z.array(testQuestionSchema).min(1, 'Add at least one question'),
  durationMinutes: z.number().int().min(1),
  violationLimit: z.number().int().min(1).default(3),
  contentName: z.string().trim().optional(),
  topic: z.string().trim().optional(),
  sourceContent: z.string().optional(),
  aiGenerated: z.boolean().optional(),
  aiReview: z.string().optional(),
});

export const updateTestSchema = createTestSchema.partial();

export const generateTestDraftSchema = z.object({
  title: z.string({ required_error: 'title is required' }).min(1).trim(),
  batch: z.string({ required_error: 'batch is required' }).min(1).trim(),
  track: z.string().trim().optional(),
  contentName: z.string({ required_error: 'contentName is required' }).min(1).trim(),
  topic: z.string({ required_error: 'topic is required' }).min(1).trim(),
  sourceContent: z.string({ required_error: 'sourceContent is required' }).trim().min(20, 'Paste or upload more content — that looks too short to generate from.'),
  mcqCount: z.number().int().min(0).max(100),
  shortAnswerCount: z.number().int().min(0).max(100),
  durationMinutes: z.number().int().min(1),
  violationLimit: z.number().int().min(1).default(3),
}).refine((v) => v.mcqCount + v.shortAnswerCount > 0, {
  message: 'Ask for at least one question (MCQ or short answer)',
  path: ['mcqCount'],
});

export const reviewTestSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  reviewNote: z.string().trim().max(1000).optional(),
});

export const submitAnswerSchema = z.object({
  questionIndex: z.number().int().min(0),
  selectedOption: z.string().optional(),
  answerText: z.string().optional(),
});

export const logViolationSchema = z.object({
  type: z.enum([
    'tab_switch',
    'window_blur',
    'fullscreen_exit',
    'copy_paste',
    'right_click',
    'devtools',
    'no_face',
    'screen_share_stopped',
    'extension_detected',
  ]),
  detail: z.string().trim().max(300).optional(),
});

export type CreateTestInput = z.infer<typeof createTestSchema>;
export type UpdateTestInput = z.infer<typeof updateTestSchema>;
export type GenerateTestDraftInput = z.infer<typeof generateTestDraftSchema>;
export type ReviewTestInput = z.infer<typeof reviewTestSchema>;
export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;
export type LogViolationInput = z.infer<typeof logViolationSchema>;
