import { openaiProvider } from '../ai/providers/llm/openai.provider';
import { trainingModuleRecordRepository } from '../question-bank/training-module-record.repository';
import { bankQuestionRepository } from '../question-bank/bank-question.repository';
import { bankQuestionSourceRepository } from '../question-bank/bank-question-source.repository';
import { IBankQuestion, QuestionKind, QuestionDifficulty, IBankQuestionImageRef, IBankQuestionImageRequirement } from '../question-bank/bank-question.model';
import { AuthContext } from '../../lib/auth-context';
import { ValidationError } from '../../middlewares/errorHandler';
import { logger } from '../../lib/logger';
import { WORKSHEET_PRESETS } from './worksheet-preset';
import { WorksheetType, IWorksheetQuestion } from './worksheet.model';
import { languageStyleGuide, TRAINER_VOICE_RULES, SELF_CHECK_INSTRUCTION, imageAvailabilityInstruction } from '../question-bank/training-voice';
import { collectModuleFigures, ModuleFigure } from '../question-bank/figure-lookup';
import { resolveQuestionImages } from '../question-bank/image-resolution';
import type { LanguageComplexity, PageFigure, ResolvedQuestionImage } from '@placementos/types';

export interface GenerateWorksheetInput {
  batch: string;
  track: string;
  trainingModuleIds: string[];
  worksheetType: WorksheetType;
  questionCount: number;
  topicIds?: string[];
  languageComplexity?: LanguageComplexity;
  includeImages?: boolean;
}

export interface GenerateWorksheetFromContentInput {
  batch: string;
  track: string;
  moduleName: string;
  contentText: string;
  worksheetType: WorksheetType;
  questionCount: number;
  languageComplexity?: LanguageComplexity;
}

export interface WorksheetQuestionDraft extends IWorksheetQuestion {
  isNew?: boolean;
}

interface RawAuthoredQuestion {
  questionText?: string | null;
  questionType?: string | null;
  options?: string[] | null;
  difficulty?: string | null;
  estimatedTimeMinutes?: number | string | null;
  keywords?: string[] | null;
  imageFigureId?: string | null;
  imageRequired?: boolean | null;
  imagePrompt?: string | null;
}

const QUESTION_TYPES: QuestionKind[] = [
  'mcq', 'fill_blank', 'true_false', 'assertion_reason', 'very_short', 'short', 'long', 'hots', 'case_study',
  'multi_correct', 'match_following', 'one_word', 'competency_based', 'application_based', 'activity_based',
  'observation_based', 'diagram_based', 'picture_based', 'label_diagram', 'complete_diagram', 'numerical',
  'word_problem', 'oral', 'revision', 'sequence_arrangement', 'odd_one_out', 'passage_based',
];
const DIFFICULTIES: QuestionDifficulty[] = ['easy', 'medium', 'hard'];

function matchesPreset(q: IBankQuestion, preset: { difficulties: QuestionDifficulty[]; questionTypes: QuestionKind[]; bloomsLevels: string[] }): boolean {
  if (preset.difficulties.length > 0 && !preset.difficulties.includes(q.difficulty)) return false;
  if (preset.questionTypes.length > 0 && !preset.questionTypes.includes(q.questionType)) return false;
  if (preset.bloomsLevels.length > 0 && !preset.bloomsLevels.includes(q.bloomsLevel)) return false;
  return true;
}

function toWorksheetQuestion(q: IBankQuestion): IWorksheetQuestion {
  return {
    questionId: String(q._id),
    questionText: q.questionText,
    questionType: q.questionType,
    options: q.options,
    difficulty: q.difficulty,
    estimatedTimeMinutes: q.estimatedTimeMinutes,
    keywords: q.keywords,
    imageRef: q.imageRef,
    imageRequirement: q.imageRequirement,
  };
}

function buildAuthoringPrompt(input: GenerateWorksheetInput, moduleNames: string[], count: number, figures: PageFigure[]): string {
  const preset = WORKSHEET_PRESETS[input.worksheetType];
  const forcedDifficulty = preset.difficulties.length === 1 ? preset.difficulties[0] : undefined;

  return `You are an experienced placement trainer writing ${count} new questions for a ${preset.label} for batch ${input.batch}, track "${input.track}", covering: ${moduleNames.join(', ')}.

${languageStyleGuide(input.languageComplexity)}

${TRAINER_VOICE_RULES}

${imageAvailabilityInstruction(figures, input.includeImages ?? false)}

Write ${preset.authoringGuidance}.
${forcedDifficulty ? `\nEvery single question MUST be "${forcedDifficulty}" difficulty — that is what this worksheet type requires. If the module content looks too simple or too advanced to naturally reach "${forcedDifficulty}", stretch the question yourself rather than writing an easier/harder one or skipping it. Return all ${count} questions at "${forcedDifficulty}" difficulty — never fewer.\n` : ''}
For each question, return:
- "questionText": the question
- "questionType": one of ${QUESTION_TYPES.map((t) => `"${t}"`).join(', ')}
- "options": array of option strings, only if questionType is "mcq"
- "difficulty": ${forcedDifficulty ? `must be exactly "${forcedDifficulty}"` : `one of ${DIFFICULTIES.map((d) => `"${d}"`).join(', ')}`}
- "estimatedTimeMinutes": estimated minutes a candidate would need
- "keywords": 2-4 key terms from the question
- "imageFigureId" / "imageRequired" + "imagePrompt": only as described above — omit both for an ordinary text question

${SELF_CHECK_INSTRUCTION}

Return ONLY a valid JSON object: {"questions": [...]}. No markdown, no explanation.`;
}

function buildContentAuthoringPrompt(input: GenerateWorksheetFromContentInput, count: number): string {
  const preset = WORKSHEET_PRESETS[input.worksheetType];
  const forcedDifficulty = preset.difficulties.length === 1 ? preset.difficulties[0] : undefined;

  return `You are an experienced placement trainer writing a ${preset.label} for batch ${input.batch}, track "${input.track}", topic "${input.moduleName}", based on the content below.

Content:
"""
${input.contentText.slice(0, 12000)}
"""

${languageStyleGuide(input.languageComplexity)}

${TRAINER_VOICE_RULES}

Write exactly ${count} questions grounded in the content above — ${preset.authoringGuidance}.
${forcedDifficulty ? `\nEvery single question MUST be "${forcedDifficulty}" difficulty.\n` : ''}
For each question, return:
- "questionText": the question
- "questionType": one of ${QUESTION_TYPES.map((t) => `"${t}"`).join(', ')}
- "options": array of option strings, only if questionType is "mcq"
- "difficulty": ${forcedDifficulty ? `must be exactly "${forcedDifficulty}"` : `one of ${DIFFICULTIES.map((d) => `"${d}"`).join(', ')}`}
- "estimatedTimeMinutes": estimated minutes a candidate would need
- "keywords": 2-4 key terms from the question

${SELF_CHECK_INSTRUCTION}

Return ONLY a valid JSON object: {"questions": [...]}. No markdown, no explanation.`;
}

function buildReviewPrompt(input: GenerateWorksheetFromContentInput, questions: WorksheetQuestionDraft[]): string {
  const summary = questions.map((q, i) => `${i + 1}. [${q.difficulty}/${q.questionType}] ${q.questionText}`).join('\n');
  return `You just drafted a ${input.worksheetType} worksheet with ${questions.length} questions for topic "${input.moduleName}" from the source content below. Write a short review (3-5 sentences) for the faculty member reviewing this draft before they use it: comment on topic coverage against the source content, difficulty/type balance, and call out anything worth double-checking or improving. Be specific and concise — this is a quick pre-flight check, not a full report.

Source content:
"""
${input.contentText.slice(0, 6000)}
"""

Drafted questions:
${summary}

Return plain text only — no markdown headers, no JSON.`;
}

function parseAuthored(raw: string): RawAuthoredQuestion[] {
  try {
    const body = JSON.parse(raw);
    const questions = Array.isArray(body) ? body : body.questions;
    return Array.isArray(questions) ? questions : [];
  } catch (err) {
    logger.error('[WorksheetGenerator] Failed to parse AI response', { error: String(err), raw: raw.slice(0, 500) });
    throw new ValidationError('Could not author new questions — try again.');
  }
}

function cleanAuthored(raw: RawAuthoredQuestion[], forcedDifficulty: QuestionDifficulty | undefined, figureSourceMap: Map<string, string>): WorksheetQuestionDraft[] {
  return raw
    .filter((q) => q.questionText?.trim())
    .map((q) => {
      const timeNum = typeof q.estimatedTimeMinutes === 'string' ? Number(q.estimatedTimeMinutes) : q.estimatedTimeMinutes;
      const imageRef: IBankQuestionImageRef | undefined = q.imageFigureId?.trim() && figureSourceMap.has(q.imageFigureId.trim())
        ? { sourceId: figureSourceMap.get(q.imageFigureId.trim())!, figureId: q.imageFigureId.trim() }
        : undefined;
      const imageRequirement: IBankQuestionImageRequirement | undefined = !imageRef && q.imageRequired
        ? { imageRequired: true, imageSource: 'generated', imagePrompt: q.imagePrompt?.trim() || undefined }
        : undefined;
      return {
        questionText: q.questionText!.trim(),
        questionType: QUESTION_TYPES.includes(q.questionType as QuestionKind) ? (q.questionType as QuestionKind) : 'short',
        options: Array.isArray(q.options) ? q.options : undefined,
        difficulty: forcedDifficulty ?? (DIFFICULTIES.includes(q.difficulty as QuestionDifficulty) ? (q.difficulty as QuestionDifficulty) : 'medium'),
        estimatedTimeMinutes: typeof timeNum === 'number' && !Number.isNaN(timeNum) ? timeNum : 3,
        keywords: Array.isArray(q.keywords) ? q.keywords : [],
        isNew: true,
        imageRef,
        imageRequirement,
      };
    });
}

export const worksheetGeneratorService = {
  async generate(input: GenerateWorksheetInput, ctx: AuthContext): Promise<{ moduleNames: string[]; questions: WorksheetQuestionDraft[]; resolvedImages: Record<string, ResolvedQuestionImage> }> {
    const modules = await trainingModuleRecordRepository.findByIds(ctx.instituteId, input.trainingModuleIds);
    if (modules.length === 0) throw new ValidationError('No matching training modules found for this batch/track');
    const moduleNames = modules.map((m) => m.moduleName);

    const preset = WORKSHEET_PRESETS[input.worksheetType];
    const pool = await bankQuestionRepository.findEligible(ctx.instituteId, input.batch, input.track, input.trainingModuleIds, input.topicIds);
    const eligible = pool.filter((q) => matchesPreset(q, preset));

    eligible.sort((a, b) => a.usageHistory.length - b.usageHistory.length);
    const selected = eligible.slice(0, input.questionCount).map(toWorksheetQuestion);

    const shortfall = input.questionCount - selected.length;
    let authored: WorksheetQuestionDraft[] = [];

    const forcedDifficulty = preset.difficulties.length === 1 ? preset.difficulties[0] : undefined;

    const moduleSources = input.includeImages
      ? await bankQuestionSourceRepository.findAll(ctx.instituteId, input.batch, input.track).catch(() => [])
      : [];
    const moduleFigures: ModuleFigure[] = moduleNames.flatMap((name) => collectModuleFigures(moduleSources, name));
    const figureSourceMap = new Map(moduleFigures.map((f) => [f.figure.figureId, f.sourceId]));

    if (shortfall > 0) {
      if (!openaiProvider.isAvailable()) {
        throw new ValidationError(`Only ${selected.length}/${input.questionCount} questions found in the bank, and AI authoring is not configured to fill the rest.`);
      }

      let stillNeeded = shortfall;
      for (let attempt = 0; attempt < 2 && stillNeeded > 0; attempt++) {
        const result = await openaiProvider.complete({
          systemPrompt: buildAuthoringPrompt(input, moduleNames, stillNeeded, moduleFigures.map((f) => f.figure)),
          userPrompt: attempt === 0 ? 'Write the questions.' : `You returned fewer than ${stillNeeded} last time — write exactly ${stillNeeded} now, no fewer.`,
          temperature: 0.6,
          maxTokens: 2500,
          jsonResponse: true,
        });

        const batch = cleanAuthored(parseAuthored(result.content), forcedDifficulty, figureSourceMap);
        authored = [...authored, ...batch];
        stillNeeded = shortfall - authored.length;
      }
    }

    const questions = [...selected, ...authored];
    const resolvedImages = await resolveQuestionImages(questions, ctx.instituteId);
    return { moduleNames, questions, resolvedImages };
  },

  /** Content-driven mode: every question is freshly authored by the AI straight from
   *  pasted/uploaded content — no question-bank pool involved — plus a short AI review
   *  of the draft for the faculty member to read before editing/saving it. */
  async generateFromContent(input: GenerateWorksheetFromContentInput, _ctx: AuthContext): Promise<{ questions: WorksheetQuestionDraft[]; aiReview: string }> {
    if (!openaiProvider.isAvailable()) throw new ValidationError('AI authoring is not configured on this server.');

    const preset = WORKSHEET_PRESETS[input.worksheetType];
    const forcedDifficulty = preset.difficulties.length === 1 ? preset.difficulties[0] : undefined;

    let authored: WorksheetQuestionDraft[] = [];
    let stillNeeded = input.questionCount;
    for (let attempt = 0; attempt < 2 && stillNeeded > 0; attempt++) {
      const result = await openaiProvider.complete({
        systemPrompt: buildContentAuthoringPrompt(input, stillNeeded),
        userPrompt: attempt === 0 ? 'Write the questions.' : `You returned fewer than ${stillNeeded} last time — write exactly ${stillNeeded} now, no fewer.`,
        temperature: 0.6,
        maxTokens: 3000,
        jsonResponse: true,
      });

      const batch = cleanAuthored(parseAuthored(result.content), forcedDifficulty, new Map());
      authored = [...authored, ...batch];
      stillNeeded = input.questionCount - authored.length;
    }

    if (authored.length === 0) throw new ValidationError('Could not author any questions from this content — try adding more detail.');

    let aiReview = '';
    try {
      const reviewResult = await openaiProvider.complete({
        systemPrompt: buildReviewPrompt(input, authored),
        userPrompt: 'Write the review.',
        temperature: 0.3,
        maxTokens: 400,
      });
      aiReview = reviewResult.content.trim();
    } catch (err) {
      logger.error('[WorksheetGenerator] AI review generation failed — continuing without it', { error: String(err) });
    }

    return { questions: authored, aiReview };
  },
};
