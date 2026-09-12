import { candidateRepository, FindCandidateOptions, PaginatedCandidates } from './candidate.repository';
import { createCandidateSchema, updateCandidateSchema } from './candidate.validation';
import { NotFoundError, ValidationError } from '../../middlewares/errorHandler';
import { ICandidate } from './candidate.model';
import { AuthContext } from '../../lib/auth-context';

export const candidateService = {
  async list(instituteId: string, options: FindCandidateOptions = {}): Promise<PaginatedCandidates> {
    return candidateRepository.findAll(instituteId, options);
  },

  async getById(id: string, instituteId: string): Promise<ICandidate> {
    const candidate = await candidateRepository.findById(id, instituteId);
    if (!candidate) throw new NotFoundError('Candidate');
    return candidate;
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

  async remove(id: string, ctx: AuthContext): Promise<void> {
    const deleted = await candidateRepository.softDelete(id, ctx.instituteId, ctx.userId);
    if (!deleted) throw new NotFoundError('Candidate');
  },
};
