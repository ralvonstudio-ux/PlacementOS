import { academicPlanRepository } from './academic-plan.repository';
import { IAcademicPlan, IAcademicPlanSession } from './academic-plan.model';
import {
  generateAcademicPlanSchema, getAcademicPlanSchema, editSessionSchema, addSessionSchema, reorderSessionsSchema,
} from './academic-plan.validation';
import { NotFoundError, ValidationError, ForbiddenError } from '../../middlewares/errorHandler';
import { AuthContext } from '../../lib/auth-context';
import { User } from '../users/user.model';
import { Faculty } from '../faculty/faculty.model';
import { assertFacultyCanAccessQuestionBank } from '../training-schedule/training-schedule.service';
import { openaiProvider } from '../ai/providers/llm/openai.provider';
import { logger } from '../../lib/logger';

const MAX_LECTURES_PER_WEEK = 6; // Mon-Sat, matching Training Schedule's convention elsewhere

async function resolveFacultyId(ctx: AuthContext): Promise<string> {
  const user = (await User.findById(ctx.userId).select('email').lean()) as { email?: string } | null;
  if (!user?.email) throw new ForbiddenError('Your account has no email — cannot verify faculty profile');

  const faculty = (await Faculty.findOne({ instituteId: ctx.instituteId, loginEmail: user.email, isDeleted: false }).select('_id').lean()) as {
    _id: { toString(): string };
  } | null;
  if (!faculty) throw new ForbiddenError('Faculty profile not found');

  return String(faculty._id);
}

function isoDate(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function mondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00+05:30`);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

interface RawLecture {
  title?: string | null;
  description?: string | null;
}

function buildPlanningPrompt(syllabusText: string, count: number, track: string): string {
  return `You are an experienced academic coordinator planning a teaching schedule for the track "${track}".

Below is the syllabus content to plan from:
"""
${syllabusText.slice(0, 12000)}
"""

Break this syllabus into EXACTLY ${count} sequential lecture sessions, in the order they should be taught. Each session should be a coherent, teachable chunk — split large topics across multiple lectures and combine small ones, so the ${count} sessions together cover the whole syllabus evenly (no session should be trivially short or unreasonably packed).

For each session return:
- "title": a short lecture title (topic/chapter name, under 60 characters)
- "description": one or two sentences on what's covered in this specific lecture

Return ONLY a valid JSON object: {"lectures": [{"title": "...", "description": "..."}, ...]} with exactly ${count} entries, in teaching order. No markdown, no explanation.`;
}

function parseLectures(raw: string): RawLecture[] {
  try {
    const body = JSON.parse(raw);
    const lectures = Array.isArray(body) ? body : body.lectures;
    return Array.isArray(lectures) ? lectures : [];
  } catch (err) {
    logger.error('[AcademicPlan] Failed to parse AI response', { error: String(err), raw: raw.slice(0, 500) });
    throw new ValidationError('Could not plan the syllabus — try again.');
  }
}

/** Splits `totalLectures` as evenly as possible across `totalWeeks` bins — the first
 *  `remainder` weeks get one extra lecture rather than front-loading everything into
 *  the earliest weeks and leaving the last week empty. */
function distributeAcrossWeeks(totalLectures: number, totalWeeks: number): number[] {
  const base = Math.floor(totalLectures / totalWeeks);
  const remainder = totalLectures % totalWeeks;
  return Array.from({ length: totalWeeks }, (_, i) => base + (i < remainder ? 1 : 0));
}

const toApiShape = (plan: IAcademicPlan) => ({
  _id: String((plan as unknown as { _id: { toString(): string } })._id),
  instituteId: plan.instituteId,
  facultyId: plan.facultyId,
  batch: plan.batch,
  track: plan.track,
  title: plan.title,
  syllabusText: plan.syllabusText,
  totalLectures: plan.totalLectures,
  totalWeeks: plan.totalWeeks,
  startDate: plan.startDate,
  sessions: plan.sessions,
  version: plan.version,
  createdAt: new Date(plan.createdAt).toISOString(),
  updatedAt: new Date(plan.updatedAt).toISOString(),
});

export const academicPlanService = {
  async generate(rawInput: unknown, ctx: AuthContext) {
    if (ctx.role !== 'faculty') throw new ForbiddenError('Only faculty can generate their own academic plan');
    const input = generateAcademicPlanSchema.parse(rawInput);
    await assertFacultyCanAccessQuestionBank(ctx, input.batch, input.track);

    if (input.totalLectures > input.totalWeeks * MAX_LECTURES_PER_WEEK) {
      throw new ValidationError(`${input.totalLectures} lectures can't fit into ${input.totalWeeks} week(s) at up to ${MAX_LECTURES_PER_WEEK}/week (Mon–Sat) — add more weeks or reduce the lecture count.`);
    }
    if (!openaiProvider.isAvailable()) throw new ValidationError('AI planning is not configured on this server.');

    const facultyId = await resolveFacultyId(ctx);
    const startDate = isoDate(mondayOfWeek(input.startDate ? new Date(`${input.startDate}T00:00:00+05:30`) : new Date()));

    let lectures: RawLecture[] = [];
    for (let attempt = 0; attempt < 2 && lectures.length !== input.totalLectures; attempt++) {
      const result = await openaiProvider.complete({
        systemPrompt: buildPlanningPrompt(input.syllabusText, input.totalLectures, input.track),
        userPrompt: attempt === 0 ? 'Plan the lectures.' : `You returned ${lectures.length} lectures last time — return exactly ${input.totalLectures}, no more, no fewer.`,
        temperature: 0.4,
        maxTokens: 3000,
        jsonResponse: true,
      });
      lectures = parseLectures(result.content);
    }

    if (lectures.length === 0) throw new ValidationError('The AI could not plan this syllabus — try adding more detail.');

    // Never silently drop content: pad a shortfall with a generic revision session,
    // and fold any excess into the final session rather than truncating real topics.
    if (lectures.length < input.totalLectures) {
      while (lectures.length < input.totalLectures) lectures.push({ title: 'Revision / buffer session', description: 'Recap and doubt-clearing.' });
    } else if (lectures.length > input.totalLectures) {
      lectures = lectures.slice(0, input.totalLectures);
    }

    const perWeek = distributeAcrossWeeks(input.totalLectures, input.totalWeeks);
    const sessions: IAcademicPlanSession[] = [];
    let cursor = 0;
    for (let week = 1; week <= input.totalWeeks; week++) {
      const weekStart = addDays(startDate, (week - 1) * 7);
      const count = perWeek[week - 1];
      for (let dayIdx = 0; dayIdx < count; dayIdx++) {
        const lecture = lectures[cursor];
        // MAX_LECTURES_PER_WEEK is enforced above, so dayIdx never exceeds Mon..Sat (0..5).
        sessions.push({
          lectureNumber: cursor + 1,
          week,
          date: addDays(weekStart, Math.min(dayIdx, MAX_LECTURES_PER_WEEK - 1)),
          title: lecture.title?.trim() || `Lecture ${cursor + 1}`,
          description: lecture.description?.trim() || undefined,
          status: 'planned',
          manuallyEdited: false,
        });
        cursor += 1;
      }
    }

    const plan = await academicPlanRepository.upsert(ctx.instituteId, facultyId, input.batch, input.track, {
      title: input.title?.trim() || `${input.track} — Academic Plan`,
      syllabusText: input.syllabusText,
      totalLectures: input.totalLectures,
      totalWeeks: input.totalWeeks,
      startDate,
      sessions,
      createdBy: ctx.userId,
    });

    return toApiShape(plan);
  },

  async get(rawQuery: unknown, ctx: AuthContext) {
    const { batch, track, facultyId: queryFacultyId } = getAcademicPlanSchema.parse(rawQuery);

    let facultyId = queryFacultyId;
    if (ctx.role === 'faculty') {
      facultyId = await resolveFacultyId(ctx);
      await assertFacultyCanAccessQuestionBank(ctx, batch, track);
    } else if (!facultyId) {
      throw new ValidationError('facultyId is required for admin/TPO views');
    }

    const plan = await academicPlanRepository.findActive(ctx.instituteId, facultyId!, batch, track);
    return plan ? toApiShape(plan) : null;
  },

  async editSession(planId: string, rawInput: unknown, ctx: AuthContext) {
    const input = editSessionSchema.parse(rawInput);
    const plan = await academicPlanRepository.findById(planId, ctx.instituteId);
    if (!plan) throw new NotFoundError('Academic plan');
    if (ctx.role === 'faculty') await assertFacultyCanAccessQuestionBank(ctx, plan.batch, plan.track);

    const session = plan.sessions.find((s) => s.lectureNumber === input.lectureNumber);
    if (!session) throw new NotFoundError('Lecture session');

    if (input.title !== undefined) session.title = input.title;
    if (input.description !== undefined) session.description = input.description;
    if (input.week !== undefined) session.week = input.week;
    if (input.date !== undefined) session.date = input.date;
    if (input.status !== undefined) session.status = input.status;
    session.manuallyEdited = true;

    const saved = await academicPlanRepository.save(plan);
    return toApiShape(saved);
  },

  async addSession(planId: string, rawInput: unknown, ctx: AuthContext) {
    const input = addSessionSchema.parse(rawInput);
    const plan = await academicPlanRepository.findById(planId, ctx.instituteId);
    if (!plan) throw new NotFoundError('Academic plan');
    if (ctx.role === 'faculty') await assertFacultyCanAccessQuestionBank(ctx, plan.batch, plan.track);

    const nextLectureNumber = plan.sessions.reduce((max, s) => Math.max(max, s.lectureNumber), 0) + 1;
    plan.sessions.push({
      lectureNumber: nextLectureNumber,
      week: input.week,
      date: input.date,
      title: input.title,
      description: input.description,
      status: 'planned',
      manuallyEdited: true,
    });
    plan.totalLectures = plan.sessions.length;

    const saved = await academicPlanRepository.save(plan);
    return toApiShape(saved);
  },

  async deleteSession(planId: string, lectureNumber: number, ctx: AuthContext) {
    const plan = await academicPlanRepository.findById(planId, ctx.instituteId);
    if (!plan) throw new NotFoundError('Academic plan');
    if (ctx.role === 'faculty') await assertFacultyCanAccessQuestionBank(ctx, plan.batch, plan.track);

    const before = plan.sessions.length;
    plan.sessions = plan.sessions.filter((s) => s.lectureNumber !== lectureNumber) as typeof plan.sessions;
    if (plan.sessions.length === before) throw new NotFoundError('Lecture session');
    plan.totalLectures = plan.sessions.length;

    const saved = await academicPlanRepository.save(plan);
    return toApiShape(saved);
  },

  async reorderSessions(planId: string, rawInput: unknown, ctx: AuthContext) {
    const { sessions } = reorderSessionsSchema.parse(rawInput);
    const plan = await academicPlanRepository.findById(planId, ctx.instituteId);
    if (!plan) throw new NotFoundError('Academic plan');
    if (ctx.role === 'faculty') await assertFacultyCanAccessQuestionBank(ctx, plan.batch, plan.track);

    const byLecture = new Map(sessions.map((s) => [s.lectureNumber, s]));
    for (const session of plan.sessions) {
      const move = byLecture.get(session.lectureNumber);
      if (move) {
        session.week = move.week;
        session.date = move.date;
        session.manuallyEdited = true;
      }
    }

    const saved = await academicPlanRepository.save(plan);
    return toApiShape(saved);
  },

  async remove(planId: string, ctx: AuthContext): Promise<void> {
    const plan = await academicPlanRepository.findById(planId, ctx.instituteId);
    if (!plan) throw new NotFoundError('Academic plan');
    if (ctx.role === 'faculty') await assertFacultyCanAccessQuestionBank(ctx, plan.batch, plan.track);

    const deleted = await academicPlanRepository.softDelete(planId, ctx.instituteId);
    if (!deleted) throw new NotFoundError('Academic plan');
  },
};
