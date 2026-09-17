import { openaiProvider } from '../ai/providers/llm/openai.provider';
import { ValidationError } from '../../middlewares/errorHandler';
import { logger } from '../../lib/logger';
import { GenerateTestDraftInput } from './test.validation';
import { ITestQuestionSnapshot, TestQuestionType } from './test.model';

interface RawTestQuestion {
  questionText?: string | null;
  questionType?: string | null;
  options?: string[] | null;
  correctAnswer?: string | null;
  marks?: number | string | null;
}

function buildDraftPrompt(input: GenerateTestDraftInput, mcqCount: number, shortAnswerCount: number): string {
  return `You are an experienced examiner writing a test titled "${input.title}"${input.track ? ` for track "${input.track}"` : ''}, on the topic "${input.topic}", based on the content below (from "${input.contentName}").

Content:
"""
${input.sourceContent.slice(0, 12000)}
"""

Write EXACTLY ${mcqCount} multiple-choice question(s) and EXACTLY ${shortAnswerCount} short-answer question(s), all grounded in the content above, covering it evenly.

For every question return:
- "questionText": the question
- "questionType": "mcq" or "short_answer"
- "options": for "mcq" only — exactly 4 option strings
- "correctAnswer": for "mcq", must exactly match one of the options; for "short_answer", a concise model answer used as a grading reference
- "marks": an integer 1-5 reflecting the question's difficulty/depth

Return ONLY a valid JSON object: {"questions": [...]}, with exactly ${mcqCount + shortAnswerCount} entries total (${mcqCount} mcq then ${shortAnswerCount} short_answer, in that order). No markdown, no explanation.`;
}

function buildReviewPrompt(input: GenerateTestDraftInput, questions: ITestQuestionSnapshot[]): string {
  const summary = questions.map((q, i) => `${i + 1}. [${q.questionType}, ${q.marks} marks] ${q.questionText}`).join('\n');
  return `You just drafted a test titled "${input.title}" (topic: "${input.topic}") with ${questions.length} questions from the source content below. Write a short review (3-5 sentences) for the faculty member about to submit this for approval: comment on topic coverage against the source content, the mix of question types/marks, and flag anything worth double-checking before it goes to review. Be specific and concise.

Source content:
"""
${input.sourceContent.slice(0, 6000)}
"""

Drafted questions:
${summary}

Return plain text only — no markdown headers, no JSON.`;
}

function parseQuestions(raw: string): RawTestQuestion[] {
  try {
    const body = JSON.parse(raw);
    const questions = Array.isArray(body) ? body : body.questions;
    return Array.isArray(questions) ? questions : [];
  } catch (err) {
    logger.error('[TestGenerator] Failed to parse AI response', { error: String(err), raw: raw.slice(0, 500) });
    throw new ValidationError('Could not draft the test — try again.');
  }
}

function cleanQuestions(raw: RawTestQuestion[]): ITestQuestionSnapshot[] {
  return raw
    .filter((q) => q.questionText?.trim())
    .map((q) => {
      const marksNum = typeof q.marks === 'string' ? Number(q.marks) : q.marks;
      const questionType: TestQuestionType = q.questionType === 'mcq' ? 'mcq' : 'short_answer';
      const options = questionType === 'mcq' && Array.isArray(q.options) ? q.options.filter((o) => o?.trim()) : undefined;
      return {
        questionText: q.questionText!.trim(),
        questionType,
        options: options && options.length >= 2 ? options : undefined,
        correctAnswer: q.correctAnswer?.trim() || undefined,
        marks: typeof marksNum === 'number' && !Number.isNaN(marksNum) && marksNum > 0 ? marksNum : 1,
      };
    })
    .filter((q) => q.questionType !== 'mcq' || (q.options && q.options.length >= 2));
}

export const testGeneratorService = {
  async generateDraft(input: GenerateTestDraftInput): Promise<{ questions: ITestQuestionSnapshot[]; aiReview: string }> {
    if (!openaiProvider.isAvailable()) throw new ValidationError('AI drafting is not configured on this server.');

    const wanted = input.mcqCount + input.shortAnswerCount;
    let questions: ITestQuestionSnapshot[] = [];
    for (let attempt = 0; attempt < 2 && questions.length !== wanted; attempt++) {
      const result = await openaiProvider.complete({
        systemPrompt: buildDraftPrompt(input, input.mcqCount, input.shortAnswerCount),
        userPrompt: attempt === 0 ? 'Write the questions.' : `You returned ${questions.length} question(s) last time — return exactly ${wanted} (${input.mcqCount} mcq + ${input.shortAnswerCount} short_answer), no more, no fewer.`,
        temperature: 0.5,
        maxTokens: 3500,
        jsonResponse: true,
      });
      questions = cleanQuestions(parseQuestions(result.content));
    }

    if (questions.length === 0) throw new ValidationError('The AI could not draft a test from this content — try adding more detail.');

    let aiReview = '';
    try {
      const reviewResult = await openaiProvider.complete({
        systemPrompt: buildReviewPrompt(input, questions),
        userPrompt: 'Write the review.',
        temperature: 0.3,
        maxTokens: 400,
      });
      aiReview = reviewResult.content.trim();
    } catch (err) {
      logger.error('[TestGenerator] AI review generation failed — continuing without it', { error: String(err) });
    }

    return { questions, aiReview };
  },
};
