import { z } from 'zod';

const codingLanguageSchema = z.enum(['python', 'java', 'c', 'cpp', 'javascript']);

const testCaseSchema = z.object({
  input: z.string().default(''),
  expectedOutput: z.string().min(1, 'A test case needs an expected output'),
  hidden: z.boolean().default(false),
});

const testQuestionSchema = z
  .object({
    questionText: z.string().min(1).trim(),
    questionType: z.enum(['mcq', 'short_answer', 'coding']),
    options: z.array(z.string()).optional(),
    correctAnswer: z.string().trim().optional(),
    marks: z.number().min(0),
    sectionIndex: z.number().int().min(0).default(0),
    allowedLanguages: z.array(codingLanguageSchema).optional(),
    starterCode: z.record(codingLanguageSchema, z.string()).optional(),
    testCases: z.array(testCaseSchema).optional(),
    section: z.string().trim().optional(),
    topic: z.string().trim().optional(),
    subTopic: z.string().trim().optional(),
    level: z.enum(['easy', 'medium', 'hard']).optional(),
  })
  .refine((v) => v.questionType !== 'mcq' || (v.options && v.options.filter((o) => o.trim()).length >= 2), {
    message: 'An MCQ question needs at least 2 options',
    path: ['options'],
  })
  .refine((v) => v.questionType !== 'coding' || (v.allowedLanguages && v.allowedLanguages.length > 0), {
    message: 'A coding question needs at least one allowed language',
    path: ['allowedLanguages'],
  })
  .refine((v) => v.questionType !== 'coding' || (v.testCases && v.testCases.length > 0), {
    message: 'A coding question needs at least one test case',
    path: ['testCases'],
  })
  .refine((v) => v.questionType !== 'mcq' || !v.correctAnswer || !!v.options?.some((o) => o.trim() === v.correctAnswer), {
    message: "An MCQ's correct answer must be one of its options",
    path: ['correctAnswer'],
  });

const testSectionSchema = z.object({
  title: z.string().trim().min(1, 'Every section needs a title'),
  description: z.string().trim().optional(),
  pickCount: z.number().int().min(1).optional(),
});

const testBodySchema = z.object({
  title: z.string().min(1).trim(),
  track: z.string().trim().optional(),
  description: z.string().trim().max(5000).optional(),
  instructions: z.string().trim().max(5000).optional(),
  sections: z.array(testSectionSchema).optional(),
  questions: z.array(testQuestionSchema).min(1, 'Add at least one question'),
  durationMinutes: z.number().int().min(1),
  violationLimit: z.number().int().min(1).default(3),
  allowedFullscreenExits: z.number().int().min(0).max(10).default(1),
  contentName: z.string().trim().optional(),
  topic: z.string().trim().optional(),
  sourceContent: z.string().optional(),
  aiGenerated: z.boolean().optional(),
  aiReview: z.string().optional(),
});

// Every question must point at a section that exists — a test with no sections is treated
// as one implicit section, so only index 0 is valid there.
const sectionIndexesValid = (v: { sections?: { title: string }[]; questions?: { sectionIndex: number }[] }) =>
  !v.questions || v.questions.every((q) => q.sectionIndex < Math.max(1, v.sections?.length ?? 0));
const SECTION_INDEX_ERROR = { message: 'A question belongs to a section that does not exist', path: ['questions'] };

// A pooled section (pickCount below its question count) hands different candidates different
// questions — they must all carry the same marks, or candidates' papers wouldn't be out of the
// same total. A pickCount above the section's size is meaningless and rejected too.
const poolsValid = (v: { sections?: { pickCount?: number }[]; questions?: { sectionIndex: number; marks: number }[] }) => {
  if (!v.sections || !v.questions) return true;
  return v.sections.every((s, si) => {
    if (!s.pickCount) return true;
    const qs = v.questions!.filter((q) => q.sectionIndex === si);
    if (s.pickCount > qs.length) return false;
    return s.pickCount === qs.length || qs.every((q) => q.marks === qs[0].marks);
  });
};
const POOL_ERROR = {
  message: "A section's 'questions per candidate' can't exceed its question count, and a pooled section's questions must all carry the same marks",
  path: ['sections'],
};

export const createTestSchema = testBodySchema.refine(sectionIndexesValid, SECTION_INDEX_ERROR).refine(poolsValid, POOL_ERROR);

export const updateTestSchema = testBodySchema.partial().refine(sectionIndexesValid, SECTION_INDEX_ERROR).refine(poolsValid, POOL_ERROR);

export const createAssignmentSchema = z
  .object({
    targetType: z.enum(['batch', 'candidates']),
    batch: z.string().trim().optional(),
    candidateIds: z.array(z.string().min(1)).optional(),
    /** Optional — blocks `start` until this instant even while the assignment is active. */
    scheduledAt: z.coerce.date().optional(),
  })
  .refine((v) => (v.targetType === 'batch' ? !!v.batch?.trim() : true), { message: 'A batch is required for a batch assignment', path: ['batch'] })
  .refine((v) => (v.targetType === 'candidates' ? !!v.candidateIds?.length : true), {
    message: 'Select at least one candidate for a specific-students assignment',
    path: ['candidateIds'],
  });

export const startTestSchema = z.object({
  accessCode: z.string().trim().min(1, 'Enter the access code from your notification'),
});

export const sendAccessCodeSchema = z.object({
  candidateIds: z.array(z.string().min(1)).min(1, 'Select at least one candidate'),
});

export const generateTestDraftSchema = z.object({
  title: z.string({ required_error: 'title is required' }).min(1).trim(),
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
  code: z.string().optional(),
  language: codingLanguageSchema.optional(),
});

export const runCodeSchema = z.object({
  questionIndex: z.number().int().min(0),
  code: z.string().min(1, 'Write some code before running it').max(100_000),
  language: codingLanguageSchema,
  customInput: z.string().max(100_000).optional(),
});

export const submitCodeSchema = runCodeSchema.omit({ customInput: true });
export const markViewedSchema = z.object({
  questionIndex: z.number().int().min(0),
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
    'multiple_screens',
  ]),
  detail: z.string().trim().max(300).optional(),
});

export type CreateTestInput = z.infer<typeof createTestSchema>;
export type UpdateTestInput = z.infer<typeof updateTestSchema>;
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type StartTestInput = z.infer<typeof startTestSchema>;
export type SendAccessCodeInput = z.infer<typeof sendAccessCodeSchema>;
export type GenerateTestDraftInput = z.infer<typeof generateTestDraftSchema>;
export type ReviewTestInput = z.infer<typeof reviewTestSchema>;
export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;
export type LogViolationInput = z.infer<typeof logViolationSchema>;
export type RunCodeInput = z.infer<typeof runCodeSchema>;
export type SubmitCodeInput = z.infer<typeof submitCodeSchema>;
export type MarkViewedInput = z.infer<typeof markViewedSchema>;
