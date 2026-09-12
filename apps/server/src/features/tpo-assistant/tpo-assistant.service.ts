import { openaiProvider } from '../ai/providers/llm/openai.provider';
import { chatSchema } from './tpo-assistant.validation';
import { classifyIntent, UNSUPPORTED_INTENT, IntentDefinition } from './intent-router';
import { attendanceIntents } from './tpo-assistant.intents';
import { tpoAssistantData } from './tpo-assistant.data';
import { buildFormattingSystemPrompt } from './tpo-assistant.prompts';
import { AuthContext } from '../../lib/auth-context';
import { AppError } from '../../middlewares/errorHandler';
import { logger } from '../../lib/logger';
import type { BatchTrackAttendanceList } from './tpo-assistant.data';

const UNSUPPORTED_REPLY =
  "I'm currently able to help with attendance questions only — things like today's attendance " +
  'summary, present/absent counts, or the highest/lowest attendance batch or track. Could you ' +
  'rephrase your question around attendance?';

const ATTENDANCE_SCOPE_QUESTION = "Would you like to see today's attendance for candidates, faculty, or both?";
const ATTENDANCE_SCOPE_REPLIES: Record<string, 'candidates' | 'faculty' | 'both'> = {
  candidates: 'candidates', candidate: 'candidates', batch: 'candidates', batches: 'candidates',
  faculty: 'faculty', teachers: 'faculty', teacher: 'faculty',
  both: 'both',
};

/** Plain, deterministic formatting — no LLM pass — so the reply is always exactly as terse as the
 *  TPO asked for. */
function formatBatchList(data: BatchTrackAttendanceList): string {
  if (!data.batches.length) return 'No attendance has been marked for any batch yet today.';
  return data.batches.map((b) => `${b.batch} (${b.track}): ${b.present} present, ${b.absent} absent`).join('\n');
}

async function buildAttendanceScopeReply(scope: 'candidates' | 'faculty' | 'both', ctx: AuthContext): Promise<string> {
  if (scope === 'candidates') {
    return formatBatchList(await tpoAssistantData.getBatchTrackAttendanceList(ctx));
  }
  if (scope === 'faculty') {
    const faculty = await tpoAssistantData.getFacultyCounts(ctx);
    return `${faculty.facultyPresent}/${faculty.facultyTotal} faculty members present today.`;
  }
  const [batches, faculty] = await Promise.all([
    tpoAssistantData.getBatchTrackAttendanceList(ctx),
    tpoAssistantData.getFacultyCounts(ctx),
  ]);
  return `${formatBatchList(batches)}\n\nFaculty: ${faculty.facultyPresent}/${faculty.facultyTotal} present.`;
}

const allIntents: IntentDefinition<AuthContext, unknown>[] = [...attendanceIntents];

export interface ChatResult {
  reply: string;
  quickReplies?: string[];
}

export const tpoAssistantService = {
  async chat(rawInput: unknown, ctx: AuthContext): Promise<ChatResult> {
    const { message } = chatSchema.parse(rawInput);

    if (!openaiProvider.isAvailable()) {
      throw new AppError('AI Assistant is not configured. Please contact your administrator.', 503, 'AI_UNAVAILABLE');
    }

    // A one-word reply to our own "candidates, faculty, or both?" follow-up (typed or tapped as a
    // quick-reply chip) is answered directly, deterministically, without another LLM round trip.
    const scope = ATTENDANCE_SCOPE_REPLIES[message.trim().toLowerCase()];
    if (scope) {
      return { reply: await buildAttendanceScopeReply(scope, ctx) };
    }

    const { intentId } = await classifyIntent(message, 'Attendance', allIntents);

    if (intentId === UNSUPPORTED_INTENT) {
      logger.info('[TpoAssistant] Unsupported intent', { instituteId: ctx.instituteId, message });
      return { reply: UNSUPPORTED_REPLY };
    }

    const intent = allIntents.find((i) => i.id === intentId);
    if (!intent) {
      return { reply: UNSUPPORTED_REPLY };
    }

    // A generic "today's attendance" ask is answered with a short scope question instead of one
    // long narrative covering candidates, faculty, and batch extremes all at once.
    if (intentId === 'ATTENDANCE_SUMMARY') {
      return { reply: ATTENDANCE_SCOPE_QUESTION, quickReplies: ['Candidates', 'Faculty', 'Both'] };
    }

    const data = await intent.fetchData(ctx);
    const userPrompt = `Data (JSON):\n${JSON.stringify(data, null, 2)}\n\nTPO's question: ${message}`;

    const result = await openaiProvider.complete({
      systemPrompt: buildFormattingSystemPrompt(),
      userPrompt,
      temperature: 0.4,
      maxTokens: 300,
    });

    logger.info('[TpoAssistant] Chat answered', { instituteId: ctx.instituteId, userId: ctx.userId, intent: intentId });

    return { reply: result.content.trim() };
  },
};
