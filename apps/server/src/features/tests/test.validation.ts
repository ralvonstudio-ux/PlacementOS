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
});

export const updateTestSchema = createTestSchema.partial();

export const submitAnswerSchema = z.object({
  questionIndex: z.number().int().min(0),
  selectedOption: z.string().optional(),
  answerText: z.string().optional(),
});

export const logViolationSchema = z.object({
  type: z.enum(['tab_switch', 'window_blur', 'fullscreen_exit', 'copy_paste', 'right_click', 'devtools', 'no_face']),
  detail: z.string().trim().max(300).optional(),
});

export type CreateTestInput = z.infer<typeof createTestSchema>;
export type UpdateTestInput = z.infer<typeof updateTestSchema>;
export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;
export type LogViolationInput = z.infer<typeof logViolationSchema>;
