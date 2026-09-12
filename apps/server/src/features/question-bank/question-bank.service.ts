import { AuthContext } from '../../lib/auth-context';
import { NotFoundError, ValidationError } from '../../middlewares/errorHandler';
import { assertFacultyCanAccessQuestionBank, getFacultyAllowedBatchTracks, AllowedBatchTrack } from '../training-schedule/training-schedule.service';
import { trainingScheduleRepository } from '../training-schedule/training-schedule.repository';
import { Faculty } from '../faculty/faculty.model';
import { trainingModuleRecordRepository } from './training-module-record.repository';
import { bankQuestionRepository, QuestionListOptions } from './bank-question.repository';
import { bankQuestionSourceRepository } from './bank-question-source.repository';
import { generatedPaperRepository } from './generated-paper.repository';
import { questionExtractionService, flattenBlocksToText } from './question-extraction.service';
import { IBankQuestion } from './bank-question.model';
import { ITrainingModuleRecord } from './training-module-record.model';
import { IBankQuestionSource } from './bank-question-source.model';
import { normalizeOptions } from './option-text';
import type { TpoOverviewEntry } from '@placementos/types';
import {
  ConfirmExtractedQuestionsInput,
  CreateQuestionInput,
  UpdateQuestionInput,
  ListQuestionsInput,
  ListQuestionGroupsInput,
  ListSourcesInput,
  UpdateSourceInput,
  SaveChapterSourceInput,
  ReExtractSourceInput,
} from './question-bank.validation';

export const questionBankService = {
  async listModules(rawQuery: unknown, ctx: AuthContext): Promise<ITrainingModuleRecord[]> {
    const query = rawQuery as { batch: string; track: string };
    await assertFacultyCanAccessQuestionBank(ctx, query.batch, query.track);
    return trainingModuleRecordRepository.findAll(ctx.instituteId, query.batch, query.track);
  },

  async listQuestions(query: ListQuestionsInput, ctx: AuthContext) {
    const opts: QuestionListOptions = { ...query };
    if (query.batch && query.track) {
      await assertFacultyCanAccessQuestionBank(ctx, query.batch, query.track);
    } else if (ctx.role === 'faculty') {
      const allowed = await getFacultyAllowedBatchTracks(ctx);
      const narrowed = allowed.filter((p) => (!query.batch || p.batch === query.batch) && (!query.track || p.track === query.track));
      if (narrowed.length === 0) return { questions: [], total: 0, page: opts.page ?? 1, limit: opts.limit ?? 20 };
      opts.batchTrackPairs = narrowed;
    }
    return bankQuestionRepository.findAll(ctx.instituteId, opts);
  },

  /** Module-grouped counts backing the Question Bank landing view. */
  async listQuestionGroups(query: ListQuestionGroupsInput, ctx: AuthContext) {
    const opts: ListQuestionGroupsInput & { batchTrackPairs?: AllowedBatchTrack[] } = { ...query };
    if (query.batch && query.track) {
      await assertFacultyCanAccessQuestionBank(ctx, query.batch, query.track);
    } else if (ctx.role === 'faculty') {
      const allowed = await getFacultyAllowedBatchTracks(ctx);
      const narrowed = allowed.filter((p) => (!query.batch || p.batch === query.batch) && (!query.track || p.track === query.track));
      if (narrowed.length === 0) return [];
      opts.batchTrackPairs = narrowed;
    }
    return bankQuestionRepository.findGroups(ctx.instituteId, opts);
  },

  async getQuestion(id: string, ctx: AuthContext): Promise<IBankQuestion> {
    const question = await bankQuestionRepository.findById(id, ctx.instituteId);
    if (!question) throw new NotFoundError('Question');
    await assertFacultyCanAccessQuestionBank(ctx, question.batch, question.track);
    return question;
  },

  async createQuestion(data: CreateQuestionInput, ctx: AuthContext): Promise<IBankQuestion> {
    await assertFacultyCanAccessQuestionBank(ctx, data.batch, data.track);
    const module_ = await trainingModuleRecordRepository.findOrCreate(ctx.instituteId, data.batch, data.track, data.trainingModuleName, data.topic);

    return bankQuestionRepository.create({
      instituteId: ctx.instituteId,
      batch: data.batch,
      track: data.track,
      trainingModuleId: String(module_._id),
      trainingModuleName: module_.moduleName,
      topic: data.topic,
      questionText: data.questionText,
      questionType: data.questionType,
      options: normalizeOptions(data.options),
      correctAnswer: data.correctAnswer ?? undefined,
      difficulty: data.difficulty,
      marks: data.marks,
      estimatedTimeMinutes: data.estimatedTimeMinutes,
      bloomsLevel: data.bloomsLevel,
      keywords: data.keywords,
      source: data.source ?? undefined,
      createdBy: ctx.userId,
    });
  },

  /** Persists reviewed/edited AI-extracted draft questions — only on explicit faculty confirmation. */
  async confirmExtractedQuestions(data: ConfirmExtractedQuestionsInput, ctx: AuthContext): Promise<IBankQuestion[]> {
    await assertFacultyCanAccessQuestionBank(ctx, data.batch, data.track);
    const existingTextsByModule = new Map<string, Set<string>>();
    const toCreate = [];
    for (const q of data.questions) {
      const topic = q.topic ?? undefined;
      const module_ = await trainingModuleRecordRepository.findOrCreate(ctx.instituteId, data.batch, data.track, q.trainingModuleName, topic);
      const trainingModuleId = String(module_._id);

      if (!existingTextsByModule.has(trainingModuleId)) {
        const textsInThisBatch = data.questions.filter((dq) => dq.trainingModuleName === q.trainingModuleName).map((dq) => dq.questionText);
        existingTextsByModule.set(trainingModuleId, await bankQuestionRepository.findExistingTexts(ctx.instituteId, trainingModuleId, textsInThisBatch));
      }
      if (existingTextsByModule.get(trainingModuleId)!.has(q.questionText.trim().toLowerCase())) continue;

      toCreate.push({
        instituteId: ctx.instituteId,
        batch: data.batch,
        track: data.track,
        trainingModuleId,
        trainingModuleName: module_.moduleName,
        topic,
        topicId: q.topicId ?? undefined,
        subtopicId: q.subtopicId ?? undefined,
        questionText: q.questionText,
        questionType: q.questionType,
        options: normalizeOptions(q.options),
        correctAnswer: q.correctAnswer ?? undefined,
        difficulty: q.difficulty,
        marks: q.marks,
        estimatedTimeMinutes: q.estimatedTimeMinutes,
        bloomsLevel: q.bloomsLevel,
        keywords: q.keywords,
        source: q.source ?? undefined,
        createdBy: ctx.userId,
        sourceRef: q.sourceRef ?? undefined,
        imageRef: q.imageRef ?? undefined,
        imageRequirement: q.imageRequirement ?? undefined,
      });
    }

    return bankQuestionRepository.createMany(toCreate);
  },

  async updateQuestion(id: string, data: UpdateQuestionInput, ctx: AuthContext): Promise<IBankQuestion> {
    const existing = await bankQuestionRepository.findById(id, ctx.instituteId);
    if (!existing) throw new NotFoundError('Question');
    await assertFacultyCanAccessQuestionBank(ctx, existing.batch, existing.track);
    if (data.batch && data.track && (data.batch !== existing.batch || data.track !== existing.track)) {
      await assertFacultyCanAccessQuestionBank(ctx, data.batch, data.track);
    }

    let trainingModuleId: string | undefined;
    let trainingModuleName: string | undefined;
    if (data.trainingModuleName) {
      const module_ = await trainingModuleRecordRepository.findOrCreate(ctx.instituteId, data.batch ?? existing.batch, data.track ?? existing.track, data.trainingModuleName, data.topic);
      trainingModuleId = String(module_._id);
      trainingModuleName = module_.moduleName;
    }

    const updated = await bankQuestionRepository.update(id, ctx.instituteId, {
      ...data,
      options: normalizeOptions(data.options),
      correctAnswer: data.correctAnswer ?? undefined,
      source: data.source ?? undefined,
      trainingModuleId,
      trainingModuleName,
    });
    if (!updated) throw new NotFoundError('Question');
    return updated;
  },

  /** batch/track omitted -> the "pending uploads" view, listing everything for the institute. */
  async listSources(query: ListSourcesInput, ctx: AuthContext): Promise<IBankQuestionSource[]> {
    if (query.batch && query.track) {
      await assertFacultyCanAccessQuestionBank(ctx, query.batch, query.track);
      return bankQuestionSourceRepository.findAll(ctx.instituteId, query.batch, query.track);
    }

    const sources = await bankQuestionSourceRepository.findAll(ctx.instituteId, query.batch, query.track);
    if (ctx.role !== 'faculty') return sources;

    const allowed = await getFacultyAllowedBatchTracks(ctx);
    const allowedKeys = new Set(allowed.map((p) => `${p.batch}::${p.track}`));
    return sources.filter((s) => allowedKeys.has(`${s.batch}::${s.track}`));
  },

  async getSource(id: string, ctx: AuthContext): Promise<IBankQuestionSource> {
    const source = await bankQuestionSourceRepository.findById(id, ctx.instituteId);
    if (!source) throw new NotFoundError('Upload');
    await assertFacultyCanAccessQuestionBank(ctx, source.batch, source.track);
    return source;
  },

  async reExtractSource(id: string, options: ReExtractSourceInput, ctx: AuthContext): Promise<{ jobId: string }> {
    const source = await bankQuestionSourceRepository.findById(id, ctx.instituteId);
    if (!source) throw new NotFoundError('Upload');
    await assertFacultyCanAccessQuestionBank(ctx, source.batch, source.track);
    return questionExtractionService.enqueueReExtractFromSource(source, options, ctx);
  },

  /** PATCH /sources/:id — module rename (legacy) and/or structured content edits (faculty review). */
  async updateSource(id: string, data: UpdateSourceInput, ctx: AuthContext): Promise<IBankQuestionSource> {
    const source = await bankQuestionSourceRepository.findById(id, ctx.instituteId);
    if (!source) throw new NotFoundError('Upload');

    if (data.pages) {
      const extractedText = flattenBlocksToText(data.pages.flatMap((p) => p.blocks));
      const updated = await bankQuestionSourceRepository.updateStructuredContent(id, ctx.instituteId, {
        documentTitle: data.documentTitle ?? source.documentTitle,
        pages: data.pages,
        extractedText: extractedText || source.extractedText,
        reviewStatus: data.reviewStatus,
      });
      if (!updated) throw new NotFoundError('Upload');
      if (data.trainingModuleName) {
        await trainingModuleRecordRepository.findOrCreate(ctx.instituteId, source.batch, source.track, data.trainingModuleName);
        return (await bankQuestionSourceRepository.updateModuleName(id, ctx.instituteId, data.trainingModuleName)) ?? updated;
      }
      return updated;
    }

    if (data.trainingModuleName) {
      const updated = await bankQuestionSourceRepository.updateModuleName(id, ctx.instituteId, data.trainingModuleName);
      if (!updated) throw new NotFoundError('Upload');
      await trainingModuleRecordRepository.findOrCreate(ctx.instituteId, source.batch, source.track, data.trainingModuleName);
      return updated;
    }

    return source;
  },

  /** POST /extract/chapter — starts a multi-page batch job that reads each page straight into question drafts. */
  async enqueueChapterCapture(
    batch: string, track: string, trainingModuleName: string | undefined,
    images: { dataUri: string; fileName?: string }[], ctx: AuthContext, detectImages = false
  ): Promise<{ jobId: string }> {
    if (images.length === 0) throw new ValidationError('At least one page image is required');
    return questionExtractionService.enqueueChapterCapture(batch, track, trainingModuleName, images, ctx, detectImages);
  },

  async retryChapterPage(jobId: string, pageNumber: number, imageDataUri: string, ctx: AuthContext) {
    return questionExtractionService.retryPage(jobId, pageNumber, imageDataUri, ctx);
  },

  async saveChapterSource(data: SaveChapterSourceInput, ctx: AuthContext): Promise<IBankQuestionSource> {
    return questionExtractionService.saveChapterSource(data.batch, data.track, data, ctx);
  },

  async deleteQuestion(id: string, ctx: AuthContext): Promise<void> {
    const existing = await bankQuestionRepository.findById(id, ctx.instituteId);
    if (!existing) throw new NotFoundError('Question');
    await assertFacultyCanAccessQuestionBank(ctx, existing.batch, existing.track);

    const deleted = await bankQuestionRepository.softDelete(id, ctx.instituteId);
    if (!deleted) throw new ValidationError('Could not delete this question');
  },

  async deleteQuestionGroups(groups: { batch: string; track: string; trainingModuleId: string }[], ctx: AuthContext): Promise<number> {
    return bankQuestionRepository.softDeleteByModuleGroups(ctx.instituteId, groups);
  },

  async mergeQuestionGroups(
    groups: { batch: string; track: string; trainingModuleId: string; trainingModuleName: string }[],
    targetModuleName: string,
    ctx: AuthContext
  ): Promise<number> {
    const [first, ...rest] = groups;
    if (rest.some((g) => g.batch !== first.batch || g.track !== first.track)) {
      throw new ValidationError('Only training modules from the same batch and track can be merged');
    }
    const module_ = await trainingModuleRecordRepository.findOrCreate(ctx.instituteId, first.batch, first.track, targetModuleName);
    return bankQuestionRepository.mergeModuleGroups(ctx.instituteId, groups, { trainingModuleId: String(module_._id), trainingModuleName: module_.moduleName });
  },

  async deleteSource(id: string, ctx: AuthContext): Promise<void> {
    const existing = await bankQuestionSourceRepository.findById(id, ctx.instituteId);
    if (!existing) throw new NotFoundError('Upload');

    const deleted = await bankQuestionSourceRepository.delete(id, ctx.instituteId);
    if (!deleted) throw new ValidationError('Could not delete this upload');
  },

  /** GET /question-bank/tpo/overview — one row per batch/track with question/paper counts and the
   *  faculty member who owns that batch/track (per Training Schedule). Route is already
   *  role-gated to admin/tpo. */
  async getTpoOverview(ctx: AuthContext): Promise<TpoOverviewEntry[]> {
    const [questions, papers] = await Promise.all([
      bankQuestionRepository.findAllForInstitute(ctx.instituteId),
      generatedPaperRepository.findAllForInstitute(ctx.instituteId),
    ]);

    interface Bucket { batch: string; track: string; questionCount: number; paperCount: number; lastActivityAt?: Date }
    const buckets = new Map<string, Bucket>();
    const bucketFor = (batch: string, track: string): Bucket => {
      const key = `${batch}::${track}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { batch, track, questionCount: 0, paperCount: 0 };
        buckets.set(key, bucket);
      }
      return bucket;
    };
    const touch = (bucket: Bucket, at: Date) => {
      if (!bucket.lastActivityAt || at > bucket.lastActivityAt) bucket.lastActivityAt = at;
    };

    for (const q of questions) {
      const bucket = bucketFor(q.batch, q.track);
      bucket.questionCount += 1;
      touch(bucket, q.createdAt);
    }
    for (const p of papers) {
      const bucket = bucketFor(p.config.batch, p.config.track);
      bucket.paperCount += 1;
      touch(bucket, p.createdAt);
    }

    const schedule = await trainingScheduleRepository.findAll(ctx.instituteId, { limit: 1000 });
    const facultyIds = [...new Set(schedule.data.map((e) => e.facultyId))];
    const facultyDocs = facultyIds.length
      ? await Faculty.find({ _id: { $in: facultyIds } }).select('fullName').lean<{ _id: unknown; fullName: string }[]>()
      : [];
    const nameById = new Map(facultyDocs.map((f) => [String(f._id), f.fullName]));
    const facultyNameByBatchTrack = new Map<string, string>();
    for (const entry of schedule.data) {
      facultyNameByBatchTrack.set(`${entry.batch}::${entry.track}`, nameById.get(entry.facultyId) ?? '');
    }

    return [...buckets.values()]
      .map((b) => ({
        batch: b.batch,
        track: b.track,
        facultyName: facultyNameByBatchTrack.get(`${b.batch}::${b.track}`) ?? 'Unassigned',
        questionCount: b.questionCount,
        paperCount: b.paperCount,
        lastActivityAt: b.lastActivityAt?.toISOString(),
      }))
      .sort((a, b) => a.batch.localeCompare(b.batch, undefined, { numeric: true }) || a.track.localeCompare(b.track));
  },
};
