import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import { openaiProvider } from '../ai/providers/llm/openai.provider';
import { ValidationError } from '../../middlewares/errorHandler';
import { AuthContext } from '../../lib/auth-context';
import { logger } from '../../lib/logger';
import { extractionJobRepository } from './extraction-job.repository';
import { bankQuestionSourceRepository } from './bank-question-source.repository';
import { trainingModuleRecordRepository } from './training-module-record.repository';
import { bankQuestionRepository } from './bank-question.repository';
import { IBankQuestionSource } from './bank-question-source.model';
import { QuestionKind, QuestionDifficulty, QuestionBloomsLevel } from './bank-question.model';
import type { ITopicNode } from './training-module-record.model';
import { normalizeOptions } from './option-text';
import type {
  ContentBlock, ModulePage, ModuleCaptureJobResult, QuestionGenerationOptions,
  LanguageComplexity, PageFigure, BankQuestionImageRef, BankQuestionImageRequirement,
} from '@placementos/types';
import { languageStyleGuide, TRAINER_VOICE_RULES, SELF_CHECK_INSTRUCTION, imageAvailabilityInstruction, imageAvailabilityInstructionSelfDetect } from './training-voice';
import { saveImage } from '../../lib/image-store';
import type { ModuleFigure } from './figure-lookup';

// ── Output shapes ──────────────────────────────────────────────────────────────

export interface ExtractedQuestionDraft {
  questionText: string;
  questionType: QuestionKind;
  options?: string[];
  correctAnswer?: string;
  difficulty: QuestionDifficulty;
  marks: number;
  estimatedTimeMinutes: number;
  bloomsLevel: QuestionBloomsLevel;
  keywords: string[];
  trainingModuleName: string;
  topic?: string;
  // Best-effort match of `topic` against the module's derived topicTree — left unset (never
  // guessed) when there's no exact match.
  topicId?: string;
  subtopicId?: string;
  source?: string;
  imageRef?: BankQuestionImageRef;
  imageRequirement?: BankQuestionImageRequirement;
}

export interface QuestionExtractionResult {
  sourceType: 'image' | 'pdf_text';
  extracted: ExtractedQuestionDraft[];
  warnings: string[];
  /** Id of the permanent BankQuestionSource row this upload's converted text was saved under. */
  sourceId?: string;
}

/** Result of an upload that only transcribes/stores text — no question structuring happens yet. */
export interface TextExtractionResult {
  sourceId: string;
  sourceType: 'image' | 'pdf_text';
  fileName?: string;
  extractedText: string;
  warnings: string[];
}

// ── Raw shape the model is asked to return ─────────────────────────────────────

interface RawExtractedQuestion {
  questionText?: string | null;
  questionType?: string | null;
  options?: string[] | null;
  correctAnswer?: string | null;
  difficulty?: string | null;
  marks?: number | string | null;
  estimatedTimeMinutes?: number | string | null;
  bloomsLevel?: string | null;
  keywords?: string[] | null;
  chapterName?: string | null;
  topic?: string | null;
  source?: string | null;
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

/** Target question count fed to structureFromText on a module-capture source's first-ever fresh
 *  processing pass — a generous ceiling (~2 per type), not a target the prompt is told to force. */
const COMPREHENSIVE_COVERAGE_TARGET = QUESTION_TYPES.length * 2;
const BLOOMS_LEVELS: QuestionBloomsLevel[] = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];

const TOKENS_PER_QUESTION = 320;
const BASE_STRUCTURING_TOKENS = 500;
const MAX_STRUCTURING_TOKENS = 6000;
const MAX_BATCH_COUNT = 8;
const CHUNK_CHAR_LIMIT = 12_000;
const CHUNK_CONCURRENCY = 3;
const MAX_RETRIES_ON_TRUNCATION = 2;
const PAGE_TEXT_TOKEN_ALLOWANCE = 1800;

function structuringTokenBudget(count: number, headroomMultiplier = 1): number {
  return Math.min(MAX_STRUCTURING_TOKENS, Math.round((count * TOKENS_PER_QUESTION + BASE_STRUCTURING_TOKENS) * headroomMultiplier));
}

/** Splits a large request into a run of per-call batch sizes, each within maxBatch, that sum back to `count`. */
export function splitIntoBatches(count: number, maxBatch: number = MAX_BATCH_COUNT): number[] {
  const batches: number[] = [];
  let remaining = count;
  while (remaining > 0) {
    const size = Math.min(maxBatch, remaining);
    batches.push(size);
    remaining -= size;
  }
  return batches;
}

/** Splits `total` across `weights.length` slots proportional to each weight, using the
 *  largest-remainder method so the parts always sum exactly to `total`. */
export function allocateByWeight(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  const sumW = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (sumW > 0 ? (w / sumW) * total : total / weights.length));
  const floors = raw.map(Math.floor);
  const distributed = floors.reduce((a, b) => a + b, 0);
  const remainder = total - distributed;
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < remainder && k < order.length; k++) floors[order[k].i] += 1;
  return floors;
}

/** Splits long source text into chunks no larger than maxChars, breaking on paragraph boundaries. */
export function chunkText(text: string, maxChars: number = CHUNK_CHAR_LIMIT): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxChars) return [trimmed];

  const paragraphs = trimmed.split(/\n\s*\n/);
  const chunks: string[] = [];
  let current = '';
  for (const para of paragraphs) {
    const candidate = current ? `${current}\n\n${para}` : para;
    if (candidate.length > maxChars && current) {
      chunks.push(current);
      current = para;
    } else {
      current = candidate;
    }
    while (current.length > maxChars) {
      chunks.push(current.slice(0, maxChars));
      current = current.slice(maxChars);
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** Runs `fn` over `items` with at most `limit` in flight at once. */
async function runWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Drops duplicate questions (normalized on trimmed/lowercased text). */
export function dedupeQuestions(list: ExtractedQuestionDraft[]): ExtractedQuestionDraft[] {
  const seen = new Set<string>();
  const out: ExtractedQuestionDraft[] = [];
  for (const q of list) {
    const key = q.questionText.trim().toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  return out;
}

/** Normalizes extracted source text for the process-once content hash. */
export function computeContentHash(text: string): string {
  const normalized = text.trim().replace(/\s+/g, ' ');
  return createHash('sha256').update(normalized).digest('hex');
}

/** Raw shape of one entry in an AI response's optional `"topics"` array. */
export interface RawTopicNode {
  name?: string | null;
  subtopics?: (string | null)[] | null;
}

/** Turns the AI's raw `topics` response into a stable ITopicNode[] tree. */
export function buildTopicTree(raw: RawTopicNode[]): ITopicNode[] {
  return raw
    .map((t) => t.name?.trim())
    .map((name, i) => {
      const t = raw[i];
      if (!name) return null;
      const subtopics = (t.subtopics ?? [])
        .map((s) => s?.trim())
        .filter((s): s is string => Boolean(s))
        .map((name, order) => ({ subtopicId: `st_${randomUUID().slice(0, 8)}`, name, order }));
      return { topicId: `t_${randomUUID().slice(0, 8)}`, name, order: i, subtopics };
    })
    .filter((t): t is ITopicNode => t !== null);
}

/** Best-effort match of a draft's free-text `topic` against the module's derived topic tree. */
export function matchTopicIds(topic: string | undefined, tree: ITopicNode[]): { topicId?: string; subtopicId?: string } {
  if (!topic?.trim()) return {};
  const key = topic.trim().toLowerCase();
  for (const t of tree) {
    const sub = t.subtopics.find((s) => s.name.trim().toLowerCase() === key);
    if (sub) return { topicId: t.topicId, subtopicId: sub.subtopicId };
  }
  const t = tree.find((t) => t.name.trim().toLowerCase() === key);
  if (t) return { topicId: t.topicId };
  return {};
}

export function buildSystemPrompt(
  batch: string, track: string,
  options: { count: number; difficulty: QuestionDifficulty | 'mixed'; languageComplexity?: LanguageComplexity; includeImages?: boolean; figures?: PageFigure[]; requestTopics?: boolean; comprehensiveTypeCoverage?: boolean },
  excludeTexts: string[] = []
): string {
  const difficultyInstruction = options.difficulty === 'mixed' ? 'a mix of easy, medium, and hard difficulty' : `"${options.difficulty}" difficulty only`;

  const excludeBlock = excludeTexts.length
    ? `\n\nThese questions were already extracted from this same document in an earlier pass — do NOT repeat them or near-duplicates of them:\n${excludeTexts.slice(0, 30).map((t) => `- ${t.slice(0, 150)}`).join('\n')}\n`
    : '';

  const countInstruction = options.comprehensiveTypeCoverage
    ? `This is this training module's first-ever processing pass — the questions generated now are effectively permanent for this content, so aim for genuine, comprehensive coverage rather than a small handful. Read the whole page and consider every one of these question types: ${QUESTION_TYPES.map((t) => `"${t}"`).join(', ')}. For each type this specific content actually, honestly supports, write roughly 1-3 questions of that type, across ${difficultyInstruction}. Do NOT force a type the content can't support${options.includeImages ? '' : ' (image-based questions are off for this run)'}; treat ${options.count} as a generous upper ceiling for this call, not a target to hit — if the content is thin, return fewer questions across fewer types rather than padding, forcing, or inventing content to fill it out.`
    : `Pick out up to ${options.count} of the clearest, most answerable question(s) on the page, at ${difficultyInstruction}. If the page has fewer than ${options.count} actual questions, return only as many as genuinely exist — never invent extra ones. Keep every field concise; do not pad or over-elaborate simple content just to fill space.`;

  const topicsInstruction = options.requestTopics
    ? `\n\nAlso return "topics": an array describing this training module's topic/subtopic hierarchy, based on everything covered by this text — each entry shaped { "name": "topic name", "subtopics": ["subtopic name", ...] }. Keep it concise (typically 2-6 topics); only include a subtopic where the text clearly supports it. Never invent topics unrelated to this content.`
    : '';

  return `You are an experienced placement trainer reading training material, practice sheets, or previous test papers for batch ${batch}, track "${track}" and picking out questions to reuse — not an AI summarizing a document.

${languageStyleGuide(options.languageComplexity)}

${TRAINER_VOICE_RULES}

${imageAvailabilityInstruction(options.figures ?? [], options.includeImages ?? false)}

${countInstruction}
${excludeBlock}
For each question, return:
- "questionText": the full question text
- "questionType": one of ${QUESTION_TYPES.map((t) => `"${t}"`).join(', ')}
- "options": array of option strings, only if questionType is "mcq"
- "correctAnswer": the correct answer. If it is visible on the page use that; otherwise write a short, correct answer yourself based only on this page's content — never leave it blank unless the question type has no single answer.
- "difficulty": one of ${DIFFICULTIES.map((d) => `"${d}"`).join(', ')} — estimate based on the question's complexity
- "marks": the marks this question is worth (a number). If not stated, estimate a reasonable value based on question type and length
- "estimatedTimeMinutes": estimated minutes a candidate would need
- "bloomsLevel": one of ${BLOOMS_LEVELS.map((b) => `"${b}"`).join(', ')} — Bloom's Taxonomy level
- "keywords": 2-5 key terms from the question
- "chapterName": the training module this question belongs to, if visible/inferable from the page, else your best guess from the content
- "topic": the specific topic within the module, if identifiable
- "source": where this came from if visible, else omit
- "imageFigureId" / "imageRequired" + "imagePrompt": only as described above — omit both for an ordinary text question

Also return "pageText": the full raw text of everything readable on the page, transcribed verbatim, so it can be cached and re-used later.
${topicsInstruction}

${SELF_CHECK_INSTRUCTION}

Return ONLY a valid JSON object: {"pageText": "...", "questions": [...]${options.requestTopics ? ', "topics": [...]' : ''}}. No markdown, no explanation. Skip anything that is not actually a question (headings, instructions, page numbers).`;
}

/** One-shot vision equivalent of buildSystemPrompt: reads a photographed page directly and drafts
 *  questions from it in the same call, with figure detection and drafting happening together. */
export function buildDirectExtractionPrompt(
  batch: string, track: string,
  options: { count: number; difficulty: QuestionDifficulty | 'mixed'; languageComplexity?: LanguageComplexity; detectImages?: boolean; requestTopics?: boolean; comprehensiveTypeCoverage?: boolean },
  excludeTexts: string[] = []
): string {
  const difficultyInstruction = options.difficulty === 'mixed' ? 'a mix of easy, medium, and hard difficulty' : `"${options.difficulty}" difficulty only`;

  const excludeBlock = excludeTexts.length
    ? `\n\nThese questions were already extracted from this same upload in an earlier pass — do NOT repeat them or near-duplicates of them:\n${excludeTexts.slice(0, 30).map((t) => `- ${t.slice(0, 150)}`).join('\n')}\n`
    : '';

  const countInstruction = options.comprehensiveTypeCoverage
    ? `This is this training module's first-ever processing pass — the questions generated now are effectively permanent for this content, so aim for genuine, comprehensive coverage rather than a small handful. Read the whole page and consider every one of these question types: ${QUESTION_TYPES.map((t) => `"${t}"`).join(', ')}. For each type this specific page actually, honestly supports, write roughly 1-3 questions of that type, across ${difficultyInstruction}. Do NOT force a type the page can't support${options.detectImages ? '' : ' (image-based questions are off for this run)'}; treat ${options.count} as a generous upper ceiling for this call, not a target to hit.`
    : `Pick out up to ${options.count} of the clearest, most answerable question(s) on the page, at ${difficultyInstruction}. If the page has fewer than ${options.count} actual questions, return only as many as genuinely exist — never invent extra ones. Keep every field concise.`;

  const topicsInstruction = options.requestTopics
    ? `\n\nAlso return "topics": an array describing this training module's topic/subtopic hierarchy, based on everything covered by this page, each entry shaped { "name": "topic name", "subtopics": ["subtopic name", ...] }. Keep it concise (typically 2-6 topics). Never invent topics unrelated to this content.`
    : '';

  return `You are an experienced placement trainer reading a photographed page of training material, a practice sheet, or a previous test paper for batch ${batch}, track "${track}" and picking out questions to reuse — not an AI summarizing a document.

${languageStyleGuide(options.languageComplexity)}

${TRAINER_VOICE_RULES}

${imageAvailabilityInstructionSelfDetect(options.detectImages ?? false)}

${countInstruction}
${excludeBlock}
For each question, return:
- "questionText": the full question text
- "questionType": one of ${QUESTION_TYPES.map((t) => `"${t}"`).join(', ')}
- "options": array of option strings, only if questionType is "mcq"
- "correctAnswer": the correct answer. If visible use that; otherwise write a short, correct answer yourself — never leave it blank unless the question type has no single answer.
- "difficulty": one of ${DIFFICULTIES.map((d) => `"${d}"`).join(', ')}
- "marks": the marks this question is worth (a number), estimated if not stated
- "estimatedTimeMinutes": estimated minutes a candidate would need
- "bloomsLevel": one of ${BLOOMS_LEVELS.map((b) => `"${b}"`).join(', ')}
- "keywords": 2-5 key terms from the question
- "chapterName": the training module this question belongs to, if identifiable, else your best guess
- "topic": the specific topic within the module, if identifiable
- "source": where this came from if visible, else omit
- "imageFigureId" / "imageRequired" + "imagePrompt": only as described above

Also return "pageText": everything readable on the page, transcribed verbatim (preserve numbering/structure as line breaks) — used to detect if this same page is ever uploaded again, never shown to the faculty member directly.
${topicsInstruction}

${SELF_CHECK_INSTRUCTION}

Return ONLY a valid JSON object: {"pageText": "...", "questions": [...]${options.detectImages ? ', "figures": [...]' : ''}${options.requestTopics ? ', "topics": [...]' : ''}}. No markdown, no explanation. Skip anything that is not actually a question.`;
}

/** Asks the model to write brand-new questions for a training module, rather than extract them
 *  from a page — used by the paper generator when the bank doesn't have enough questions at a
 *  requested marks value. The model must never refuse for "not enough content". */
export function buildSynthesisPrompt(
  batch: string, track: string, trainingModuleName: string, marks: number, count: number,
  questionType?: QuestionKind, difficulty?: QuestionDifficulty, languageComplexity?: LanguageComplexity,
  includeImages?: boolean, figures?: PageFigure[]
): string {
  return `You are an experienced placement trainer writing ${count} new, original practice question(s) for batch ${batch}, track "${track}", training module "${trainingModuleName}", each worth exactly ${marks} mark(s)${questionType ? ` and of question type "${questionType}"` : ''}.

${languageStyleGuide(languageComplexity)}

${TRAINER_VOICE_RULES}

${imageAvailabilityInstruction(figures ?? [], includeImages ?? false)}

Use the reference material below (existing questions and/or uploaded material from this module) as your content — do not invent facts outside it. You must always produce exactly ${count} question(s) worth ${marks} marks each, no matter how little reference material is given. Never refuse or claim there isn't enough content: if the module's material is thin for a high-mark question, write a multi-part or detailed-answer question that legitimately deserves ${marks} marks by combining and extending the module's concepts.
${difficulty ? `\nThe trainer specifically asked for "${difficulty}" difficulty here — every one of these ${count} question(s) MUST be "${difficulty}" difficulty, no exceptions. If this module's material looks too basic to naturally reach that difficulty, stretch it there yourself (deeper application, a multi-step or multi-part twist, an unfamiliar scenario using the same concept) until it genuinely earns "${difficulty}".\n` : ''}
For each question, return the same JSON shape used for extraction:
- "questionText"
- "questionType": ${questionType ? `must be exactly "${questionType}"` : `one of ${QUESTION_TYPES.map((t) => `"${t}"`).join(', ')}`}
- "options": array of option strings, only if questionType is "mcq"
- "correctAnswer": a short, correct model answer for this question, grounded only in the reference material — always include this
- "difficulty": ${difficulty ? `must be exactly "${difficulty}"` : `one of ${DIFFICULTIES.map((d) => `"${d}"`).join(', ')}`}
- "marks": must be exactly ${marks}
- "estimatedTimeMinutes", "bloomsLevel": one of ${BLOOMS_LEVELS.map((b) => `"${b}"`).join(', ')}
- "keywords": 2-5 key terms
- "chapterName": "${trainingModuleName}"
- "topic": the specific topic within the module, if identifiable
- "imageFigureId" / "imageRequired" + "imagePrompt": only as described above

${SELF_CHECK_INSTRUCTION}

Return ONLY a valid JSON object: {"questions": [...]}. No markdown, no explanation.`;
}

/** Flattens structured blocks back to plain text so `BankQuestionSource.extractedText` (a
 *  required field, and the input to search/synthesis prompts) stays populated. */
export function flattenBlocksToText(blocks: ContentBlock[]): string {
  const lines: string[] = [];
  const stripMd = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');

  const renderItems = (items: { text: string; items?: unknown[] }[], depth: number, ordered: boolean) => {
    items.forEach((it, i) => {
      const bullet = ordered ? `${i + 1}.` : '-';
      lines.push(`${'  '.repeat(depth)}${bullet} ${stripMd(it.text)}`);
      if (Array.isArray(it.items) && it.items.length) renderItems(it.items as { text: string; items?: unknown[] }[], depth + 1, ordered);
    });
  };

  for (const block of blocks) {
    switch (block.type) {
      case 'heading': lines.push(stripMd(block.text)); break;
      case 'paragraph': lines.push(stripMd(block.text)); break;
      case 'list': renderItems(block.items as { text: string; items?: unknown[] }[], 0, block.ordered); break;
      case 'table': {
        if (block.caption) lines.push(block.caption);
        if (block.headers.length) lines.push(block.headers.join(' | '));
        for (const row of block.rows) lines.push(row.join(' | '));
        break;
      }
      case 'equation': lines.push(block.displayText || block.latex); break;
      case 'figure': lines.push(`[Figure${block.figureNumber ? ` ${block.figureNumber}` : ''}${block.caption ? ` — ${block.caption}` : ''}]`); break;
      case 'note': case 'quote': lines.push(stripMd(block.text)); break;
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

/** Renders blocks back to lightweight Markdown (tables/lists stay structured) for the
 *  question-structuring prompt, instead of the fully flattened plain text. */
export function blocksToMarkdown(blocks: ContentBlock[]): string {
  const lines: string[] = [];
  const renderItems = (items: { text: string; items?: unknown[] }[], depth: number, ordered: boolean) => {
    items.forEach((it, i) => {
      const bullet = ordered ? `${i + 1}.` : '-';
      lines.push(`${'  '.repeat(depth)}${bullet} ${it.text}`);
      if (Array.isArray(it.items) && it.items.length) renderItems(it.items as { text: string; items?: unknown[] }[], depth + 1, ordered);
    });
  };
  for (const block of blocks) {
    switch (block.type) {
      case 'heading': lines.push(`${'#'.repeat(block.level)} ${block.text}`); break;
      case 'paragraph': lines.push(block.text); break;
      case 'list': renderItems(block.items as { text: string; items?: unknown[] }[], 0, block.ordered); break;
      case 'table': {
        if (block.caption) lines.push(`_${block.caption}_`);
        if (block.headers.length) {
          lines.push(`| ${block.headers.join(' | ')} |`);
          lines.push(`| ${block.headers.map(() => '---').join(' | ')} |`);
        }
        for (const row of block.rows) lines.push(`| ${row.join(' | ')} |`);
        break;
      }
      case 'equation': lines.push(`$${block.latex}$`); break;
      case 'figure': lines.push(`[Figure${block.figureNumber ? ` ${block.figureNumber}` : ''}${block.caption ? ` — ${block.caption}` : ''}]`); break;
      case 'note': case 'quote': lines.push(`> ${block.text}`); break;
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

/** Splits plain transcribed page text into paragraph blocks on blank lines. */
function textToParagraphBlocks(text: string): ContentBlock[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => ({ type: 'paragraph' as const, text: p }));
}

/** Parses the model's `{"questions": [...]}` response, non-throwing. */
function tryParseQuestions(raw: string): { questions: RawExtractedQuestion[]; topics?: RawTopicNode[] } | null {
  try {
    const body = JSON.parse(raw);
    const questions = Array.isArray(body) ? body : body.questions;
    if (!Array.isArray(questions)) return null;
    const topics = !Array.isArray(body) && Array.isArray(body.topics) ? (body.topics as RawTopicNode[]) : undefined;
    return { questions, topics };
  } catch {
    return null;
  }
}

/** Recovers as many complete question objects as possible from a truncated response. */
export function salvageTruncatedQuestions(raw: string): RawExtractedQuestion[] {
  const questionsIdx = raw.indexOf('"questions"');
  if (questionsIdx === -1) return [];
  const arrStart = raw.indexOf('[', questionsIdx);
  if (arrStart === -1) return [];

  const objectStrings: string[] = [];
  let depth = 0;
  let objStart = -1;
  let inString = false;
  let escapeNext = false;

  for (let i = arrStart + 1; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escapeNext) escapeNext = false;
      else if (ch === '\\') escapeNext = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') { if (depth === 0) objStart = i; depth++; }
    else if (ch === '}') {
      depth--;
      if (depth === 0 && objStart !== -1) {
        objectStrings.push(raw.slice(objStart, i + 1));
        objStart = -1;
      } else if (depth < 0) {
        break;
      }
    }
  }

  const recovered: RawExtractedQuestion[] = [];
  for (const objStr of objectStrings) {
    try { recovered.push(JSON.parse(objStr)); } catch { /* skip the odd malformed object */ }
  }
  return recovered;
}

/** Shared, retry-safe AI call for one batch of question drafts. Detects truncation via OpenAI's
 *  finishReason:"length" as well as JSON parse failure, and automatically recovers. */
async function completeQuestionsWithRetry(
  buildPrompts: (count: number) => { systemPrompt: string; userPrompt: string },
  initialCount: number,
  _ctx: AuthContext
): Promise<{ extracted: ExtractedQuestionDraft[]; warnings: string[]; topics?: RawTopicNode[] }> {
  let attemptCount = initialCount;
  let headroom = 1;

  for (let attempt = 0; attempt <= MAX_RETRIES_ON_TRUNCATION; attempt++) {
    const { systemPrompt, userPrompt } = buildPrompts(attemptCount);
    const maxTokens = structuringTokenBudget(attemptCount, headroom);
    const result = await openaiProvider.complete({ systemPrompt, userPrompt, temperature: 0.2, maxTokens, jsonResponse: true });

    const truncated = result.finishReason === 'length';
    const parsed = tryParseQuestions(result.content);
    const isLastAttempt = attempt === MAX_RETRIES_ON_TRUNCATION;

    if (parsed && !truncated) return { ...clean(parsed.questions), topics: parsed.topics };
    if (parsed && truncated && !isLastAttempt) {
      attemptCount = Math.max(1, Math.ceil(attemptCount / 2));
      headroom += 0.75;
      continue;
    }
    if (parsed) return { ...clean(parsed.questions), topics: parsed.topics };

    if (isLastAttempt) {
      const salvaged = salvageTruncatedQuestions(result.content);
      if (salvaged.length > 0) {
        const { extracted, warnings } = clean(salvaged);
        warnings.push(`The AI's response was cut off after ${extracted.length} question(s) in this section — the rest were recovered from the partial reply.`);
        return { extracted, warnings };
      }
      logger.error('[QuestionExtraction] AI response unparseable after retries', { raw: result.content.slice(0, 500) });
      return { extracted: [], warnings: ['Part of the uploaded content could not be turned into questions — the AI response was incomplete. Try again, or split this upload into smaller pages.'] };
    }

    attemptCount = Math.max(1, Math.ceil(attemptCount / 2));
    headroom += 0.75;
  }

  return { extracted: [], warnings: [] };
}

function toUserSafeErrorMessage(err: unknown): string {
  if (err instanceof ValidationError) return err.message;
  return "We couldn't process this page right now — please try again.";
}

interface RawFigure {
  boundingBox?: { x?: number; y?: number; width?: number; height?: number } | null;
  figureType?: string | null;
  caption?: string | null;
  description?: string | null;
  usableForQuestion?: boolean | null;
  figureId?: string | null;
}

const FIGURE_TYPES = new Set(['decorative', 'content_supporting', 'diagram', 'chart_table', 'map', 'illustration']);

function isFractional(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
}

function normalizeFigure(raw: RawFigure, pageNumber: number, index: number): PageFigure | null {
  const bb = raw.boundingBox;
  if (!bb || !isFractional(bb.x) || !isFractional(bb.y) || !isFractional(bb.width) || !isFractional(bb.height)) return null;
  if (!raw.description?.trim()) return null;
  const figureType = FIGURE_TYPES.has(raw.figureType as string) ? (raw.figureType as PageFigure['figureType']) : 'illustration';

  return {
    figureId: `p${pageNumber}_fig${index + 1}`,
    pageNumber,
    boundingBox: { x: bb.x, y: bb.y, width: bb.width, height: bb.height },
    figureType,
    caption: raw.caption?.trim() || undefined,
    description: raw.description.trim(),
    usableForQuestion: raw.usableForQuestion !== false,
  };
}

function parseDirectExtraction(raw: string, pageNumber = 1): { pageText: string; figures: PageFigure[]; questions: RawExtractedQuestion[]; topics?: RawTopicNode[] } {
  const body = JSON.parse(raw);
  const pageText = typeof body?.pageText === 'string' ? body.pageText : '';
  const questions: RawExtractedQuestion[] = Array.isArray(body?.questions) ? body.questions : [];
  const rawFigures: RawFigure[] = Array.isArray(body?.figures) ? body.figures : [];

  const idMap = new Map<string, string>();
  const figures: PageFigure[] = [];
  rawFigures.forEach((f, i) => {
    const normalized = normalizeFigure(f, pageNumber, i);
    if (!normalized || !normalized.usableForQuestion) return;
    if (f.figureId?.trim()) idMap.set(f.figureId.trim(), normalized.figureId);
    figures.push(normalized);
  });

  const remappedQuestions = questions.map((q) => ({
    ...q,
    imageFigureId: q.imageFigureId && idMap.has(q.imageFigureId) ? idMap.get(q.imageFigureId) : undefined,
  }));

  return { pageText, figures, questions: remappedQuestions, topics: Array.isArray(body?.topics) ? (body.topics as RawTopicNode[]) : undefined };
}

function tryParseDirectExtraction(raw: string, pageNumber: number): ReturnType<typeof parseDirectExtraction> | null {
  try { return parseDirectExtraction(raw, pageNumber); } catch { return null; }
}

async function completeDirectExtractionWithRetry(
  buildPrompts: (count: number) => { systemPrompt: string; userPrompt: string },
  initialCount: number, _ctx: AuthContext, imageDataUri: string, pageNumber: number
): Promise<{ pageText: string; figures: PageFigure[]; extracted: ExtractedQuestionDraft[]; warnings: string[]; topics?: RawTopicNode[] }> {
  let attemptCount = initialCount;
  let headroom = 1;

  for (let attempt = 0; attempt <= MAX_RETRIES_ON_TRUNCATION; attempt++) {
    const { systemPrompt, userPrompt } = buildPrompts(attemptCount);
    const maxTokens = structuringTokenBudget(attemptCount, headroom) + PAGE_TEXT_TOKEN_ALLOWANCE;
    const result = await openaiProvider.complete({ systemPrompt, userPrompt, imageDataUri, temperature: 0.2, maxTokens, jsonResponse: true });

    const truncated = result.finishReason === 'length';
    const parsed = tryParseDirectExtraction(result.content, pageNumber);
    const isLastAttempt = attempt === MAX_RETRIES_ON_TRUNCATION;

    if (parsed && !truncated) {
      const { extracted, warnings } = clean(parsed.questions);
      return { pageText: parsed.pageText, figures: parsed.figures, extracted, warnings, topics: parsed.topics };
    }
    if (parsed && truncated && !isLastAttempt) {
      attemptCount = Math.max(1, Math.ceil(attemptCount / 2));
      headroom += 0.75;
      continue;
    }
    if (parsed) {
      const { extracted, warnings } = clean(parsed.questions);
      return { pageText: parsed.pageText, figures: parsed.figures, extracted, warnings, topics: parsed.topics };
    }

    if (isLastAttempt) {
      const salvagedQuestions = salvageTruncatedQuestions(result.content);
      const pageTextMatch = /"pageText"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(result.content);
      let salvagedPageText = '';
      if (pageTextMatch) {
        try { salvagedPageText = JSON.parse(`"${pageTextMatch[1]}"`); } catch { /* leave blank */ }
      }
      if (salvagedQuestions.length > 0 || salvagedPageText.trim()) {
        const { extracted, warnings } = clean(salvagedQuestions);
        if (salvagedQuestions.length > 0) warnings.push("The AI's response was cut off partway through this page — the rest were recovered from the partial reply.");
        return { pageText: salvagedPageText, figures: [], extracted, warnings };
      }
      logger.error('[QuestionExtraction] Direct-extraction response unparseable after retries', { raw: result.content.slice(0, 500) });
      throw new ValidationError('Could not read that photo — try again, or use a clearer picture.');
    }

    attemptCount = Math.max(1, Math.ceil(attemptCount / 2));
    headroom += 0.75;
  }

  throw new ValidationError('Could not read that photo — try again.');
}

function clean(entries: RawExtractedQuestion[]): { extracted: ExtractedQuestionDraft[]; warnings: string[] } {
  const extracted: ExtractedQuestionDraft[] = [];
  const warnings: string[] = [];

  for (const entry of entries) {
    if (!entry.questionText?.trim()) continue;

    const questionType = QUESTION_TYPES.includes(entry.questionType as QuestionKind) ? (entry.questionType as QuestionKind) : 'short';
    const difficulty = DIFFICULTIES.includes(entry.difficulty as QuestionDifficulty) ? (entry.difficulty as QuestionDifficulty) : 'medium';
    const bloomsLevel = BLOOMS_LEVELS.includes(entry.bloomsLevel as QuestionBloomsLevel) ? (entry.bloomsLevel as QuestionBloomsLevel) : 'understand';

    const marksNum = typeof entry.marks === 'string' ? Number(entry.marks) : entry.marks;
    const timeNum = typeof entry.estimatedTimeMinutes === 'string' ? Number(entry.estimatedTimeMinutes) : entry.estimatedTimeMinutes;

    if (!entry.chapterName?.trim()) {
      warnings.push(`"${entry.questionText.slice(0, 40)}…" had no identifiable training module — please assign one before saving.`);
    }

    extracted.push({
      questionText: entry.questionText.trim(),
      questionType,
      options: normalizeOptions(entry.options),
      correctAnswer: entry.correctAnswer ?? undefined,
      difficulty,
      marks: typeof marksNum === 'number' && !Number.isNaN(marksNum) ? marksNum : 1,
      estimatedTimeMinutes: typeof timeNum === 'number' && !Number.isNaN(timeNum) ? timeNum : 2,
      bloomsLevel,
      keywords: Array.isArray(entry.keywords) ? entry.keywords : [],
      trainingModuleName: entry.chapterName?.trim() || 'Unassigned',
      topic: entry.topic ?? undefined,
      source: entry.source ?? undefined,
      imageRef: entry.imageFigureId?.trim() ? { sourceId: '', figureId: entry.imageFigureId.trim() } : undefined,
      imageRequirement: !entry.imageFigureId?.trim() && entry.imageRequired
        ? { imageRequired: true, imageSource: 'generated', imagePrompt: entry.imagePrompt?.trim() || undefined }
        : undefined,
    });
  }

  return { extracted, warnings };
}

/** Stamps a faculty-assigned module name onto every extracted draft, preserving the AI's own
 *  per-question guess as `topic` (only when the draft doesn't already carry a more specific one). */
function applyModuleOverride(questions: ExtractedQuestionDraft[], trainingModuleName: string): ExtractedQuestionDraft[] {
  const trimmed = trainingModuleName.trim();
  return questions.map((q) => {
    const guessedHeading = q.trainingModuleName?.trim();
    const topic = q.topic?.trim() || (guessedHeading && guessedHeading.toLowerCase() !== trimmed.toLowerCase() ? guessedHeading : undefined);
    return { ...q, trainingModuleName: trimmed, topic };
  });
}

// ── Service ────────────────────────────────────────────────────────────────────

export const questionExtractionService = {
  /** Upload -> read the photo once and get straight to question drafts. The page's transcribed
   *  text is saved on the source record (needed for re-extraction/search), but it's internal —
   *  the faculty member's next screen is the question drafts, not an editable OCR-text page.
   *  `detectImages` is the "Include images" toggle. */
  async extractFromImage(
    batch: string, track: string, trainingModuleName: string, imageDataUri: string, ctx: AuthContext, fileName?: string, detectImages = false
  ): Promise<QuestionExtractionResult> {
    if (!openaiProvider.isAvailable()) {
      throw new ValidationError('AI extraction is not configured on this server.');
    }

    const { pageText, figures, extracted, warnings } = await completeDirectExtractionWithRetry(
      (count) => ({
        systemPrompt: buildDirectExtractionPrompt(batch, track, { count, difficulty: 'mixed', detectImages, requestTopics: false, comprehensiveTypeCoverage: true }),
        userPrompt: 'Read this photographed page and extract questions from it.',
      }),
      COMPREHENSIVE_COVERAGE_TARGET, ctx, imageDataUri, 1
    );

    if (!pageText.trim()) {
      throw new ValidationError('No readable text was found on that page — try a clearer photo.');
    }

    let pageImageFileId: string | undefined;
    if (detectImages && figures.length > 0) {
      const [, base64] = imageDataUri.split(',', 2);
      const contentTypeMatch = /^data:([^;]+);/.exec(imageDataUri);
      pageImageFileId = await saveImage(Buffer.from(base64 ?? '', 'base64'), {
        instituteId: ctx.instituteId,
        contentType: contentTypeMatch?.[1] ?? 'image/jpeg',
      });
    }

    const source = await bankQuestionSourceRepository.create({
      instituteId: ctx.instituteId, userId: ctx.userId, batch, track, kind: 'image', fileName,
      extractedText: pageText, trainingModuleName: trainingModuleName.trim(),
      ...(pageImageFileId ? { pageImageFileId, figures } : {}),
    });
    const sourceId = String(source._id);
    await trainingModuleRecordRepository.findOrCreate(ctx.instituteId, batch, track, trainingModuleName.trim());

    const withSource = applyModuleOverride(extracted, trainingModuleName).map((q) => ({
      ...q,
      sourceRef: { sourceId },
      imageRef: q.imageRef ? { ...q.imageRef, sourceId } : undefined,
    }));

    return { sourceType: 'image', extracted: withSource, warnings, sourceId };
  },

  /** Upload -> extract + store text only (local PDF text layer, no AI call). Question structuring is a separate, repeatable step. */
  async extractFromPdf(
    batch: string, track: string, trainingModuleName: string, pdfBuffer: Buffer, ctx: AuthContext, fileName?: string
  ): Promise<TextExtractionResult> {
    // Loaded lazily so a broken native dependency in pdf-parse's chain only breaks this one path
    // at request time, never crashing the whole server at boot.
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: pdfBuffer });
    const { text } = await parser.getText();
    await parser.destroy();

    if (!text.trim() || text.trim().length < 20) {
      throw new ValidationError('This PDF has no readable text layer (likely a scanned document) — upload photos of its pages instead.');
    }

    const source = await bankQuestionSourceRepository.create({
      instituteId: ctx.instituteId, userId: ctx.userId, batch, track, kind: 'pdf_text', fileName,
      extractedText: text, trainingModuleName: trainingModuleName.trim(),
    });
    await trainingModuleRecordRepository.findOrCreate(ctx.instituteId, batch, track, trainingModuleName.trim());

    return { sourceId: String(source._id), sourceType: 'pdf_text', fileName, extractedText: text, warnings: [] };
  },

  /** Re-runs AI structuring over previously-saved converted text — no re-upload/re-OCR needed. */
  async extractFromSourceText(source: IBankQuestionSource, options: QuestionGenerationOptions, ctx: AuthContext): Promise<QuestionExtractionResult> {
    const sourceText = source.pages?.length ? blocksToMarkdown(source.pages.flatMap((p) => p.blocks)) : source.extractedText;
    const figures: PageFigure[] = [...(source.figures ?? []), ...(source.pages ?? []).flatMap((p) => p.figures ?? [])];
    const sourceId = String(source._id);

    // ── Process-once guard + topic-tree derivation, module-capture sources only ──────────
    const isModuleCapture = Boolean(source.pages?.length) && Boolean(source.trainingModuleName?.trim());
    let module_: Awaited<ReturnType<typeof trainingModuleRecordRepository.findOrCreate>> | undefined;
    let contentHash: string | undefined;
    if (isModuleCapture) {
      contentHash = computeContentHash(sourceText);
      module_ = await trainingModuleRecordRepository.findOrCreate(ctx.instituteId, source.batch, source.track, source.trainingModuleName!.trim());
      if (module_.extractionStatus === 'processed' && module_.sourceContentHash === contentHash) {
        logger.info('[QuestionExtraction] Skipping duplicate module-capture extraction — sourceContentHash unchanged', {
          trainingModuleId: String(module_._id), moduleName: module_.moduleName, instituteId: ctx.instituteId,
        });
        const existing = await bankQuestionRepository.findAll(ctx.instituteId, { trainingModuleId: String(module_._id), limit: 200 });
        return {
          sourceType: source.kind,
          sourceId,
          warnings: ["This training module's content hasn't changed since it was last processed — showing the previously generated questions instead of re-running AI extraction."],
          extracted: existing.questions.map((q) => ({
            questionText: q.questionText, questionType: q.questionType, options: q.options, correctAnswer: q.correctAnswer,
            difficulty: q.difficulty, marks: q.marks, estimatedTimeMinutes: q.estimatedTimeMinutes, bloomsLevel: q.bloomsLevel,
            keywords: q.keywords, trainingModuleName: q.trainingModuleName, topic: q.topic, topicId: q.topicId, subtopicId: q.subtopicId,
            source: q.source, sourceRef: q.sourceRef, imageRef: q.imageRef, imageRequirement: q.imageRequirement,
          })),
        };
      }
      await trainingModuleRecordRepository.markExtractionStatus(String(module_._id), ctx.instituteId, 'processing');
    }

    const structuringOptions: QuestionGenerationOptions = isModuleCapture ? { ...options, count: COMPREHENSIVE_COVERAGE_TARGET } : options;

    const { extracted, warnings, topics } = await questionExtractionService.structureFromText(
      source.batch, source.track, sourceText, structuringOptions, ctx, source.trainingModuleName, figures, isModuleCapture, isModuleCapture
    );

    let topicTree: ITopicNode[] | undefined;
    if (isModuleCapture && module_) {
      topicTree = topics?.length ? buildTopicTree(topics) : undefined;
      await trainingModuleRecordRepository.markProcessed(String(module_._id), ctx.instituteId, { sourceContentHash: contentHash!, topicTree });
    }

    const rebased = source.trainingModuleName ? applyModuleOverride(extracted, source.trainingModuleName) : extracted;
    const withModule = rebased.map((q) => {
      const { topicId, subtopicId } = topicTree ? matchTopicIds(q.topic, topicTree) : {};
      return { ...q, topicId, subtopicId, sourceRef: { sourceId }, imageRef: q.imageRef ? { ...q.imageRef, sourceId } : undefined };
    });
    return { sourceType: source.kind, extracted: withModule, warnings, sourceId };
  },

  /** Shared AI call: turns raw page/document text into structured question drafts. Scales to any
   *  source size and any requested count without a single call ever risking truncation. */
  async structureFromText(
    batch: string, track: string, text: string, options: QuestionGenerationOptions, ctx: AuthContext,
    trainingModuleName?: string, figures: PageFigure[] = [], deriveTopics = false, comprehensiveTypeCoverage = false
  ): Promise<{ extracted: ExtractedQuestionDraft[]; warnings: string[]; topics?: RawTopicNode[] }> {
    const chunks = chunkText(text);
    if (chunks.length === 0) return { extracted: [], warnings: [] };

    const perChunkCounts = allocateByWeight(options.count, chunks.map((c) => c.length));
    const tasks = chunks
      .map((chunk, i) => ({ chunk, count: perChunkCounts[i] }))
      .filter((t) => t.count > 0)
      .map((t, i) => ({ ...t, isTopicSource: deriveTopics && i === 0 }));

    let derivedTopics: RawTopicNode[] | undefined;
    const perTaskResults = await runWithConcurrency(tasks, CHUNK_CONCURRENCY, async (task) => {
      const extracted: ExtractedQuestionDraft[] = [];
      const warnings: string[] = [];
      for (const batchSize of splitIntoBatches(task.count)) {
        const excludeTexts = extracted.map((q) => q.questionText);
        const requestTopics = task.isTopicSource && excludeTexts.length === 0;
        const result = await completeQuestionsWithRetry(
          (count) => ({
            systemPrompt: buildSystemPrompt(batch, track, { count, difficulty: options.difficulty, languageComplexity: options.languageComplexity, includeImages: options.includeImages, figures, requestTopics, comprehensiveTypeCoverage }, excludeTexts),
            userPrompt: `Extract up to ${count} question(s) from this document text:\n\n${task.chunk}`,
          }),
          batchSize,
          ctx
        );
        extracted.push(...result.extracted);
        warnings.push(...result.warnings);
        if (requestTopics && result.topics) derivedTopics = result.topics;
      }
      return { extracted, warnings };
    });

    const merged = dedupeQuestions(perTaskResults.flatMap((r) => r.extracted));
    const warnings = perTaskResults.flatMap((r) => r.warnings);
    let final = merged.length > options.count ? merged.slice(0, options.count) : merged;

    if (!comprehensiveTypeCoverage && final.length < options.count && openaiProvider.isAvailable()) {
      const shortfall = options.count - final.length;
      try {
        const synthesized = await questionExtractionService.synthesizeQuestions(
          {
            batch, track, trainingModuleName: trainingModuleName?.trim() || track, marks: 1, count: shortfall,
            difficulty: options.difficulty === 'mixed' ? undefined : options.difficulty, contextText: text,
          },
          ctx
        );
        final = dedupeQuestions([...final, ...synthesized]).slice(0, options.count);
      } catch (err) {
        logger.error('[QuestionExtraction] Top-up synthesis failed', { err });
      }
    }

    if (!comprehensiveTypeCoverage && final.length < options.count) {
      warnings.push(`Found ${final.length} of the ${options.count} requested question(s) in the uploaded content.`);
    }
    return { extracted: final, warnings, topics: derivedTopics };
  },

  /** Writes brand-new questions for a module/marks-value gap the bank can't fill from existing
   *  content. Called by the paper generator; never blocks on "not enough content". */
  async synthesizeQuestions(
    req: {
      batch: string; track: string; trainingModuleName: string; marks: number; count: number;
      questionType?: QuestionKind; difficulty?: QuestionDifficulty; contextText: string; languageComplexity?: LanguageComplexity;
      includeImages?: boolean;
      figures?: ModuleFigure[];
    },
    ctx: AuthContext
  ): Promise<ExtractedQuestionDraft[]> {
    if (!openaiProvider.isAvailable() || req.count <= 0) return [];

    const contextText = req.contextText.slice(0, 6000) || '(no prior questions or uploads yet for this module — use general subject knowledge for this batch/track/module)';
    const figures = req.figures ?? [];

    const batchResults = await runWithConcurrency(splitIntoBatches(req.count), CHUNK_CONCURRENCY, (batchSize) =>
      completeQuestionsWithRetry(
        (count) => ({
          systemPrompt: buildSynthesisPrompt(req.batch, req.track, req.trainingModuleName, req.marks, count, req.questionType, req.difficulty, req.languageComplexity, req.includeImages, figures.map((f) => f.figure)),
          userPrompt: `Reference material for this training module:\n\n${contextText}`,
        }),
        batchSize,
        ctx
      )
    );

    const extracted = dedupeQuestions(batchResults.flatMap((r) => r.extracted)).slice(0, req.count);
    const figureSourceMap = new Map(figures.map((f) => [f.figure.figureId, f.sourceId]));
    return extracted.map((q) => ({
      ...q,
      marks: req.marks,
      trainingModuleName: req.trainingModuleName,
      questionType: req.questionType ?? q.questionType,
      difficulty: req.difficulty ?? q.difficulty,
      imageRef: q.imageRef && figureSourceMap.has(q.imageRef.figureId) ? { ...q.imageRef, sourceId: figureSourceMap.get(q.imageRef.figureId)! } : undefined,
    }));
  },

  async enqueueExtractFromImage(
    batch: string, track: string, trainingModuleName: string, imageDataUri: string, ctx: AuthContext, fileName?: string, detectImages = false
  ): Promise<{ jobId: string }> {
    const job = await extractionJobRepository.create({ instituteId: ctx.instituteId, userId: ctx.userId, kind: 'image' });
    const jobId = job._id.toString();

    questionExtractionService.extractFromImage(batch, track, trainingModuleName, imageDataUri, ctx, fileName, detectImages)
      .then((result) => extractionJobRepository.markCompleted(jobId, result))
      .catch((err) => {
        logger.error('[QuestionExtraction] Background image extraction failed', { jobId, err });
        extractionJobRepository.markFailed(jobId, toUserSafeErrorMessage(err)).catch(() => {});
      });

    return { jobId };
  },

  async enqueueExtractFromPdf(
    batch: string, track: string, trainingModuleName: string, pdfBuffer: Buffer, ctx: AuthContext, fileName?: string
  ): Promise<{ jobId: string }> {
    const job = await extractionJobRepository.create({ instituteId: ctx.instituteId, userId: ctx.userId, kind: 'pdf_text' });
    const jobId = job._id.toString();

    questionExtractionService.extractFromPdf(batch, track, trainingModuleName, pdfBuffer, ctx, fileName)
      .then((result) => extractionJobRepository.markCompleted(jobId, result))
      .catch((err) => {
        logger.error('[QuestionExtraction] Background PDF extraction failed', { jobId, err });
        extractionJobRepository.markFailed(jobId, toUserSafeErrorMessage(err)).catch(() => {});
      });

    return { jobId };
  },

  async enqueueReExtractFromSource(source: IBankQuestionSource, options: QuestionGenerationOptions, ctx: AuthContext): Promise<{ jobId: string }> {
    const job = await extractionJobRepository.create({ instituteId: ctx.instituteId, userId: ctx.userId, kind: source.kind });
    const jobId = job._id.toString();

    questionExtractionService.extractFromSourceText(source, options, ctx)
      .then((result) => extractionJobRepository.markCompleted(jobId, result))
      .catch((err) => {
        logger.error('[QuestionExtraction] Background re-extraction failed', { jobId, err });
        extractionJobRepository.markFailed(jobId, toUserSafeErrorMessage(err)).catch(() => {});
      });

    return { jobId };
  },

  async getExtractionJob(
    jobId: string, ctx: AuthContext
  ): Promise<{ status: string; result?: TextExtractionResult | QuestionExtractionResult | ModuleCaptureJobResult; error?: string; totalPages?: number; completedPages?: number }> {
    const job = await extractionJobRepository.findById(jobId, ctx.instituteId);
    if (!job) throw new ValidationError('Extraction job not found or expired');
    if (job.userId !== ctx.userId) throw new ValidationError('Extraction job not found or expired');
    return { status: job.status, result: job.result, error: job.error, totalPages: job.totalPages, completedPages: job.completedPages };
  },

  // ── Multi-page module capture ─────────────────────────────────────────────────
  // Each page goes straight from photo to question drafts in one vision call — no separate
  // "transcribe now, structure later" pass and no faculty-facing OCR-text review step.

  /** Single-page vision call — the building block enqueueChapterCapture and retryPage both use. */
  async extractStructuredPage(
    batch: string, track: string, imageDataUri: string, ctx: AuthContext, detectImages = false, pageNumber = 1, requestTopics = false
  ): Promise<{ blocks: ContentBlock[]; figures: PageFigure[]; imageDataUri: string; questions: ExtractedQuestionDraft[]; warnings: string[]; topics?: RawTopicNode[] }> {
    if (!openaiProvider.isAvailable()) {
      throw new ValidationError('AI extraction is not configured on this server.');
    }
    const { pageText, figures, extracted, warnings, topics } = await completeDirectExtractionWithRetry(
      (count) => ({
        systemPrompt: buildDirectExtractionPrompt(batch, track, { count, difficulty: 'mixed', detectImages, requestTopics, comprehensiveTypeCoverage: true }),
        userPrompt: 'Read this photographed page and extract questions from it.',
      }),
      COMPREHENSIVE_COVERAGE_TARGET, ctx, imageDataUri, pageNumber
    );
    return { blocks: textToParagraphBlocks(pageText), figures, imageDataUri, questions: extracted, warnings, topics };
  },

  /** Enqueues a multi-page batch job (kind: 'chapter_capture'). Pages are processed with bounded
   *  concurrency (3 at a time). One page's failure never fails the whole job. Once every page is
   *  done, the batch is auto-saved as a permanent BankQuestionSource and its merged question
   *  drafts land in the job result. */
  async enqueueChapterCapture(
    batch: string, track: string, trainingModuleName: string | undefined,
    images: { dataUri: string; fileName?: string }[], ctx: AuthContext, detectImages = false
  ): Promise<{ jobId: string }> {
    const totalPages = images.length;
    const job = await extractionJobRepository.create({ instituteId: ctx.instituteId, userId: ctx.userId, kind: 'chapter_capture', totalPages, batch, track, trainingModuleName });
    const jobId = job._id.toString();

    (async () => {
      const pages: ModulePage[] = new Array(totalPages);
      const pageQuestions: ExtractedQuestionDraft[][] = new Array(totalPages).fill([]);
      let completed = 0;
      let derivedTopics: RawTopicNode[] | undefined;
      const CONCURRENCY = 3;

      const processOne = async (index: number) => {
        const pageNumber = index + 1;
        try {
          const page = await questionExtractionService.extractStructuredPage(batch, track, images[index].dataUri, ctx, detectImages, pageNumber, pageNumber === 1);
          const lowConfidenceBlocks = page.blocks.filter((b) => b.confidence === 'low').length;

          let pageImageFileId: string | undefined;
          if (detectImages && page.figures.length > 0) {
            const [, base64] = page.imageDataUri.split(',', 2);
            const contentTypeMatch = /^data:([^;]+);/.exec(page.imageDataUri);
            pageImageFileId = await saveImage(Buffer.from(base64 ?? '', 'base64'), {
              instituteId: ctx.instituteId,
              contentType: contentTypeMatch?.[1] ?? 'image/jpeg',
            });
          }

          pages[index] = {
            pageNumber,
            blocks: page.blocks,
            confidence: page.blocks.length === 0 ? 'low' : lowConfidenceBlocks > page.blocks.length / 2 ? 'review' : undefined,
            ...(pageImageFileId ? { pageImageFileId, figures: page.figures } : {}),
          };
          pageQuestions[index] = page.questions;
          if (pageNumber === 1 && page.topics) derivedTopics = page.topics;
        } catch (err) {
          logger.error('[QuestionExtraction] Module capture page failed', { jobId, pageNumber, err });
          pages[index] = { pageNumber, blocks: [], pageError: toUserSafeErrorMessage(err) };
        } finally {
          completed += 1;
          await extractionJobRepository.updateProgress(jobId, completed, { documentTitle: undefined, language: undefined, pages: pages.filter(Boolean), totalPages, completedPages: completed });
        }
      };

      for (let i = 0; i < images.length; i += CONCURRENCY) {
        await Promise.all(images.slice(i, i + CONCURRENCY).map((_, offset) => processOne(i + offset)));
      }

      const { questions, warnings, sourceId } = await finalizeChapterCapture(batch, track, trainingModuleName, pages, pageQuestions.flat(), derivedTopics, ctx);
      await extractionJobRepository.markCompleted(jobId, { pages, totalPages, completedPages: completed, questions, warnings, sourceId });
    })().catch((err) => {
      logger.error('[QuestionExtraction] Module capture batch failed', { jobId, err });
      extractionJobRepository.markFailed(jobId, toUserSafeErrorMessage(err)).catch(() => {});
    });

    return { jobId };
  },

  /** Reprocesses a single page in-place on an already-completed module-capture job. */
  async retryPage(jobId: string, pageNumber: number, imageDataUri: string, ctx: AuthContext): Promise<ModuleCaptureJobResult> {
    const job = await extractionJobRepository.findById(jobId, ctx.instituteId);
    if (!job || job.userId !== ctx.userId || job.kind !== 'chapter_capture') {
      throw new ValidationError('Module capture job not found or expired');
    }
    const current = (job.result as ModuleCaptureJobResult) ?? { pages: [], totalPages: job.totalPages ?? 0, completedPages: job.completedPages ?? 0 };
    const page = await questionExtractionService.extractStructuredPage(job.batch ?? '', job.track ?? '', imageDataUri, ctx, false, pageNumber);
    const updatedPages = current.pages.map((p) => (p.pageNumber === pageNumber ? { pageNumber, blocks: page.blocks } : p));
    if (!updatedPages.some((p) => p.pageNumber === pageNumber)) updatedPages.push({ pageNumber, blocks: page.blocks });
    updatedPages.sort((a, b) => a.pageNumber - b.pageNumber);

    const questions = dedupeQuestions([...(current.questions ?? []), ...page.questions]);
    const updated: ModuleCaptureJobResult = { ...current, pages: updatedPages, questions };
    await extractionJobRepository.markCompleted(jobId, updated);
    return updated;
  },

  /** Legacy manual "Save Module" path — finalizeChapterCapture now does this automatically as
   *  part of enqueueChapterCapture, but this stays available for any caller that hands over
   *  already-reviewed pages directly. */
  async saveChapterSource(
    batch: string, track: string, data: { documentTitle?: string; language?: string; pages: ModulePage[]; fileName?: string; trainingModuleName?: string }, ctx: AuthContext
  ): Promise<IBankQuestionSource> {
    const allBlocks = data.pages.flatMap((p) => p.blocks);
    const extractedText = flattenBlocksToText(allBlocks);
    if (!extractedText.trim()) {
      throw new ValidationError('This training module has no readable content to save — check the captured pages.');
    }

    const source = await bankQuestionSourceRepository.create({
      instituteId: ctx.instituteId, userId: ctx.userId, batch, track, kind: 'image', fileName: data.fileName,
      extractedText, documentTitle: data.documentTitle, language: data.language, pages: data.pages,
      trainingModuleName: data.trainingModuleName, reviewStatus: 'saved',
    });

    if (data.trainingModuleName?.trim()) {
      await trainingModuleRecordRepository.findOrCreate(ctx.instituteId, batch, track, data.trainingModuleName.trim());
    }

    return source;
  },
};

/** Finishes a module-capture batch once every page has been read: saves the permanent
 *  BankQuestionSource, and, when the faculty member assigned a module name up front, applies the
 *  same process-once dedup + topic-tree derivation that a single-source re-extraction runs. */
async function finalizeChapterCapture(
  batch: string, track: string, trainingModuleName: string | undefined,
  pages: ModulePage[], allQuestions: ExtractedQuestionDraft[], derivedTopics: RawTopicNode[] | undefined, ctx: AuthContext
): Promise<{ questions: ExtractedQuestionDraft[]; warnings: string[]; sourceId?: string }> {
  const validPages = pages.filter(Boolean);
  const extractedText = flattenBlocksToText(validPages.flatMap((p) => p.blocks));
  const merged = dedupeQuestions(allQuestions);

  if (!extractedText.trim()) {
    return { questions: merged, warnings: ['No readable content was found across the captured pages — check that at least one page processed successfully.'] };
  }

  const source = await bankQuestionSourceRepository.create({
    instituteId: ctx.instituteId, userId: ctx.userId, batch, track, kind: 'image',
    extractedText, pages: validPages, trainingModuleName: trainingModuleName?.trim() || undefined, reviewStatus: 'saved',
  });
  const sourceId = String(source._id);

  const rebased = trainingModuleName?.trim() ? applyModuleOverride(merged, trainingModuleName) : merged;
  let finalQuestions: ExtractedQuestionDraft[] = rebased.map((q) => ({
    ...q,
    sourceRef: { sourceId },
    imageRef: q.imageRef ? { ...q.imageRef, sourceId } : undefined,
  }));
  let warnings: string[] = [];

  if (trainingModuleName?.trim()) {
    const contentHash = computeContentHash(extractedText);
    const module_ = await trainingModuleRecordRepository.findOrCreate(ctx.instituteId, batch, track, trainingModuleName.trim());

    if (module_.extractionStatus === 'processed' && module_.sourceContentHash === contentHash) {
      logger.info('[QuestionExtraction] Skipping duplicate module-capture save — sourceContentHash unchanged', {
        trainingModuleId: String(module_._id), moduleName: module_.moduleName, instituteId: ctx.instituteId,
      });
      const existing = await bankQuestionRepository.findAll(ctx.instituteId, { trainingModuleId: String(module_._id), limit: 200 });
      finalQuestions = existing.questions.map((q) => ({
        questionText: q.questionText, questionType: q.questionType, options: q.options, correctAnswer: q.correctAnswer,
        difficulty: q.difficulty, marks: q.marks, estimatedTimeMinutes: q.estimatedTimeMinutes, bloomsLevel: q.bloomsLevel,
        keywords: q.keywords, trainingModuleName: q.trainingModuleName, topic: q.topic, topicId: q.topicId, subtopicId: q.subtopicId,
        source: q.source, sourceRef: q.sourceRef, imageRef: q.imageRef, imageRequirement: q.imageRequirement,
      }));
      warnings = ["This training module's content hasn't changed since it was last processed — showing the previously generated questions instead of re-running AI extraction."];
    } else {
      const topicTree = derivedTopics?.length ? buildTopicTree(derivedTopics) : undefined;
      await trainingModuleRecordRepository.markProcessed(String(module_._id), ctx.instituteId, { sourceContentHash: contentHash, topicTree });
      finalQuestions = finalQuestions.map((q) => {
        const { topicId, subtopicId } = topicTree ? matchTopicIds(q.topic, topicTree) : {};
        return { ...q, topicId, subtopicId };
      });
    }
  }

  return { questions: finalQuestions, warnings, sourceId };
}
