import { z } from 'zod';
import type { ListBlockItem } from '@placementos/types';

export const QUESTION_TYPES = [
  'mcq', 'fill_blank', 'true_false', 'assertion_reason', 'very_short', 'short', 'long', 'hots', 'case_study',
  'multi_correct', 'match_following', 'one_word', 'competency_based', 'application_based', 'activity_based',
  'observation_based', 'diagram_based', 'picture_based', 'label_diagram', 'complete_diagram', 'numerical',
  'word_problem', 'oral', 'revision', 'sequence_arrangement', 'odd_one_out', 'passage_based',
] as const;
export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export const BLOOMS_LEVELS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'] as const;

// ── Extraction ─────────────────────────────────────────────────────────────────

export const extractionTargetSchema = z.object({
  batch: z.string({ required_error: 'batch is required' }).min(1).trim(),
  track: z.string({ required_error: 'track is required' }).min(1).trim(),
  // Required so every extracted question is stamped with the faculty member's own module up
  // front — otherwise the AI's per-page/per-chunk best-guess fragments into its own landing row.
  trainingModuleName: z.string({ required_error: 'trainingModuleName is required' }).min(1).trim(),
  detectImages: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
});

export const extractChapterTargetSchema = z.object({
  batch: z.string({ required_error: 'batch is required' }).min(1).trim(),
  track: z.string({ required_error: 'track is required' }).min(1).trim(),
  trainingModuleName: z.string({ required_error: 'trainingModuleName is required' }).min(1).trim(),
  detectImages: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
});

const sourceRefSchema = z.object({
  sourceId: z.string().min(1),
  pageNumber: z.number().int().min(1).optional(),
  blockIndex: z.number().int().min(0).optional(),
});

const imageRefSchema = z.object({ sourceId: z.string().min(1), figureId: z.string().min(1) });
const imageRequirementSchema = z.object({
  imageRequired: z.literal(true),
  imageSource: z.enum(['generated', 'faculty_upload']),
  imagePrompt: z.string().optional(),
});

// A saved "mcq" question with fewer than 2 options prints on the paper with no answer choices —
// enforced right here, at the point every question type first gets accepted.
function requireMcqOptions<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((val, ctx) => {
    const v = val as { questionType?: string; options?: string[] | null };
    if (v.questionType === 'mcq' && (!v.options || v.options.filter((o) => o.trim()).length < 2)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'An MCQ question needs at least 2 answer options' });
    }
  });
}

const extractedQuestionDraftSchema = requireMcqOptions(z.object({
  questionText: z.string().min(1),
  questionType: z.enum(QUESTION_TYPES),
  options: z.array(z.string()).nullish(),
  correctAnswer: z.string().nullish(),
  difficulty: z.enum(DIFFICULTIES),
  marks: z.number().min(0),
  estimatedTimeMinutes: z.number().min(0),
  bloomsLevel: z.enum(BLOOMS_LEVELS),
  keywords: z.array(z.string()).default([]),
  trainingModuleName: z.string().min(1),
  topic: z.string().nullish(),
  topicId: z.string().nullish(),
  subtopicId: z.string().nullish(),
  source: z.string().nullish(),
  sourceRef: sourceRefSchema.nullish(),
  imageRef: imageRefSchema.nullish(),
  imageRequirement: imageRequirementSchema.nullish(),
}));

export const confirmExtractedQuestionsSchema = z.object({
  batch: z.string({ required_error: 'batch is required' }).min(1).trim(),
  track: z.string({ required_error: 'track is required' }).min(1).trim(),
  questions: z.array(extractedQuestionDraftSchema).min(1, 'At least one question is required'),
});

// ── Manual CRUD ────────────────────────────────────────────────────────────────

const baseQuestionSchema = z.object({
  batch: z.string({ required_error: 'batch is required' }).min(1).trim(),
  track: z.string({ required_error: 'track is required' }).min(1).trim(),
  trainingModuleName: z.string({ required_error: 'trainingModuleName is required' }).min(1).trim(),
  topic: z.string().optional(),
  questionText: z.string({ required_error: 'questionText is required' }).min(1),
  questionType: z.enum(QUESTION_TYPES),
  options: z.array(z.string()).nullish(),
  correctAnswer: z.string().nullish(),
  difficulty: z.enum(DIFFICULTIES),
  marks: z.number().min(0),
  estimatedTimeMinutes: z.number().min(0),
  bloomsLevel: z.enum(BLOOMS_LEVELS),
  keywords: z.array(z.string()).default([]),
  source: z.string().nullish(),
});

export const createQuestionSchema = requireMcqOptions(baseQuestionSchema);
export const updateQuestionSchema = baseQuestionSchema.partial();

export const listQuestionsSchema = z.object({
  batch: z.string().optional(),
  track: z.string().optional(),
  trainingModuleId: z.string().optional(),
  topic: z.string().optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  questionType: z.enum(QUESTION_TYPES).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
});

export const listQuestionGroupsSchema = z.object({
  batch: z.string().optional(),
  track: z.string().optional(),
  search: z.string().optional(),
});

export const deleteQuestionGroupsSchema = z.object({
  groups: z.array(z.object({
    batch: z.string({ required_error: 'batch is required' }).min(1).trim(),
    track: z.string({ required_error: 'track is required' }).min(1).trim(),
    trainingModuleId: z.string({ required_error: 'trainingModuleId is required' }).min(1).trim(),
  })).min(1, 'Select at least one training module'),
});

export const mergeQuestionGroupsSchema = z.object({
  groups: z.array(z.object({
    batch: z.string({ required_error: 'batch is required' }).min(1).trim(),
    track: z.string({ required_error: 'track is required' }).min(1).trim(),
    trainingModuleId: z.string({ required_error: 'trainingModuleId is required' }).min(1).trim(),
    trainingModuleName: z.string({ required_error: 'trainingModuleName is required' }).min(1).trim(),
  })).min(2, 'Select at least two training modules to merge'),
  targetModuleName: z.string({ required_error: 'targetModuleName is required' }).min(1).trim(),
});

export const listModulesSchema = z.object({
  batch: z.string({ required_error: 'batch is required' }).min(1).trim(),
  track: z.string({ required_error: 'track is required' }).min(1).trim(),
});

export const listSourcesSchema = z.object({
  batch: z.string().trim().optional(),
  track: z.string().trim().optional(),
});

// ── Structured module capture (layout-aware OCR) ─────────────────────────────
const nullishString = () => z.string().nullish().transform((v) => v ?? undefined);

type ListBlockItemInput = { text: string; items?: ListBlockItemInput[] | null };

const listBlockItemSchema: z.ZodType<ListBlockItem, z.ZodTypeDef, ListBlockItemInput> = z.lazy(() =>
  z.object({ text: z.string().min(1), items: z.array(listBlockItemSchema).nullish().transform((v) => v ?? undefined) })
);

const blockConfidenceSchema = z.enum(['high', 'review', 'low']).nullish().transform((v) => v ?? undefined);

const contentBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('heading'), level: z.union([z.literal(1), z.literal(2), z.literal(3)]), text: z.string().min(1), confidence: blockConfidenceSchema }),
  z.object({ type: z.literal('paragraph'), text: z.string().min(1), confidence: blockConfidenceSchema }),
  z.object({ type: z.literal('list'), ordered: z.boolean(), items: z.array(listBlockItemSchema).min(1), confidence: blockConfidenceSchema }),
  z.object({ type: z.literal('table'), caption: nullishString(), headers: z.array(z.string()), rows: z.array(z.array(z.string())), confidence: blockConfidenceSchema }),
  z.object({ type: z.literal('equation'), latex: z.string().min(1), displayText: nullishString(), confidence: blockConfidenceSchema }),
  z.object({ type: z.literal('figure'), figureNumber: nullishString(), caption: nullishString(), labels: z.array(z.string()).nullish().transform((v) => v ?? undefined), confidence: blockConfidenceSchema }),
  z.object({ type: z.enum(['note', 'quote']), text: z.string().min(1), confidence: blockConfidenceSchema }),
]);

const modulePageSchema = z.object({
  pageNumber: z.number().int().min(1),
  blocks: z.array(contentBlockSchema),
  confidence: z.enum(['high', 'review', 'low']).nullish().transform((v) => v ?? undefined),
  pageError: nullishString(),
});

export const updateSourceSchema = z.object({
  trainingModuleName: z.string().min(1).trim().optional(),
  documentTitle: z.string().trim().optional(),
  pages: z.array(modulePageSchema).optional(),
  reviewStatus: z.enum(['ready_for_review', 'saved']).optional(),
}).refine((d) => d.trainingModuleName !== undefined || d.documentTitle !== undefined || d.pages !== undefined || d.reviewStatus !== undefined, {
  message: 'At least one field is required',
});

export const reExtractSourceSchema = z.object({
  count: z.number().int().min(1).max(100).default(5),
  difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']).default('mixed'),
  languageComplexity: z.enum(['auto', 'simple', 'standard', 'advanced']).default('auto'),
  includeImages: z.boolean().default(false),
});

export const retryPageParamsSchema = z.object({
  id: z.string().min(1),
  pageNumber: z.coerce.number().int().min(1),
});

export const saveChapterSourceSchema = z.object({
  batch: z.string({ required_error: 'batch is required' }).min(1).trim(),
  track: z.string({ required_error: 'track is required' }).min(1).trim(),
  documentTitle: z.string().trim().optional(),
  language: z.string().trim().optional(),
  trainingModuleName: z.string().trim().optional(),
  fileName: z.string().optional(),
  pages: z.array(modulePageSchema).min(1, 'At least one page is required'),
});

// ── Paper generation ───────────────────────────────────────────────────────────

const paperSectionConfigSchema = z.object({
  name: z.string().min(1).trim(),
  questionTypes: z.array(z.enum(QUESTION_TYPES)).default([]),
  difficulty: z.enum(DIFFICULTIES).optional(),
  count: z.number().min(1),
  marksEach: z.number().min(0),
});

export const paperGenerationConfigSchema = z.object({
  batch: z.string({ required_error: 'batch is required' }).min(1).trim(),
  track: z.string({ required_error: 'track is required' }).min(1).trim(),
  examType: z.string({ required_error: 'examType is required' }).min(1).trim(),
  trainingModuleIds: z.array(z.string()).min(1, 'Select at least one training module'),
  topicIds: z.array(z.string()).optional(),
  totalMarks: z.number().min(1),
  difficultyMix: z.object({
    easy: z.number().min(0).default(0),
    medium: z.number().min(0).default(0),
    hard: z.number().min(0).default(0),
  }).default({ easy: 0, medium: 0, hard: 0 }),
  marksBreakdown: z.array(z.object({ marks: z.number().min(0), count: z.number().min(0) })).default([]),
  sections: z.array(paperSectionConfigSchema).optional(),
  questionTypes: z.array(z.enum(QUESTION_TYPES)).default([]),
  durationMinutes: z.number().min(1).optional(),
  languageComplexity: z.enum(['auto', 'simple', 'standard', 'advanced']).default('auto'),
  includeAnswerKey: z.boolean().default(false),
  includeImages: z.boolean().default(false),
  blackAndWhite: z.boolean().default(false),
}).refine(
  (v) => (v.sections && v.sections.length > 0) || v.marksBreakdown.length > 0,
  { message: 'Add at least one section (or marks-breakdown row)', path: ['sections'] }
);

// ── Inferred types ────────────────────────────────────────────────────────────

export type ExtractionTarget = z.infer<typeof extractionTargetSchema>;
export type ConfirmExtractedQuestionsInput = z.infer<typeof confirmExtractedQuestionsSchema>;
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
export type ListQuestionsInput = z.infer<typeof listQuestionsSchema>;
export type ListQuestionGroupsInput = z.infer<typeof listQuestionGroupsSchema>;
export type DeleteQuestionGroupsInput = z.infer<typeof deleteQuestionGroupsSchema>;
export type MergeQuestionGroupsInput = z.infer<typeof mergeQuestionGroupsSchema>;
export type ListModulesInput = z.infer<typeof listModulesSchema>;
export type ListSourcesInput = z.infer<typeof listSourcesSchema>;
export type UpdateSourceInput = z.infer<typeof updateSourceSchema>;
export type PaperGenerationConfigInput = z.infer<typeof paperGenerationConfigSchema>;
export type RetryPageParamsInput = z.infer<typeof retryPageParamsSchema>;
export type ReExtractSourceInput = z.infer<typeof reExtractSourceSchema>;
export type SaveChapterSourceInput = z.infer<typeof saveChapterSourceSchema>;
