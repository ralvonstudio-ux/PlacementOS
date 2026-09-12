import { practiceQuestionRepository, practiceSheetRepository, PaginatedPracticeQuestions } from './practice.repository';
import { createPracticeQuestionSchema, updatePracticeQuestionSchema, listPracticeQuestionSchema, createPracticeSheetSchema } from './practice.validation';
import { IPracticeQuestion, IPracticeSheet } from './practice.model';
import { NotFoundError, ValidationError } from '../../middlewares/errorHandler';
import { AuthContext } from '../../lib/auth-context';
import { candidateRepository } from '../candidates/candidate.repository';
import { resolveCandidateId } from '../candidates/candidate.service';
import type { PracticeSheet as PracticeSheetApiShape } from '@placementos/types';

export const practiceService = {
  async listQuestions(rawQuery: unknown, _ctx: AuthContext, instituteId: string): Promise<PaginatedPracticeQuestions> {
    const opts = listPracticeQuestionSchema.parse(rawQuery);
    return practiceQuestionRepository.findAll(instituteId, opts);
  },

  async listCompanies(instituteId: string): Promise<string[]> {
    return practiceQuestionRepository.findDistinctCompanies(instituteId);
  },

  async createQuestion(rawInput: unknown, ctx: AuthContext): Promise<IPracticeQuestion> {
    const data = createPracticeQuestionSchema.parse(rawInput);
    return practiceQuestionRepository.create(ctx.instituteId, ctx.userId, data);
  },

  async updateQuestion(id: string, rawInput: unknown, ctx: AuthContext): Promise<IPracticeQuestion> {
    const data = updatePracticeQuestionSchema.parse(rawInput);
    const updated = await practiceQuestionRepository.update(id, ctx.instituteId, data);
    if (!updated) throw new NotFoundError('Practice question');
    return updated;
  },

  async deleteQuestion(id: string, ctx: AuthContext): Promise<void> {
    const deleted = await practiceQuestionRepository.softDelete(id, ctx.instituteId);
    if (!deleted) throw new NotFoundError('Practice question');
  },

  async createSheet(rawInput: unknown, ctx: AuthContext): Promise<IPracticeSheet> {
    const data = createPracticeSheetSchema.parse(rawInput);
    const questions = await practiceQuestionRepository.findByIds(data.questionIds, ctx.instituteId);
    if (questions.length !== data.questionIds.length) throw new ValidationError('One or more selected questions could not be found');
    return practiceSheetRepository.create(ctx.instituteId, ctx.userId, data);
  },

  async listSheets(ctx: AuthContext): Promise<IPracticeSheet[]> {
    return practiceSheetRepository.findAll(ctx.instituteId);
  },

  async deleteSheet(id: string, ctx: AuthContext): Promise<void> {
    const deleted = await practiceSheetRepository.softDelete(id, ctx.instituteId);
    if (!deleted) throw new NotFoundError('Practice sheet');
  },

  /** Candidate-facing: every practice sheet published for their own batch. */
  async listMySheets(ctx: AuthContext): Promise<PracticeSheetApiShape[]> {
    const candidateId = await resolveCandidateId(ctx);
    const candidate = await candidateRepository.findById(candidateId, ctx.instituteId);
    if (!candidate) throw new NotFoundError('Candidate');

    const sheets = await practiceSheetRepository.findForBatch(ctx.instituteId, candidate.batch);
    return sheets.map((s) => ({
      _id: String((s as unknown as { _id: { toString(): string } })._id),
      instituteId: s.instituteId,
      title: s.title,
      batch: s.batch,
      category: s.category,
      questionIds: s.questionIds,
      createdBy: s.createdBy,
      createdAt: new Date(s.createdAt).toISOString(),
      updatedAt: new Date(s.updatedAt).toISOString(),
    }));
  },

  /** Candidate-facing: the actual questions in one of their sheets. */
  async getMySheetQuestions(sheetId: string, ctx: AuthContext): Promise<IPracticeQuestion[]> {
    const candidateId = await resolveCandidateId(ctx);
    const candidate = await candidateRepository.findById(candidateId, ctx.instituteId);
    if (!candidate) throw new NotFoundError('Candidate');

    const sheet = await practiceSheetRepository.findById(sheetId, ctx.instituteId);
    if (!sheet || sheet.batch !== candidate.batch) throw new NotFoundError('Practice sheet');

    return practiceQuestionRepository.findByIds(sheet.questionIds, ctx.instituteId);
  },
};
