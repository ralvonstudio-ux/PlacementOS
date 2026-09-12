import { trainingPlanRepository } from './training-plan.repository';
import { ITrainingPlan, ITrainingPlanDay } from './training-plan.model';
import {
  generateTrainingPlanSchema,
  getWeekPlanSchema,
  getMonthPlanSchema,
  setDayStatusSchema,
  editDaySchema,
  moveDaySchema,
} from './training-plan.validation';
import { NotFoundError, ValidationError, ForbiddenError } from '../../middlewares/errorHandler';
import { AuthContext } from '../../lib/auth-context';
import { User } from '../users/user.model';
import { Faculty } from '../faculty/faculty.model';
import { trainingModuleRepository } from '../module-tracker/module-tracker.repository';
import { trainingScheduleRepository } from '../training-schedule/training-schedule.repository';
import { assertFacultyCanAccessQuestionBank } from '../training-schedule/training-schedule.service';
import { trainingPlanAlertRepository } from './training-plan-alert.repository';
import type {
  TrainingPlan as TrainingPlanApiShape,
  TrainingPlanGenerationResult,
  TrainingPlanTpoOverviewEntry,
  TrainingPlanAlert,
} from '@placementos/types';

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

/** Monday (day 1) of the week containing `date` — Training Schedule uses 1=Mon..6=Sat. */
function mondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun..6=Sat
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

/** dayOfWeek convention used by Training Schedule: 1=Monday..6=Saturday (no Sunday). */
function dayOfWeekFor(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00+05:30`);
  const jsDay = d.getDay(); // 0=Sun..6=Sat
  return jsDay === 0 ? 7 : jsDay; // Sunday -> 7 (never matches 1-6, so always excluded)
}

const toApiShape = (plan: ITrainingPlan): TrainingPlanApiShape => ({
  _id: String((plan as unknown as { _id: { toString(): string } })._id),
  instituteId: plan.instituteId,
  facultyId: plan.facultyId,
  batch: plan.batch,
  track: plan.track,
  weekStartDate: plan.weekStartDate,
  days: plan.days,
  version: plan.version,
  createdAt: new Date(plan.createdAt).toISOString(),
  updatedAt: new Date(plan.updatedAt).toISOString(),
});

export const trainingPlanService = {
  /** Faculty-only: (re)generates the plan for the current week for a batch/track
   *  they teach, distributing the track's Training Modules (in catalog order,
   *  continuing from wherever earlier weeks left off) across the days that
   *  week that Training Schedule actually has a session on. Days a faculty
   *  member has hand-edited are preserved verbatim on regenerate. */
  async generate(rawInput: unknown, ctx: AuthContext): Promise<TrainingPlanGenerationResult> {
    if (ctx.role !== 'faculty') throw new ForbiddenError('Only faculty can generate their own training plan');
    const { batch, track } = generateTrainingPlanSchema.parse(rawInput);
    await assertFacultyCanAccessQuestionBank(ctx, batch, track);

    const facultyId = await resolveFacultyId(ctx);
    const warnings: { message: string }[] = [];

    const weekStart = isoDate(mondayOfWeek(new Date()));
    const weekDates = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)); // Mon..Sat

    const [scheduleEntries, modules, priorPlans, existing] = await Promise.all([
      trainingScheduleRepository.findByFaculty(ctx.instituteId, facultyId),
      trainingModuleRepository.findByTrack(ctx.instituteId, track),
      trainingPlanRepository.findAllForBatchTrack(ctx.instituteId, batch, track),
      trainingPlanRepository.findWeek(ctx.instituteId, facultyId, batch, track, weekStart),
    ]);

    const scheduledWeekdays = new Set(scheduleEntries.filter((e) => e.batch === batch && e.track === track).map((e) => e.dayOfWeek));
    const eligibleDates = weekDates.filter((date) => scheduledWeekdays.has(dayOfWeekFor(date)));

    if (eligibleDates.length === 0) {
      warnings.push({ message: 'No Training Schedule sessions found for this batch/track this week — nothing to plan.' });
    }
    if (modules.length === 0) {
      warnings.push({ message: 'No training modules exist for this track yet — add modules before generating a plan.' });
    }

    // Modules already assigned in any earlier week for this batch/track — skip
    // them so a fresh week continues the syllabus instead of repeating it.
    const usedModuleIds = new Set<string>();
    for (const plan of priorPlans) {
      if (plan.weekStartDate >= weekStart) continue; // only strictly earlier weeks count as "already covered"
      for (const day of plan.days) {
        if (day.moduleId) usedModuleIds.add(day.moduleId);
      }
    }
    const remainingModules = modules.filter((m) => !usedModuleIds.has(String((m as unknown as { _id: { toString(): string } })._id)));

    const existingByDate = new Map((existing?.days ?? []).map((d) => [d.date, d]));

    let moduleCursor = 0;
    const days: ITrainingPlanDay[] = eligibleDates.map((date) => {
      const preserved = existingByDate.get(date);
      if (preserved?.manuallyEdited) return preserved;

      const module_ = remainingModules[moduleCursor];
      if (module_) {
        moduleCursor += 1;
        const moduleId = String((module_ as unknown as { _id: { toString(): string } })._id);
        return {
          date,
          blockType: 'module',
          moduleId,
          moduleName: module_.name,
          title: module_.name,
          status: preserved?.status ?? 'planned',
        } as ITrainingPlanDay;
      }
      return {
        date,
        blockType: 'other',
        title: 'No module scheduled — revision / buffer session',
        status: preserved?.status ?? 'planned',
      } as ITrainingPlanDay;
    });

    if (remainingModules.length > days.length) {
      warnings.push({ message: `${remainingModules.length - days.length} module(s) will roll over to next week — not enough sessions this week.` });
    }

    const plan = await trainingPlanRepository.upsertWeek(ctx.instituteId, facultyId, batch, track, weekStart, days);
    return { plan: toApiShape(plan), warnings };
  },

  async getWeek(rawQuery: unknown, ctx: AuthContext): Promise<TrainingPlanApiShape | null> {
    const { batch, track, weekStartDate, facultyId: queryFacultyId } = getWeekPlanSchema.parse(rawQuery);

    let facultyId = queryFacultyId;
    if (ctx.role === 'faculty') {
      facultyId = await resolveFacultyId(ctx);
      await assertFacultyCanAccessQuestionBank(ctx, batch, track);
    } else if (!facultyId) {
      throw new ValidationError('facultyId is required for admin/TPO views');
    }

    const weekStart = weekStartDate ?? isoDate(mondayOfWeek(new Date()));
    const plan = await trainingPlanRepository.findWeek(ctx.instituteId, facultyId!, batch, track, weekStart);
    return plan ? toApiShape(plan) : null;
  },

  /** TPO/admin view of one specific faculty member's current-week plan for a batch/track. */
  async getForFaculty(facultyId: string, rawQuery: unknown, ctx: AuthContext): Promise<TrainingPlanApiShape | null> {
    if (ctx.role === 'faculty') throw new ForbiddenError('Faculty should use their own plan view');
    const { batch, track, weekStartDate } = getWeekPlanSchema.parse({ ...(rawQuery as Record<string, unknown>), facultyId });
    const weekStart = weekStartDate ?? isoDate(mondayOfWeek(new Date()));
    const plan = await trainingPlanRepository.findWeek(ctx.instituteId, facultyId, batch, track, weekStart);
    return plan ? toApiShape(plan) : null;
  },

  /** Condensed per-week rollup for a whole month — backs the Month tab. */
  async getMonth(rawQuery: unknown, ctx: AuthContext): Promise<{ weekStartDate: string; totalDays: number; completedDays: number }[]> {
    const { batch, track, month } = getMonthPlanSchema.parse(rawQuery);
    if (ctx.role === 'faculty') await assertFacultyCanAccessQuestionBank(ctx, batch, track);

    const from = `${month}-01`;
    const to = `${month}-31`;
    const plans = await trainingPlanRepository.findWeeksInRange(ctx.instituteId, batch, track, from, to);

    return plans.map((plan) => ({
      weekStartDate: plan.weekStartDate,
      totalDays: plan.days.length,
      completedDays: plan.days.filter((d) => d.status === 'completed').length,
    }));
  },

  async setDayStatus(planId: string, rawInput: unknown, ctx: AuthContext): Promise<TrainingPlanApiShape> {
    const { date, status } = setDayStatusSchema.parse(rawInput);
    const plan = await trainingPlanRepository.findById(planId, ctx.instituteId);
    if (!plan) throw new NotFoundError('Training plan');
    if (ctx.role === 'faculty') await assertFacultyCanAccessQuestionBank(ctx, plan.batch, plan.track);

    const day = plan.days.find((d) => d.date === date);
    if (!day) throw new NotFoundError('Training plan day');
    day.status = status;

    const saved = await trainingPlanRepository.save(plan);
    return toApiShape(saved);
  },

  async editDay(planId: string, rawInput: unknown, ctx: AuthContext): Promise<TrainingPlanApiShape> {
    const input = editDaySchema.parse(rawInput);
    const plan = await trainingPlanRepository.findById(planId, ctx.instituteId);
    if (!plan) throw new NotFoundError('Training plan');
    if (ctx.role === 'faculty') await assertFacultyCanAccessQuestionBank(ctx, plan.batch, plan.track);

    const day = plan.days.find((d) => d.date === input.date);
    if (!day) throw new NotFoundError('Training plan day');

    if (input.moduleId !== undefined) day.moduleId = input.moduleId;
    if (input.moduleName !== undefined) day.moduleName = input.moduleName;
    if (input.title !== undefined) day.title = input.title;
    if (input.blockType !== undefined) day.blockType = input.blockType;
    day.manuallyEdited = true;

    const saved = await trainingPlanRepository.save(plan);
    return toApiShape(saved);
  },

  async moveDay(planId: string, rawInput: unknown, ctx: AuthContext): Promise<TrainingPlanApiShape> {
    const { fromDate, toDate } = moveDaySchema.parse(rawInput);
    const plan = await trainingPlanRepository.findById(planId, ctx.instituteId);
    if (!plan) throw new NotFoundError('Training plan');
    if (ctx.role === 'faculty') await assertFacultyCanAccessQuestionBank(ctx, plan.batch, plan.track);

    const sourceIndex = plan.days.findIndex((d) => d.date === fromDate);
    if (sourceIndex === -1) throw new NotFoundError('Training plan day (fromDate)');

    const targetIndex = plan.days.findIndex((d) => d.date === toDate);
    if (targetIndex === -1) throw new NotFoundError('Training plan day (toDate) — target date is not part of this plan');

    const moved = { ...plan.days[sourceIndex], date: toDate, carriedFromDate: fromDate, manuallyEdited: true };
    const displaced = { ...plan.days[targetIndex], date: fromDate, manuallyEdited: true };
    plan.days[sourceIndex] = displaced;
    plan.days[targetIndex] = moved;

    const saved = await trainingPlanRepository.save(plan);
    return toApiShape(saved);
  },

  /** TPO read-only oversight — one row per faculty+batch+track with a plan. */
  async getTpoOverview(ctx: AuthContext): Promise<TrainingPlanTpoOverviewEntry[]> {
    const plans = await trainingPlanRepository.findLatestPerFacultyBatchTrack(ctx.instituteId);
    const facultyIds = [...new Set(plans.map((p) => p.facultyId))];
    const facultyDocs = facultyIds.length
      ? await Faculty.find({ _id: { $in: facultyIds } }).select('fullName').lean<{ _id: unknown; fullName: string }[]>()
      : [];
    const nameById = new Map(facultyDocs.map((f) => [String(f._id), f.fullName]));

    return plans
      .map((plan) => ({
        facultyId: plan.facultyId,
        facultyName: nameById.get(plan.facultyId) ?? 'Unknown',
        batch: plan.batch,
        track: plan.track,
        hasPlan: true,
        totalDays: plan.days.length,
        completedDays: plan.days.filter((d) => d.status === 'completed').length,
      }))
      .sort((a, b) => a.facultyName.localeCompare(b.facultyName));
  },

  /** Computed live from Training Schedule + TrainingPlan state — no cron/stored-alert
   *  infrastructure exists in PlacementOS's scope, so this recomputes on every read and
   *  filters out anything the TPO has already dismissed this week (see training-plan-alert.repository). */
  async getAlerts(ctx: AuthContext): Promise<TrainingPlanAlert[]> {
    const dismissed = await trainingPlanAlertRepository.findDismissedIds(ctx.instituteId);
    const all = await computeAlerts(ctx);
    return all.filter((a) => !dismissed.has(a._id));
  },

  async resolveAlert(alertId: string, ctx: AuthContext): Promise<TrainingPlanAlert | null> {
    const all = await computeAlerts(ctx);
    const alert = all.find((a) => a._id === alertId) ?? null;
    await trainingPlanAlertRepository.dismiss(ctx.instituteId, alertId);
    return alert;
  },
};

/** Every currently-true alert condition, unfiltered by dismissal state — shared by getAlerts
 *  (which filters) and resolveAlert (which needs the full alert to hand back to the caller). */
async function computeAlerts(ctx: AuthContext): Promise<TrainingPlanAlert[]> {
  {
    const weekStart = isoDate(mondayOfWeek(new Date()));
    const todayWeekday = dayOfWeekFor(isoDate(new Date())); // 1=Mon..6=Sat, 7=Sun

    const schedule = await trainingScheduleRepository.findAll(ctx.instituteId, { limit: 1000 });

    const combos = new Map<string, { facultyId: string; batch: string; track: string }>();
    for (const entry of schedule.data) {
      const key = `${entry.facultyId}::${entry.batch}::${entry.track}`;
      if (!combos.has(key)) combos.set(key, { facultyId: entry.facultyId, batch: entry.batch, track: entry.track });
    }

    const facultyIds = [...new Set([...combos.values()].map((c) => c.facultyId))];
    const facultyDocs = facultyIds.length
      ? await Faculty.find({ _id: { $in: facultyIds } }).select('fullName').lean<{ _id: unknown; fullName: string }[]>()
      : [];
    const nameById = new Map(facultyDocs.map((f) => [String(f._id), f.fullName]));

    const alerts: TrainingPlanAlert[] = [];
    for (const combo of combos.values()) {
      const plan = await trainingPlanRepository.findWeek(ctx.instituteId, combo.facultyId, combo.batch, combo.track, weekStart);
      const facultyName = nameById.get(combo.facultyId) ?? 'Unknown';

      if (!plan) {
        const alertId = `${combo.facultyId}:${combo.batch}:${combo.track}:${weekStart}:no_plan`;
        alerts.push({
          _id: alertId,
          instituteId: ctx.instituteId,
          facultyId: combo.facultyId,
          facultyName,
          batch: combo.batch,
          track: combo.track,
          severity: 'critical',
          message: `${facultyName} has not created a training plan for the week of ${weekStart} (${combo.batch} · ${combo.track}).`,
          createdAt: new Date().toISOString(),
        });
        continue;
      }

      const completed = plan.days.filter((d) => d.status === 'completed').length;
      if (completed === 0 && todayWeekday >= 4 && plan.days.length > 0) {
        const alertId = `${combo.facultyId}:${combo.batch}:${combo.track}:${weekStart}:no_progress`;
        alerts.push({
          _id: alertId,
          instituteId: ctx.instituteId,
          facultyId: combo.facultyId,
          facultyName,
          batch: combo.batch,
          track: combo.track,
          severity: 'warning',
          message: `${facultyName} hasn't marked any day complete this week for ${combo.batch} · ${combo.track} (week of ${weekStart}).`,
          createdAt: new Date().toISOString(),
        });
      }
    }

    return alerts;
  }
}
