import { z } from 'zod';

export const WORKSHEET_TYPES = ['practice', 'homework', 'revision', 'hots', 'olympiad', 'remedial'] as const;
export const QUESTION_TYPES = [
  'mcq', 'fill_blank', 'true_false', 'assertion_reason', 'very_short', 'short', 'long', 'hots', 'case_study',
  'multi_correct', 'match_following', 'one_word', 'competency_based', 'application_based', 'activity_based',
  'observation_based', 'diagram_based', 'picture_based', 'label_diagram', 'complete_diagram', 'numerical',
  'word_problem', 'oral', 'revision', 'sequence_arrangement', 'odd_one_out', 'passage_based',
] as const;
export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

export const generateWorksheetSchema = z.object({
  batch: z.string({ required_error: 'batch is required' }).min(1).trim(),
  track: z.string({ required_error: 'track is required' }).min(1).trim(),
  trainingModuleIds: z.array(z.string()).min(1, 'Select at least one training module'),
  worksheetType: z.enum(WORKSHEET_TYPES),
  questionCount: z.number().int().min(1).max(50),
  topicIds: z.array(z.string()).optional(),
  languageComplexity: z.enum(['auto', 'simple', 'standard', 'advanced']).default('auto'),
  includeImages: z.boolean().default(false),
});

const imageRefSchema = z.object({ sourceId: z.string(), figureId: z.string() });
const imageRequirementSchema = z.object({
  imageRequired: z.literal(true),
  imageSource: z.enum(['generated', 'faculty_upload']),
  imagePrompt: z.string().optional(),
});

const worksheetQuestionSchema = z.object({
  questionId: z.string().optional(),
  questionText: z.string().min(1),
  questionType: z.enum(QUESTION_TYPES),
  options: z.array(z.string()).nullable().optional(),
  difficulty: z.enum(DIFFICULTIES),
  estimatedTimeMinutes: z.number().min(0),
  keywords: z.array(z.string()).default([]),
  isNew: z.boolean().optional(),
  imageRef: imageRefSchema.optional(),
  imageRequirement: imageRequirementSchema.optional(),
});

export const generateWorksheetFromContentSchema = z.object({
  batch: z.string({ required_error: 'batch is required' }).min(1).trim(),
  track: z.string({ required_error: 'track is required' }).min(1).trim(),
  moduleName: z.string({ required_error: 'moduleName is required' }).min(1).trim(),
  contentText: z.string({ required_error: 'contentText is required' }).trim().min(20, 'Paste or upload more content — that looks too short to generate from.'),
  worksheetType: z.enum(WORKSHEET_TYPES),
  questionCount: z.number().int().min(1).max(50),
  languageComplexity: z.enum(['auto', 'simple', 'standard', 'advanced']).default('auto'),
});

export const saveWorksheetSchema = z.object({
  batch: z.string({ required_error: 'batch is required' }).min(1).trim(),
  track: z.string({ required_error: 'track is required' }).min(1).trim(),
  // Required for sourceType 'module_bank'; ignored for 'content_upload' (moduleName is used instead).
  trainingModuleIds: z.array(z.string()).default([]),
  worksheetType: z.enum(WORKSHEET_TYPES),
  title: z.string({ required_error: 'title is required' }).min(1).trim(),
  // Empty for 'photo_upload' — that worksheet IS the attachment, not a question list.
  questions: z.array(worksheetQuestionSchema).default([]),
  addNewToBank: z.boolean().default(true),
  sourceType: z.enum(['module_bank', 'content_upload', 'photo_upload']).default('module_bank'),
  // 'content_upload' only:
  moduleName: z.string().trim().optional(),
  sourceContent: z.string().optional(),
  aiReview: z.string().optional(),
  // 'photo_upload' only:
  attachmentUrl: z.string().url().optional(),
  attachmentFileName: z.string().optional(),
}).refine((v) => v.sourceType === 'content_upload' || v.trainingModuleIds.length > 0 || v.sourceType === 'photo_upload', {
  message: 'Select at least one training module',
  path: ['trainingModuleIds'],
}).refine((v) => v.sourceType !== 'content_upload' || !!v.moduleName?.trim(), {
  message: 'moduleName is required for a content-based worksheet',
  path: ['moduleName'],
}).refine((v) => v.sourceType === 'photo_upload' || v.questions.length > 0, {
  message: 'At least one question is required',
  path: ['questions'],
}).refine((v) => v.sourceType !== 'photo_upload' || !!v.attachmentUrl, {
  message: 'attachmentUrl is required for a photo/file worksheet',
  path: ['attachmentUrl'],
});

// Multipart form fields for the "upload an existing worksheet as-is" flow — the file itself
// arrives separately as req.file via documentUploadMiddleware.
export const uploadWorksheetSchema = z.object({
  batch: z.string({ required_error: 'batch is required' }).min(1).trim(),
  track: z.string({ required_error: 'track is required' }).min(1).trim(),
  title: z.string({ required_error: 'title is required' }).min(1).trim(),
  worksheetType: z.enum(WORKSHEET_TYPES),
});

export const listWorksheetsSchema = z.object({
  batch: z.string().optional(),
  track: z.string().optional(),
  trainingModuleId: z.string().optional(),
  worksheetType: z.enum(WORKSHEET_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateWorksheetSchema = z.object({
  title: z.string().min(1).trim().optional(),
  questions: z.array(z.object({
    questionText: z.string().min(1),
    options: z.array(z.string()).nullable().optional(),
    difficulty: z.enum(DIFFICULTIES),
    estimatedTimeMinutes: z.number().min(0),
  })).optional(),
});

export type GenerateWorksheetInput = z.infer<typeof generateWorksheetSchema>;
export type GenerateWorksheetFromContentInput = z.infer<typeof generateWorksheetFromContentSchema>;
export type SaveWorksheetInput = z.infer<typeof saveWorksheetSchema>;
export type ListWorksheetsInput = z.infer<typeof listWorksheetsSchema>;
export type UpdateWorksheetInput = z.infer<typeof updateWorksheetSchema>;
export type UploadWorksheetInput = z.infer<typeof uploadWorksheetSchema>;
