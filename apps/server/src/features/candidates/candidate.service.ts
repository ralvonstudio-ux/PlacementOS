import bcrypt from 'bcrypt';
import { candidateRepository, FindCandidateOptions, PaginatedCandidates } from './candidate.repository';
import { createCandidateSchema, updateCandidateSchema, createLoginSchema, updateFacultyNoteSchema } from './candidate.validation';
import { ForbiddenError, NotFoundError, ValidationError } from '../../middlewares/errorHandler';
import { ICandidate } from './candidate.model';
import { AuthContext } from '../../lib/auth-context';
import { userRepository } from '../users/user.repository';
import { User } from '../users/user.model';

const SALT_ROUNDS = 12;

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
};
