import {
  placementDriveRepository,
  driveApplicationRepository,
  driveCandidateRepository,
  LeanDrive,
  LeanApplication,
  LeanCandidate,
} from './placement-drive.repository';
import {
  driveSchema,
  updateDriveSchema,
  setDriveStatusSchema,
  recordRoundResultSchema,
  setApplicationStatusSchema,
  statsQuerySchema,
  DriveInput,
} from './placement-drive.validation';
import type { IPlacementDrive, IDriveRoundOutcome } from './placement-drive.model';
import { notificationRepository, CreateNotificationInput } from '../notifications/notification.repository';
import { resolveCandidateId } from '../candidates/candidate.service';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../middlewares/errorHandler';
import { AuthContext } from '../../lib/auth-context';
import type {
  PlacementDrive as DriveApiShape,
  PlacementDriveDetail,
  DriveApplication as ApplicationApiShape,
  DriveApplicationStatus,
  DriveForCandidate,
  DriveJobType,
  PlacementStats,
} from '@placementos/types';

const idOf = (doc: { _id: { toString(): string } }) => String(doc._id);
const iso = (d?: Date) => (d ? new Date(d).toISOString() : undefined);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Internships don't count as a placement — only full-time and PPO-conversion offers do. */
const isPlacingOffer = (jobType: DriveJobType) => jobType !== 'internship';

// ── Shapes ───────────────────────────────────────────────────────────────────

function toDriveShape(d: LeanDrive, counts?: { applicants: number; selected: number }): DriveApiShape {
  return {
    _id: idOf(d),
    companyName: d.companyName,
    companyWebsite: d.companyWebsite,
    roleTitle: d.roleTitle,
    description: d.description,
    jobType: d.jobType,
    ctcLpa: d.ctcLpa,
    stipendPerMonth: d.stipendPerMonth,
    location: d.location,
    eligibility: {
      minCgpa: d.eligibility?.minCgpa,
      maxBacklogs: d.eligibility?.maxBacklogs,
      departments: d.eligibility?.departments ?? [],
      batches: d.eligibility?.batches ?? [],
      placementYears: d.eligibility?.placementYears ?? [],
      excludePlaced: d.eligibility?.excludePlaced ?? true,
    },
    rounds: (d.rounds ?? []).map((r) => ({ name: r.name, type: r.type, scheduledAt: iso(r.scheduledAt) })),
    applicationDeadline: iso(d.applicationDeadline),
    driveDate: iso(d.driveDate),
    status: d.status,
    applicantCount: counts?.applicants ?? 0,
    selectedCount: counts?.selected ?? 0,
    createdAt: iso(d.createdAt)!,
    updatedAt: iso(d.updatedAt)!,
  };
}

function toApplicationShape(a: LeanApplication, c?: LeanCandidate): ApplicationApiShape {
  return {
    _id: idOf(a),
    driveId: a.driveId,
    candidateId: a.candidateId,
    candidateName: c?.fullName ?? 'Unknown student',
    rollNumber: c?.rollNumber ?? '—',
    department: c?.department ?? '—',
    batch: c?.batch ?? '—',
    email: c?.email,
    cgpa: c?.cgpa,
    activeBacklogs: c?.activeBacklogs,
    status: a.status,
    roundResults: (a.roundResults ?? []).map((r) => ({ roundIndex: r.roundIndex, result: r.result, updatedAt: iso(r.updatedAt)! })),
    offerCtcLpa: a.offerCtcLpa,
    appliedAt: iso(a.appliedAt)!,
    updatedAt: iso(a.updatedAt)!,
  };
}

function countsByDrive(apps: LeanApplication[]): Map<string, { applicants: number; selected: number }> {
  const map = new Map<string, { applicants: number; selected: number }>();
  for (const a of apps) {
    const entry = map.get(a.driveId) ?? { applicants: 0, selected: 0 };
    if (a.status !== 'withdrawn') entry.applicants += 1;
    if (a.status === 'selected') entry.selected += 1;
    map.set(a.driveId, entry);
  }
  return map;
}

/** Mongoose-ready drive fields from validated input (date strings → Dates). */
function toDriveDoc(input: Partial<DriveInput>): Partial<IPlacementDrive> {
  const { rounds, applicationDeadline, driveDate, ...rest } = input;
  return {
    ...rest,
    ...(rounds ? { rounds: rounds.map((r) => ({ ...r, scheduledAt: r.scheduledAt ? new Date(r.scheduledAt) : undefined })) } : {}),
    ...('applicationDeadline' in input ? { applicationDeadline: applicationDeadline ? new Date(applicationDeadline) : undefined } : {}),
    ...('driveDate' in input ? { driveDate: driveDate ? new Date(driveDate) : undefined } : {}),
  } as Partial<IPlacementDrive>;
}

// ── Eligibility ──────────────────────────────────────────────────────────────

const inList = (list: string[], value: string) => !list.length || list.some((v) => v.toLowerCase() === value.toLowerCase());

/** Every reason this student can't apply; an empty list means eligible. */
export function ineligibilityReasons(drive: LeanDrive, c: LeanCandidate): string[] {
  const e = drive.eligibility ?? { departments: [], batches: [], placementYears: [], excludePlaced: true };
  const reasons: string[] = [];
  if (c.status === 'inactive') reasons.push('Your student profile is inactive');
  if (!inList(e.departments ?? [], c.department)) reasons.push(`Open to ${e.departments.join(', ')} only`);
  if (!inList(e.batches ?? [], c.batch)) reasons.push(`Open to batch ${e.batches.join(', ')} only`);
  if (!inList(e.placementYears ?? [], c.placementYear)) reasons.push(`Open to the ${e.placementYears.join(', ')} passing year only`);
  if (e.minCgpa !== undefined && e.minCgpa !== null) {
    if (c.cgpa === undefined || c.cgpa === null) reasons.push('Your CGPA is not on record — ask your TPO to update it');
    else if (c.cgpa < e.minCgpa) reasons.push(`Minimum CGPA ${e.minCgpa} (yours: ${c.cgpa})`);
  }
  if (e.maxBacklogs !== undefined && e.maxBacklogs !== null && (c.activeBacklogs ?? 0) > e.maxBacklogs) {
    reasons.push(`At most ${e.maxBacklogs} active backlog${e.maxBacklogs === 1 ? '' : 's'} (yours: ${c.activeBacklogs})`);
  }
  if (e.excludePlaced && c.status === 'placed') reasons.push('You already hold a placement offer');
  return reasons;
}

/** Application status implied by its round outcomes — a rejection or no-show at any round ends it. */
function deriveStatus(results: IDriveRoundOutcome[], current: DriveApplicationStatus): DriveApplicationStatus {
  if (results.some((r) => r.result === 'rejected' || r.result === 'absent')) return 'rejected';
  if (current === 'selected') return 'selected';
  if (results.some((r) => r.result === 'cleared')) return 'shortlisted';
  return 'applied';
}

/** Keeps Candidate.status in step with offers: placed while holding a full-time/PPO offer. */
async function syncPlacedStatus(instituteId: string, candidateIds: string[]): Promise<void> {
  if (!candidateIds.length) return;
  const selected = await driveApplicationRepository.listByStatus(instituteId, 'selected');
  const relevant = selected.filter((a) => candidateIds.includes(a.candidateId));
  const drives = new Map(
    (await Promise.all([...new Set(relevant.map((a) => a.driveId))].map((id) => placementDriveRepository.findById(id, instituteId))))
      .filter((d): d is LeanDrive => !!d)
      .map((d) => [idOf(d), d])
  );
  const placed = new Set(relevant.filter((a) => drives.get(a.driveId) && isPlacingOffer(drives.get(a.driveId)!.jobType)).map((a) => a.candidateId));
  await driveCandidateRepository.setStatus(instituteId, [...placed], 'placed', 'active');
  await driveCandidateRepository.setStatus(instituteId, candidateIds.filter((id) => !placed.has(id)), 'active', 'placed');
}

async function notify(instituteId: string, items: Omit<CreateNotificationInput, 'recipientRole' | 'type'>[]): Promise<void> {
  if (!items.length) return;
  await notificationRepository.createForRecipients(
    instituteId,
    items.map((n) => ({ ...n, recipientRole: 'candidate' as const, type: 'placement_drive' as const }))
  );
}

const packageLabel = (d: LeanDrive) =>
  d.ctcLpa ? `${d.ctcLpa} LPA` : d.stipendPerMonth ? `₹${d.stipendPerMonth.toLocaleString('en-IN')}/month stipend` : '';

// ── Service ──────────────────────────────────────────────────────────────────

export const placementDriveService = {
  async list(ctx: AuthContext): Promise<DriveApiShape[]> {
    const drives = await placementDriveRepository.list(ctx.instituteId);
    const counts = countsByDrive(await driveApplicationRepository.listForDrives(ctx.instituteId, drives.map(idOf)));
    return drives.map((d) => toDriveShape(d, counts.get(idOf(d))));
  },

  async create(rawInput: unknown, ctx: AuthContext): Promise<DriveApiShape> {
    const input = driveSchema.parse(rawInput);
    const drive = await placementDriveRepository.create({ ...toDriveDoc(input), instituteId: ctx.instituteId, status: 'draft', createdBy: ctx.userId });
    return toDriveShape(drive);
  },

  async getDetail(id: string, ctx: AuthContext): Promise<PlacementDriveDetail> {
    const drive = await placementDriveRepository.findById(id, ctx.instituteId);
    if (!drive) throw new NotFoundError('Placement drive');

    const apps = await driveApplicationRepository.listForDrive(ctx.instituteId, id);
    const candidates = await driveCandidateRepository.listActive(ctx.instituteId);
    const byId = new Map(candidates.map((c) => [idOf(c), c]));
    const missing = apps.map((a) => a.candidateId).filter((cid) => !byId.has(cid));
    for (const c of await driveCandidateRepository.findByIds(ctx.instituteId, missing)) byId.set(idOf(c), c);

    const applied = new Set(apps.filter((a) => a.status !== 'withdrawn').map((a) => a.candidateId));
    const eligibleNotApplied = candidates.filter((c) => !applied.has(idOf(c)) && ineligibilityReasons(drive, c).length === 0).length;

    return {
      drive: toDriveShape(drive, countsByDrive(apps).get(id)),
      applications: apps.map((a) => toApplicationShape(a, byId.get(a.candidateId))),
      eligibleNotApplied,
    };
  },

  async update(id: string, rawInput: unknown, ctx: AuthContext): Promise<PlacementDriveDetail> {
    const input = updateDriveSchema.parse(rawInput);
    const drive = await placementDriveRepository.update(id, ctx.instituteId, { ...toDriveDoc(input), updatedBy: ctx.userId });
    if (!drive) throw new NotFoundError('Placement drive');
    return this.getDetail(id, ctx);
  },

  async remove(id: string, ctx: AuthContext): Promise<void> {
    const drive = await placementDriveRepository.findById(id, ctx.instituteId);
    if (!drive) throw new NotFoundError('Placement drive');
    const affected = (await driveApplicationRepository.listForDrive(ctx.instituteId, id)).filter((a) => a.status === 'selected').map((a) => a.candidateId);
    await placementDriveRepository.remove(id, ctx.instituteId);
    await syncPlacedStatus(ctx.instituteId, affected);
  },

  /** Opening a drive for the first time announces it to every eligible student. */
  async setStatus(id: string, rawInput: unknown, ctx: AuthContext): Promise<PlacementDriveDetail> {
    const { status } = setDriveStatusSchema.parse(rawInput);
    const drive = await placementDriveRepository.findById(id, ctx.instituteId);
    if (!drive) throw new NotFoundError('Placement drive');

    const announce = status === 'open' && !drive.announcedAt;
    await placementDriveRepository.update(id, ctx.instituteId, { status, updatedBy: ctx.userId, ...(announce ? { announcedAt: new Date() } : {}) });

    if (announce) {
      const eligible = (await driveCandidateRepository.listActive(ctx.instituteId)).filter((c) => ineligibilityReasons(drive, c).length === 0);
      const deadline = drive.applicationDeadline ? ` Apply by ${new Date(drive.applicationDeadline).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.` : '';
      await notify(
        ctx.instituteId,
        eligible.map((c) => ({
          recipientId: idOf(c),
          title: `New drive: ${drive.companyName} — ${drive.roleTitle}`,
          body: `You're eligible for ${drive.companyName}'s ${drive.roleTitle} drive${packageLabel(drive) ? ` (${packageLabel(drive)})` : ''}.${deadline} Open Placement Drives to apply.`,
        }))
      );
    }
    return this.getDetail(id, ctx);
  },

  async recordRoundResult(id: string, rawInput: unknown, ctx: AuthContext): Promise<PlacementDriveDetail> {
    const input = recordRoundResultSchema.parse(rawInput);
    const drive = await placementDriveRepository.findById(id, ctx.instituteId);
    if (!drive) throw new NotFoundError('Placement drive');
    const round = drive.rounds[input.roundIndex];
    if (!round) throw new ValidationError('That round does not exist on this drive');

    const apps = (await driveApplicationRepository.findByIds(ctx.instituteId, id, input.applicationIds)).filter((a) => a.status !== 'withdrawn');
    const notifications: Omit<CreateNotificationInput, 'recipientRole' | 'type'>[] = [];
    const now = new Date();

    for (const a of apps) {
      const results = (a.roundResults ?? []).filter((r) => r.roundIndex !== input.roundIndex);
      if (input.result !== 'pending') results.push({ roundIndex: input.roundIndex, result: input.result, updatedAt: now });
      results.sort((x, y) => x.roundIndex - y.roundIndex);
      const status = deriveStatus(results, a.status);
      await driveApplicationRepository.update(idOf(a), { roundResults: results, status, updatedBy: ctx.userId }, status === 'selected' ? [] : ['offerCtcLpa']);

      if (input.result === 'cleared') {
        const next = drive.rounds[input.roundIndex + 1];
        notifications.push({
          recipientId: a.candidateId,
          title: `${drive.companyName}: you cleared ${round.name}`,
          body: next ? `Next up: ${next.name}${next.scheduledAt ? ` on ${new Date(next.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}. All the best!` : 'Final results will be announced soon.',
        });
      } else if ((input.result === 'rejected' || input.result === 'absent') && a.status !== 'rejected') {
        notifications.push({
          recipientId: a.candidateId,
          title: `${drive.companyName}: update on your application`,
          body: `You won't be moving forward after ${round.name}${input.result === 'absent' ? ' (marked absent)' : ''}. Keep preparing — more drives are coming.`,
        });
      }
    }

    await notify(ctx.instituteId, notifications);
    await syncPlacedStatus(ctx.instituteId, apps.filter((a) => a.status === 'selected').map((a) => a.candidateId));
    return this.getDetail(id, ctx);
  },

  async setApplicationStatus(id: string, rawInput: unknown, ctx: AuthContext): Promise<PlacementDriveDetail> {
    const input = setApplicationStatusSchema.parse(rawInput);
    const drive = await placementDriveRepository.findById(id, ctx.instituteId);
    if (!drive) throw new NotFoundError('Placement drive');

    const apps = (await driveApplicationRepository.findByIds(ctx.instituteId, id, input.applicationIds)).filter((a) => a.status !== 'withdrawn');
    const offer = input.offerCtcLpa ?? drive.ctcLpa;
    const notifications: Omit<CreateNotificationInput, 'recipientRole' | 'type'>[] = [];

    for (const a of apps) {
      if (input.status === 'selected') {
        await driveApplicationRepository.update(idOf(a), { status: 'selected', ...(offer !== undefined ? { offerCtcLpa: offer } : {}), updatedBy: ctx.userId });
        if (a.status !== 'selected') {
          notifications.push({
            recipientId: a.candidateId,
            title: `Congratulations! Selected at ${drive.companyName}`,
            body: `You've been selected for ${drive.roleTitle} at ${drive.companyName}${offer ? ` with a ${offer} LPA offer` : ''}. Your TPO will share the next steps.`,
            priority: 'high',
          });
        }
      } else {
        await driveApplicationRepository.update(idOf(a), { status: input.status, updatedBy: ctx.userId }, ['offerCtcLpa']);
        if (input.status === 'rejected' && a.status !== 'rejected') {
          notifications.push({
            recipientId: a.candidateId,
            title: `${drive.companyName}: update on your application`,
            body: `You won't be moving forward in the ${drive.roleTitle} drive. Keep preparing — more drives are coming.`,
          });
        }
      }
    }

    await notify(ctx.instituteId, notifications);
    await syncPlacedStatus(ctx.instituteId, apps.map((a) => a.candidateId));
    return this.getDetail(id, ctx);
  },

  async stats(rawQuery: unknown, ctx: AuthContext): Promise<PlacementStats> {
    const { placementYear } = statsQuerySchema.parse(rawQuery);
    const candidates = await driveCandidateRepository.listActive(ctx.instituteId, placementYear);
    const candidateIds = new Set(candidates.map(idOf));
    const drives = await placementDriveRepository.list(ctx.instituteId);
    const driveById = new Map(drives.map((d) => [idOf(d), d]));
    const selected = (await driveApplicationRepository.listByStatus(ctx.instituteId, 'selected')).filter(
      (a) => candidateIds.has(a.candidateId) && driveById.has(a.driveId)
    );

    const placingOffers = selected.filter((a) => isPlacingOffer(driveById.get(a.driveId)!.jobType));
    const placed = new Set(placingOffers.map((a) => a.candidateId));
    const ctcs = placingOffers
      .map((a) => a.offerCtcLpa ?? driveById.get(a.driveId)!.ctcLpa)
      .filter((v): v is number => typeof v === 'number' && v > 0)
      .sort((x, y) => x - y);
    const median = ctcs.length ? (ctcs.length % 2 ? ctcs[(ctcs.length - 1) / 2] : (ctcs[ctcs.length / 2 - 1] + ctcs[ctcs.length / 2]) / 2) : 0;

    const departments = new Map<string, { total: number; placed: number }>();
    for (const c of candidates) {
      const entry = departments.get(c.department) ?? { total: 0, placed: 0 };
      entry.total += 1;
      if (placed.has(idOf(c))) entry.placed += 1;
      departments.set(c.department, entry);
    }

    const offersByDrive = new Map<string, number>();
    for (const a of selected) offersByDrive.set(a.driveId, (offersByDrive.get(a.driveId) ?? 0) + 1);

    return {
      placementYear,
      totalStudents: candidates.length,
      placedStudents: placed.size,
      placementRate: candidates.length ? round2((placed.size / candidates.length) * 100) : 0,
      totalOffers: placingOffers.length,
      internshipOffers: selected.length - placingOffers.length,
      highestCtcLpa: ctcs.length ? ctcs[ctcs.length - 1] : 0,
      averageCtcLpa: ctcs.length ? round2(ctcs.reduce((s, v) => s + v, 0) / ctcs.length) : 0,
      medianCtcLpa: round2(median),
      activeDrives: drives.filter((d) => d.status === 'open').length,
      totalDrives: drives.filter((d) => d.status !== 'draft').length,
      byDepartment: [...departments.entries()]
        .map(([department, v]) => ({ department, total: v.total, placed: v.placed, rate: v.total ? round2((v.placed / v.total) * 100) : 0 }))
        .sort((x, y) => y.rate - x.rate),
      byCompany: [...offersByDrive.entries()]
        .map(([driveId, offers]) => {
          const d = driveById.get(driveId)!;
          return { companyName: d.companyName, roleTitle: d.roleTitle, offers, ctcLpa: d.ctcLpa, jobType: d.jobType };
        })
        .sort((x, y) => y.offers - x.offers),
    };
  },

  // ── Candidate-facing ───────────────────────────────────────────────────

  async listForCandidate(ctx: AuthContext): Promise<DriveForCandidate[]> {
    const candidateId = await resolveCandidateId(ctx);
    const candidate = await driveCandidateRepository.findById(ctx.instituteId, candidateId);
    if (!candidate) throw new NotFoundError('Student profile');

    const drives = await placementDriveRepository.listVisibleToCandidates(ctx.instituteId);
    const counts = countsByDrive(await driveApplicationRepository.listForDrives(ctx.instituteId, drives.map(idOf)));
    const mine = new Map((await driveApplicationRepository.listForCandidate(ctx.instituteId, candidateId)).map((a) => [a.driveId, a]));

    return drives
      .map((d) => {
        const app = mine.get(idOf(d));
        const reasons = ineligibilityReasons(d, candidate);
        const shaped = app ? toApplicationShape(app) : undefined;
        return {
          ...toDriveShape(d, counts.get(idOf(d))),
          eligible: reasons.length === 0,
          ineligibleReasons: reasons,
          myApplication: shaped && { _id: shaped._id, status: shaped.status, roundResults: shaped.roundResults, offerCtcLpa: shaped.offerCtcLpa, appliedAt: shaped.appliedAt },
        };
      })
      .sort((x, y) => Number(y.status === 'open') - Number(x.status === 'open'));
  },

  async apply(driveId: string, ctx: AuthContext): Promise<void> {
    const candidateId = await resolveCandidateId(ctx);
    const candidate = await driveCandidateRepository.findById(ctx.instituteId, candidateId);
    if (!candidate) throw new NotFoundError('Student profile');
    const drive = await placementDriveRepository.findById(driveId, ctx.instituteId);
    if (!drive || drive.status === 'draft') throw new NotFoundError('Placement drive');
    if (drive.status !== 'open') throw new ForbiddenError('Applications for this drive are closed');
    if (drive.applicationDeadline && Date.now() > new Date(drive.applicationDeadline).getTime()) {
      throw new ForbiddenError('The application deadline for this drive has passed');
    }
    const reasons = ineligibilityReasons(drive, candidate);
    if (reasons.length) throw new ForbiddenError(`You're not eligible: ${reasons.join('; ')}`);

    const existing = await driveApplicationRepository.findOne(ctx.instituteId, driveId, candidateId);
    if (existing && existing.status !== 'withdrawn') throw new ConflictError("You've already applied to this drive");
    if (existing) {
      await driveApplicationRepository.update(idOf(existing), { status: 'applied', roundResults: [], appliedAt: new Date() }, ['offerCtcLpa']);
    } else {
      await driveApplicationRepository.create({ instituteId: ctx.instituteId, driveId, candidateId, status: 'applied', appliedAt: new Date() });
    }
  },

  async withdraw(driveId: string, ctx: AuthContext): Promise<void> {
    const candidateId = await resolveCandidateId(ctx);
    const existing = await driveApplicationRepository.findOne(ctx.instituteId, driveId, candidateId);
    if (!existing || existing.status === 'withdrawn') throw new NotFoundError('Application');
    if (existing.status !== 'applied') throw new ForbiddenError('You can only withdraw before the selection process starts');
    await driveApplicationRepository.update(idOf(existing), { status: 'withdrawn' });
  },
};
