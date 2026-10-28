import bcrypt from 'bcrypt';
import { candidateRepository, FindCandidateOptions, PaginatedCandidates } from './candidate.repository';
import { createCandidateSchema, updateCandidateSchema, createLoginSchema, updateFacultyNoteSchema, bulkCreateLoginsSchema } from './candidate.validation';
import { randomInt } from 'crypto';
import { Candidate } from './candidate.model';
import type { BulkCreateLoginsResult, IssuedCredential } from '@placementos/types';
import { ForbiddenError, NotFoundError, ValidationError } from '../../middlewares/errorHandler';
import { ICandidate } from './candidate.model';
import { AuthContext } from '../../lib/auth-context';
import { userRepository } from '../users/user.repository';
import { User } from '../users/user.model';

const SALT_ROUNDS = 12;

// No look-alike characters (0/O, 1/l/I) — these get read off a printed slip and typed by hand.
const PASSWORD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
function generatePassword(length = 10): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  return out;
}

/** Roll number → a login username: lowercase, only [a-z0-9._-]. */
const usernameFromRoll = (roll: string) => roll.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');

/** bcrypt is deliberately slow — hash a batch a few at a time instead of one by one. */
async function inChunks<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

/** Resolves the Candidate record linked to the logged-in user's account, by loginEmail —
 *  mirrors resolveFacultyId in training-schedule.service.ts. Used by every candidate-portal
 *  feature (profile, practice progress, tests) to turn a User id into a Candidate id. */
export async function resolveCandidateId(ctx: AuthContext): Promise<string> {
  const user = (await User.findById(ctx.userId).select('email').lean()) as { email?: string } | null;
  if (!user?.email) throw new ForbiddenError('Your account has no email — cannot verify candidate profile');

  const candidate = await candidateRepository.findByLoginEmail(user.email, ctx.instituteId);
  if (!candidate) throw new ForbiddenError('Candidate profile not found');

  return String((candidate as unknown as { _id: { toString(): string } })._id);
}

export const candidateService = {
  async list(instituteId: string, options: FindCandidateOptions = {}): Promise<PaginatedCandidates> {
    return candidateRepository.findAll(instituteId, options);
  },

  async getById(id: string, instituteId: string): Promise<ICandidate> {
    const candidate = await candidateRepository.findById(id, instituteId);
    if (!candidate) throw new NotFoundError('Candidate');
    return candidate;
  },

  async listBatches(instituteId: string): Promise<string[]> {
    return candidateRepository.findDistinctBatches(instituteId);
  },

  async create(rawInput: unknown, ctx: AuthContext): Promise<ICandidate> {
    const data = createCandidateSchema.parse(rawInput);

    const existing = await candidateRepository.findByRollNumber(data.rollNumber, ctx.instituteId);
    if (existing) throw new ValidationError('A candidate with this roll number already exists');

    return candidateRepository.create({
      ...data,
      instituteId: ctx.instituteId,
      createdBy: ctx.userId,
    });
  },

  async update(id: string, rawInput: unknown, ctx: AuthContext): Promise<ICandidate> {
    const data = updateCandidateSchema.parse(rawInput);
    const candidate = await candidateRepository.update(id, ctx.instituteId, { ...data, updatedBy: ctx.userId });
    if (!candidate) throw new NotFoundError('Candidate');
    return candidate;
  },

  /** Faculty-facing counterpart to update() — lets a teacher attach a note about a
   *  student (e.g. from the attendance batch roster) without granting edit rights
   *  over the rest of the candidate record. */
  async updateFacultyNote(id: string, rawInput: unknown, ctx: AuthContext): Promise<ICandidate> {
    const data = updateFacultyNoteSchema.parse(rawInput);
    const candidate = await candidateRepository.update(id, ctx.instituteId, { ...data, updatedBy: ctx.userId });
    if (!candidate) throw new NotFoundError('Candidate');
    return candidate;
  },

  async remove(id: string, ctx: AuthContext): Promise<void> {
    const deleted = await candidateRepository.softDelete(id, ctx.instituteId, ctx.userId);
    if (!deleted) throw new NotFoundError('Candidate');
  },

  /** Creates a login (User account, role 'candidate') linked to this Candidate
   *  record by loginEmail — mirrors faculty.service.ts's createLogin. */
  async createLogin(id: string, rawInput: unknown, ctx: AuthContext): Promise<{ email: string }> {
    const { loginEmail, password } = createLoginSchema.parse(rawInput);
    const candidate = await candidateRepository.findById(id, ctx.instituteId);
    if (!candidate) throw new NotFoundError('Candidate');

    const existingUser = await userRepository.findByEmail(loginEmail);
    if (existingUser) throw new ValidationError('A user with this login email already exists');

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await userRepository.create({
      firstName: candidate.fullName.split(' ')[0] || candidate.fullName,
      lastName: candidate.fullName.split(' ').slice(1).join(' ') || candidate.fullName,
      email: loginEmail,
      passwordHash,
      role: 'candidate',
      instituteId: ctx.instituteId,
      createdBy: ctx.userId,
    });

    await candidateRepository.update(id, ctx.instituteId, { loginEmail, updatedBy: ctx.userId });

    return { email: loginEmail };
  },

  /** Issues logins to every student in scope who doesn't have one: username = roll number, a
   *  random password, and the student's own email when it's free (a placeholder otherwise —
   *  they sign in with the roll number either way). Passwords are returned once, never stored. */
  async bulkCreateLogins(rawInput: unknown, ctx: AuthContext): Promise<BulkCreateLoginsResult> {
    const { candidateIds, batch } = bulkCreateLoginsSchema.parse(rawInput);
    const candidates = (await Candidate.find({
      instituteId: ctx.instituteId,
      isDeleted: false,
      status: { $ne: 'inactive' },
      $or: [{ loginEmail: { $exists: false } }, { loginEmail: null }, { loginEmail: '' }],
      ...(candidateIds?.length ? { _id: { $in: candidateIds } } : {}),
      ...(batch ? { batch } : {}),
    })
      .sort({ batch: 1, rollNumber: 1 })
      .limit(500)
      .lean()) as unknown as (ICandidate & { _id: { toString(): string } })[];

    const skipped: BulkCreateLoginsResult['skipped'] = [];
    const planned: { c: (typeof candidates)[number]; username: string; email: string }[] = [];
    const takenUsernames = new Set<string>();
    const takenEmails = new Set<string>();

    for (const c of candidates) {
      const base = usernameFromRoll(c.rollNumber);
      if (!base) {
        skipped.push({ fullName: c.fullName, rollNumber: c.rollNumber, reason: 'Roll number has no usable characters' });
        continue;
      }
      // Usernames are unique across every institute on the platform, so a clash with another
      // college's roll number gets a numeric suffix.
      let username = base;
      for (let n = 2; takenUsernames.has(username) || (await userRepository.findByUsername(username)); n += 1) username = `${base}-${n}`;

      const ownEmail = c.email?.trim().toLowerCase();
      const email = ownEmail && !takenEmails.has(ownEmail) && !(await userRepository.findByEmail(ownEmail))
        ? ownEmail
        : `${username}.${ctx.instituteId.slice(-6)}@students.placementos.local`;

      takenUsernames.add(username);
      takenEmails.add(email);
      planned.push({ c, username, email });
    }

    const created = await inChunks(planned, 8, async ({ c, username, email }): Promise<IssuedCredential | null> => {
      const password = generatePassword();
      try {
        await userRepository.create({
          firstName: c.fullName.split(' ')[0] || c.fullName,
          lastName: c.fullName.split(' ').slice(1).join(' ') || c.fullName,
          email,
          username,
          passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
          role: 'candidate',
          instituteId: ctx.instituteId,
          createdBy: ctx.userId,
        });
      } catch {
        skipped.push({ fullName: c.fullName, rollNumber: c.rollNumber, reason: 'Could not create the account (username or email already in use)' });
        return null;
      }
      await candidateRepository.update(String(c._id), ctx.instituteId, { loginEmail: email, loginUsername: username, updatedBy: ctx.userId });
      return { candidateId: String(c._id), fullName: c.fullName, rollNumber: c.rollNumber, batch: c.batch, loginId: username, password };
    });

    return { created: created.filter((x): x is IssuedCredential => !!x), skipped };
  },

  /** TPO/admin sets a new random password for a student and signs them out everywhere. */
  async resetLoginPassword(id: string, ctx: AuthContext): Promise<IssuedCredential> {
    const candidate = await candidateRepository.findById(id, ctx.instituteId);
    if (!candidate) throw new NotFoundError('Candidate');
    if (!candidate.loginEmail) throw new ValidationError("This student doesn't have a login yet — create one first");

    const user = await userRepository.findByEmail(candidate.loginEmail);
    if (!user || user.instituteId !== ctx.instituteId) throw new NotFoundError('Login account');

    const password = generatePassword();
    // updatePassword also bumps tokenVersion, which ends every session signed in with the old one.
    await userRepository.updatePassword(String(user._id), await bcrypt.hash(password, SALT_ROUNDS));
    return {
      candidateId: id,
      fullName: candidate.fullName,
      rollNumber: candidate.rollNumber,
      batch: candidate.batch,
      loginId: user.username ?? candidate.loginEmail,
      password,
    };
  },
};
