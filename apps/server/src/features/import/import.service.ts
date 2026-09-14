import * as XLSX from 'xlsx';
import { importSessionRepository, FindImportSessionOptions, PaginatedImportSessions } from './import-session.repository';
import { ImportType, IImportSession, IImportRow, DuplicateStrategy } from './import-session.model';
import { NotFoundError, ValidationError } from '../../middlewares/errorHandler';
import { AuthContext } from '../../lib/auth-context';
import { openaiProvider } from '../ai/providers/llm/openai.provider';
import { logger } from '../../lib/logger';

import { facultyRepository } from '../faculty/faculty.repository';
import { createFacultySchema } from '../faculty/faculty.validation';
import { candidateRepository } from '../candidates/candidate.repository';
import { createCandidateSchema } from '../candidates/candidate.validation';
import { trainingScheduleRepository } from '../training-schedule/training-schedule.repository';
import { createTrainingScheduleSchema } from '../training-schedule/training-schedule.validation';
import { Faculty } from '../faculty/faculty.model';
import { TrainingScheduleEntry } from '../training-schedule/training-schedule.model';

// ── Templates — what each import type expects ──────────────────────────────
export interface ImportField {
  field: string;
  label: string;
  required: boolean;
  description?: string;
}

export const IMPORT_TEMPLATES: Record<ImportType, ImportField[]> = {
  faculty: [
    { field: 'fullName', label: 'Full Name', required: true },
    { field: 'employeeId', label: 'Employee ID', required: true },
    { field: 'gender', label: 'Gender (male/female/other)', required: true },
    { field: 'phone', label: 'Phone', required: true },
    { field: 'email', label: 'Email', required: false },
    { field: 'department', label: 'Department', required: false },
    { field: 'tracks', label: 'Tracks (comma-separated)', required: false },
    { field: 'assignedBatches', label: 'Batches (comma-separated)', required: false },
  ],
  candidates: [
    { field: 'fullName', label: 'Full Name', required: true },
    { field: 'rollNumber', label: 'Roll Number', required: true },
    { field: 'batch', label: 'Batch', required: true },
    { field: 'department', label: 'Department', required: true },
    { field: 'placementYear', label: 'Placement Year', required: true },
    { field: 'email', label: 'Email', required: false },
    { field: 'phone', label: 'Phone', required: false },
  ],
  'training-schedule': [
    { field: 'batch', label: 'Batch', required: true },
    { field: 'track', label: 'Track (subject)', required: true },
    { field: 'facultyEmployeeId', label: 'Faculty Employee ID', required: true, description: 'Must match an existing faculty employee ID' },
    { field: 'dayOfWeek', label: 'Day (Mon–Sat, or 1–6)', required: true },
    { field: 'startTime', label: 'Start Time (HH:mm)', required: true },
    { field: 'endTime', label: 'End Time (HH:mm)', required: true },
    { field: 'room', label: 'Room', required: false },
    { field: 'placementYear', label: 'Placement Year', required: true },
  ],
};

const DAY_NAMES: Record<string, number> = {
  mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
};

function parseDayOfWeek(raw: string): number | null {
  const trimmed = raw.trim().toLowerCase();
  if (/^[1-6]$/.test(trimmed)) return Number(trimmed);
  return DAY_NAMES[trimmed] ?? null;
}

// ── File parsing ────────────────────────────────────────────────────────────
export function parseSpreadsheet(buffer: Buffer): { headers: string[]; rows: Record<string, string>[] } {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new ValidationError('The uploaded file has no sheets');
  const sheet = workbook.Sheets[sheetName];

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
  if (rawRows.length === 0) return { headers: [], rows: [] };

  const headers = Object.keys(rawRows[0]);
  const rows = rawRows.map((r) => {
    const row: Record<string, string> = {};
    for (const h of headers) row[h] = String(r[h] ?? '').trim();
    return row;
  });
  return { headers, rows };
}

// ── Column mapping ──────────────────────────────────────────────────────────
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Case/punctuation-insensitive substring match between header and target field/label —
 *  used as the mapping when AI mapping is unavailable, and as the fallback for any target
 *  field the AI pass didn't confidently map. */
export function heuristicMap(headers: string[], fields: ImportField[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalizedHeaders = headers.map((h) => ({ raw: h, norm: normalize(h) }));

  for (const field of fields) {
    const candidates = [field.field, field.label].map(normalize);
    const match = normalizedHeaders.find((h) => candidates.some((c) => h.norm === c || h.norm.includes(c) || c.includes(h.norm)));
    if (match) mapping[field.field] = match.raw;
  }
  return mapping;
}

/** AI-assisted column mapping — falls back to the heuristic matcher for any field the model
 *  didn't map (or entirely, if no API key is configured). */
export async function aiMapColumns(headers: string[], fields: ImportField[]): Promise<Record<string, string>> {
  const fallback = heuristicMap(headers, fields);
  if (!openaiProvider.isAvailable()) return fallback;

  try {
    const result = await openaiProvider.complete({
      systemPrompt:
        'You map spreadsheet column headers to a fixed set of target fields for a data import tool. ' +
        'Respond with ONLY a JSON object mapping target field name -> the single best matching source header (exact string from the list). ' +
        'Omit a target field entirely if no header is a reasonable match. Never invent a header that is not in the list.',
      userPrompt:
        `Source headers: ${JSON.stringify(headers)}\n\n` +
        `Target fields: ${JSON.stringify(fields.map((f) => ({ field: f.field, label: f.label, required: f.required })))}`,
      jsonResponse: true,
      temperature: 0,
      maxTokens: 500,
    });

    const parsed = JSON.parse(result.content) as Record<string, string>;
    const valid: Record<string, string> = {};
    for (const [field, header] of Object.entries(parsed)) {
      if (headers.includes(header) && fields.some((f) => f.field === field)) valid[field] = header;
    }
    return { ...fallback, ...valid };
  } catch (err) {
    logger.warn('[import] AI column mapping failed — falling back to heuristic match', { error: (err as Error).message });
    return fallback;
  }
}

// ── Row validation + duplicate detection ────────────────────────────────────
async function validateFacultyRow(mapped: Record<string, unknown>, instituteId: string): Promise<{ errors: string[]; status: IImportRow['status'] }> {
  const errors: string[] = [];
  const parsed = createFacultySchema.safeParse(mapped);
  if (!parsed.success) errors.push(...parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  if (errors.length > 0) return { errors, status: 'invalid' };

  const existing = await facultyRepository.findByEmployeeId(String(mapped.employeeId), instituteId);
  if (existing) return { errors: [], status: 'duplicate' };
  return { errors: [], status: 'valid' };
}

async function validateCandidateRow(mapped: Record<string, unknown>, instituteId: string): Promise<{ errors: string[]; status: IImportRow['status'] }> {
  const errors: string[] = [];
  const parsed = createCandidateSchema.safeParse(mapped);
  if (!parsed.success) errors.push(...parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  if (errors.length > 0) return { errors, status: 'invalid' };

  const existing = await candidateRepository.findByRollNumber(String(mapped.rollNumber), instituteId);
  if (existing) return { errors: [], status: 'duplicate' };
  return { errors: [], status: 'valid' };
}

async function validateScheduleRow(
  mapped: Record<string, unknown>,
  instituteId: string
): Promise<{ errors: string[]; status: IImportRow['status']; resolved?: Record<string, unknown> }> {
  const errors: string[] = [];

  const employeeId = String(mapped.facultyEmployeeId ?? '').trim();
  const faculty = employeeId ? await Faculty.findOne({ instituteId, employeeId, isDeleted: false }).select('_id').lean<{ _id: unknown } | null>() : null;
  if (!employeeId) errors.push('facultyEmployeeId: required');
  else if (!faculty) errors.push(`facultyEmployeeId: no faculty found with employee ID "${employeeId}"`);

  const dayRaw = String(mapped.dayOfWeek ?? '');
  const dayOfWeek = parseDayOfWeek(dayRaw);
  if (dayOfWeek === null) errors.push(`dayOfWeek: could not parse "${dayRaw}" as Mon–Sat`);

  const resolved: Record<string, unknown> = {
    batch: mapped.batch,
    track: mapped.track,
    room: mapped.room,
    placementYear: mapped.placementYear,
    startTime: mapped.startTime,
    endTime: mapped.endTime,
    facultyId: faculty ? String(faculty._id) : undefined,
    dayOfWeek: dayOfWeek ?? undefined,
  };

  const parsed = createTrainingScheduleSchema.safeParse(resolved);
  if (!parsed.success) errors.push(...parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  if (errors.length > 0) return { errors, status: 'invalid' };

  const existing = await TrainingScheduleEntry.findOne({
    instituteId,
    batch: String(resolved.batch),
    track: String(resolved.track),
    dayOfWeek: resolved.dayOfWeek as number,
    startTime: String(resolved.startTime),
    isDeleted: false,
  }).lean();
  if (existing) return { errors: [], status: 'duplicate', resolved };
  return { errors: [], status: 'valid', resolved };
}

function buildMappedRow(raw: Record<string, string>, columnMapping: Record<string, string>, fields: ImportField[]): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  for (const field of fields) {
    const header = columnMapping[field.field];
    const value = header ? raw[header] : undefined;
    if (value === undefined || value === '') continue;
    if (field.field === 'tracks' || field.field === 'assignedBatches') {
      mapped[field.field] = value.split(',').map((v) => v.trim()).filter(Boolean);
    } else {
      mapped[field.field] = value;
    }
  }
  return mapped;
}

/** Re-derives every row's `mapped`/`errors`/`status` from the current column mapping —
 *  called after upload and after any mapping change. */
async function revalidateRows(session: IImportSession): Promise<void> {
  const fields = IMPORT_TEMPLATES[session.importType];

  for (const row of session.rows) {
    const mapped = buildMappedRow(row.raw, session.columnMapping, fields);
    let result: { errors: string[]; status: IImportRow['status']; resolved?: Record<string, unknown> };

    if (session.importType === 'faculty') result = await validateFacultyRow(mapped, session.instituteId);
    else if (session.importType === 'candidates') result = await validateCandidateRow(mapped, session.instituteId);
    else result = await validateScheduleRow(mapped, session.instituteId);

    row.mapped = result.resolved ?? mapped;
    row.errors = result.errors;
    row.status = result.status;
  }
}

// ── Session lifecycle ────────────────────────────────────────────────────────
export const importService = {
  async upload(importType: ImportType, file: Express.Multer.File, ctx: AuthContext): Promise<IImportSession> {
    const { headers, rows } = parseSpreadsheet(file.buffer);
    if (rows.length === 0) throw new ValidationError('The uploaded file has no data rows');
    if (rows.length > 2000) throw new ValidationError('Import is limited to 2000 rows per file');

    const fields = IMPORT_TEMPLATES[importType];
    const columnMapping = await aiMapColumns(headers, fields);

    const session = await importSessionRepository.create({
      instituteId: ctx.instituteId,
      importType,
      originalFileName: file.originalname,
      totalRows: rows.length,
      status: 'mapping',
      rawHeaders: headers,
      columnMapping,
      duplicateStrategy: 'skip',
      rows: rows.map((raw, i) => ({ rowNumber: i + 1, raw, mapped: {}, errors: [], status: 'pending' })),
      createdEntityIds: [],
      createdBy: ctx.userId,
    });

    await revalidateRows(session);
    return importSessionRepository.save(session);
  },

  async list(instituteId: string, options: FindImportSessionOptions): Promise<PaginatedImportSessions> {
    return importSessionRepository.findAll(instituteId, options);
  },

  async getById(id: string, ctx: AuthContext): Promise<IImportSession> {
    const session = await importSessionRepository.findById(id, ctx.instituteId);
    if (!session) throw new NotFoundError('Import session');
    return session;
  },

  async updateMapping(id: string, columnMapping: Record<string, string>, ctx: AuthContext): Promise<IImportSession> {
    const session = await importSessionRepository.findById(id, ctx.instituteId);
    if (!session) throw new NotFoundError('Import session');
    if (session.status !== 'mapping') throw new ValidationError('Mapping can only be changed before confirming');

    session.columnMapping = columnMapping;
    await revalidateRows(session);
    return importSessionRepository.save(session);
  },

  async setDuplicateStrategy(id: string, duplicateStrategy: DuplicateStrategy, ctx: AuthContext): Promise<IImportSession> {
    const session = await importSessionRepository.findById(id, ctx.instituteId);
    if (!session) throw new NotFoundError('Import session');
    session.duplicateStrategy = duplicateStrategy;
    return importSessionRepository.save(session);
  },

  async updateRow(id: string, rowNumber: number, raw: Record<string, string>, ctx: AuthContext): Promise<IImportSession> {
    const session = await importSessionRepository.findById(id, ctx.instituteId);
    if (!session) throw new NotFoundError('Import session');
    const row = session.rows.find((r) => r.rowNumber === rowNumber);
    if (!row) throw new NotFoundError('Import row');

    row.raw = raw;
    await revalidateRows(session);
    return importSessionRepository.save(session);
  },

  async deleteRow(id: string, rowNumber: number, ctx: AuthContext): Promise<IImportSession> {
    const session = await importSessionRepository.findById(id, ctx.instituteId);
    if (!session) throw new NotFoundError('Import session');
    session.rows = session.rows.filter((r) => r.rowNumber !== rowNumber);
    session.totalRows = session.rows.length;
    return importSessionRepository.save(session);
  },

  async cancel(id: string, ctx: AuthContext): Promise<void> {
    const session = await importSessionRepository.findById(id, ctx.instituteId);
    if (!session) throw new NotFoundError('Import session');
    session.status = 'cancelled';
    await importSessionRepository.save(session);
  },

  /** Creates the underlying entities for every row eligible under the session's
   *  duplicate strategy, tracking created ids so the whole batch can be rolled back. */
  async confirm(id: string, ctx: AuthContext): Promise<IImportSession> {
    const session = await importSessionRepository.findById(id, ctx.instituteId);
    if (!session) throw new NotFoundError('Import session');
    if (session.status !== 'mapping') throw new ValidationError('This session was already confirmed, cancelled, or rolled back');

    await revalidateRows(session);
    session.status = 'processing';
    await importSessionRepository.save(session);

    try {
      for (const row of session.rows) {
        const eligible = row.status === 'valid' || (row.status === 'duplicate' && session.duplicateStrategy !== 'skip');
        if (!eligible) continue;

        try {
          const entityId = await createEntityForRow(session.importType, row.mapped, ctx, row.status === 'duplicate' && session.duplicateStrategy === 'overwrite');
          row.entityId = entityId;
          row.status = 'created';
          session.createdEntityIds.push(entityId);
        } catch (err) {
          row.status = 'invalid';
          row.errors = [...row.errors, (err as Error).message];
        }
      }

      session.status = 'completed';
      session.confirmedAt = new Date();
    } catch (err) {
      session.status = 'failed';
      session.errorMessage = (err as Error).message;
    }

    return importSessionRepository.save(session);
  },

  /** Deletes every entity this session created (best-effort — an entity already removed by
   *  another action is simply skipped) and marks the session rolled back. */
  async rollback(id: string, ctx: AuthContext): Promise<IImportSession> {
    const session = await importSessionRepository.findById(id, ctx.instituteId);
    if (!session) throw new NotFoundError('Import session');
    if (session.status !== 'completed') throw new ValidationError('Only a completed import can be rolled back');

    for (const entityId of session.createdEntityIds) {
      try {
        if (session.importType === 'faculty') await facultyRepository.softDelete(entityId, ctx.instituteId, ctx.userId);
        else if (session.importType === 'candidates') await candidateRepository.softDelete(entityId, ctx.instituteId, ctx.userId);
        else await trainingScheduleRepository.softDelete(entityId, ctx.instituteId, ctx.userId);
      } catch (err) {
        logger.warn('[import] rollback could not remove entity', { entityId, error: (err as Error).message });
      }
    }

    session.status = 'rolled_back';
    session.rolledBackAt = new Date();
    return importSessionRepository.save(session);
  },
};

async function createEntityForRow(importType: ImportType, mapped: Record<string, unknown>, ctx: AuthContext, overwrite: boolean): Promise<string> {
  if (importType === 'faculty') {
    if (overwrite) {
      const existing = await facultyRepository.findByEmployeeId(String(mapped.employeeId), ctx.instituteId);
      if (existing) {
        const updated = await facultyRepository.update(String(existing._id), ctx.instituteId, { ...mapped, updatedBy: ctx.userId });
        return String(updated!._id);
      }
    }
    const created = await facultyRepository.create({ ...mapped, instituteId: ctx.instituteId, createdBy: ctx.userId });
    return String(created._id);
  }

  if (importType === 'candidates') {
    if (overwrite) {
      const existing = await candidateRepository.findByRollNumber(String(mapped.rollNumber), ctx.instituteId);
      if (existing) {
        const updated = await candidateRepository.update(String(existing._id), ctx.instituteId, { ...mapped, updatedBy: ctx.userId });
        return String(updated!._id);
      }
    }
    const created = await candidateRepository.create({ ...mapped, instituteId: ctx.instituteId, createdBy: ctx.userId });
    return String(created._id);
  }

  const created = await trainingScheduleRepository.create({ ...mapped, instituteId: ctx.instituteId, createdBy: ctx.userId });
  return String(created._id);
}
