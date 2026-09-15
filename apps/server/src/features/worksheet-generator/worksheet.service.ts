import { AuthContext } from '../../lib/auth-context';
import { NotFoundError, ValidationError } from '../../middlewares/errorHandler';
import { trainingModuleRecordRepository } from '../question-bank/training-module-record.repository';
import { bankQuestionRepository } from '../question-bank/bank-question.repository';
import { assertFacultyCanAccessQuestionBank } from '../training-schedule/training-schedule.service';
import { worksheetRepository, WorksheetListOptions } from './worksheet.repository';
import { IWorksheet } from './worksheet.model';
import { worksheetGeneratorService, GenerateWorksheetInput, GenerateWorksheetFromContentInput } from './worksheet-generator.service';
import { SaveWorksheetInput, UpdateWorksheetInput, UploadWorksheetInput } from './worksheet.validation';
import { resolveQuestionImages } from '../question-bank/image-resolution';
import { r2Storage } from '../../lib/r2-storage';
import { fileToDataUri } from '../../lib/image-upload';
import { resolveCandidateId } from '../candidates/candidate.service';
import { candidateRepository } from '../candidates/candidate.repository';
import type { ResolvedQuestionImage } from '@placementos/types';

export const worksheetService = {
  /** Never persists — the faculty member reviews/edits before calling save(). */
  async generate(input: GenerateWorksheetInput, ctx: AuthContext) {
    await assertFacultyCanAccessQuestionBank(ctx, input.batch, input.track);
    return worksheetGeneratorService.generate(input, ctx);
  },

  /** Content-driven mode — never persists, just returns the AI's draft + its own review
   *  for the faculty member to read before editing and calling save(). */
  async generateFromContent(input: GenerateWorksheetFromContentInput, ctx: AuthContext) {
    await assertFacultyCanAccessQuestionBank(ctx, input.batch, input.track);
    return worksheetGeneratorService.generateFromContent(input, ctx);
  },

  async save(data: SaveWorksheetInput, ctx: AuthContext): Promise<IWorksheet> {
    await assertFacultyCanAccessQuestionBank(ctx, data.batch, data.track);

    if (data.sourceType === 'content_upload') {
      // A content-driven worksheet still needs a TrainingModuleRecord to hang off of
      // (the module list is how faculty browse their saved worksheets elsewhere), so
      // find-or-create one using the module name the faculty already gave it — same
      // pattern the image/PDF question-bank upload flow uses.
      const module_ = await trainingModuleRecordRepository.findOrCreate(ctx.instituteId, data.batch, data.track, data.moduleName!);
      return worksheetRepository.create({
        instituteId: ctx.instituteId,
        facultyId: ctx.userId,
        batch: data.batch,
        track: data.track,
        trainingModuleIds: [String(module_._id)],
        trainingModuleNames: [module_.moduleName],
        worksheetType: data.worksheetType,
        title: data.title,
        questions: data.questions.map((q) => ({ ...q, options: q.options ?? undefined, isNew: undefined })),
        sourceType: 'content_upload',
        sourceContent: data.sourceContent,
        aiReview: data.aiReview,
        createdBy: ctx.userId,
      });
    }

    const modules = await trainingModuleRecordRepository.findByIds(ctx.instituteId, data.trainingModuleIds);
    if (modules.length === 0) throw new ValidationError('No matching training modules found');

    // Newly-authored items the faculty member kept get saved to the bank if opted in, and swap
    // their draft entry for a real questionId so the worksheet snapshot stays consistent.
    const newItems = data.questions.filter((q) => q.isNew);
    let savedNewIds: string[] = [];
    if (data.addNewToBank && newItems.length > 0) {
      const primaryModule = modules[0];
      const created = await bankQuestionRepository.createMany(
        newItems.map((q) => ({
          instituteId: ctx.instituteId,
          batch: data.batch,
          track: data.track,
          trainingModuleId: String(primaryModule._id),
          trainingModuleName: primaryModule.moduleName,
          questionText: q.questionText,
          questionType: q.questionType,
          options: q.options ?? undefined,
          difficulty: q.difficulty,
          marks: 1,
          estimatedTimeMinutes: q.estimatedTimeMinutes,
          bloomsLevel: 'understand',
          keywords: q.keywords,
          createdBy: ctx.userId,
          imageRef: q.imageRef,
          imageRequirement: q.imageRequirement,
        }))
      );
      savedNewIds = created.map((c) => String(c._id));
    }

    let newIdx = 0;
    const questions = data.questions.map((q) => {
      const base = { ...q, options: q.options ?? undefined, isNew: undefined };
      if (q.isNew && data.addNewToBank) {
        const id = savedNewIds[newIdx];
        newIdx += 1;
        return { ...base, questionId: id };
      }
      return base;
    });

    return worksheetRepository.create({
      instituteId: ctx.instituteId,
      facultyId: ctx.userId,
      batch: data.batch,
      track: data.track,
      trainingModuleIds: data.trainingModuleIds,
      trainingModuleNames: modules.map((m) => m.moduleName),
      worksheetType: data.worksheetType,
      title: data.title,
      questions,
      createdBy: ctx.userId,
    });
  },

  /** "I already have this worksheet on paper" — a photo or PDF of an existing sheet, attached
   *  as-is with no AI authoring. Listed and downloadable exactly like a generated one. */
  async saveFromAttachment(
    file: { buffer: Buffer; mimetype: string; originalname?: string },
    data: UploadWorksheetInput,
    ctx: AuthContext
  ): Promise<IWorksheet> {
    await assertFacultyCanAccessQuestionBank(ctx, data.batch, data.track);

    const attachmentUrl = r2Storage.isConfigured()
      ? (await r2Storage.uploadToR2(file.buffer, file.mimetype, 'worksheets', ctx.instituteId)).url
      : fileToDataUri(file as Express.Multer.File);

    return worksheetRepository.create({
      instituteId: ctx.instituteId,
      facultyId: ctx.userId,
      batch: data.batch,
      track: data.track,
      trainingModuleIds: [],
      trainingModuleNames: [],
      worksheetType: data.worksheetType,
      title: data.title,
      questions: [],
      sourceType: 'photo_upload',
      attachmentUrl,
      attachmentFileName: file.originalname,
      createdBy: ctx.userId,
    });
  },

  /** Candidate-facing: every worksheet saved for their own batch. */
  async listMine(ctx: AuthContext): Promise<IWorksheet[]> {
    const candidateId = await resolveCandidateId(ctx);
    const candidate = await candidateRepository.findById(candidateId, ctx.instituteId);
    if (!candidate) throw new NotFoundError('Candidate');
    return worksheetRepository.findForBatch(ctx.instituteId, candidate.batch);
  },

  /** Candidate-facing: one worksheet, only if it's for their own batch. */
  async getMineById(id: string, ctx: AuthContext): Promise<IWorksheet & { resolvedImages: Record<string, ResolvedQuestionImage> }> {
    const candidateId = await resolveCandidateId(ctx);
    const candidate = await candidateRepository.findById(candidateId, ctx.instituteId);
    if (!candidate) throw new NotFoundError('Candidate');

    const worksheet = await worksheetRepository.findById(id, ctx.instituteId);
    if (!worksheet || worksheet.batch !== candidate.batch) throw new NotFoundError('Worksheet');

    const resolvedImages = await resolveQuestionImages(worksheet.questions, ctx.instituteId);
    return { ...worksheet, resolvedImages } as IWorksheet & { resolvedImages: Record<string, ResolvedQuestionImage> };
  },

  /** When batch+track are given, this lists everything saved for that batch/track (not just this
   *  faculty member's own). With no batch/track, falls back to "my worksheets". */
  async list(query: WorksheetListOptions, ctx: AuthContext) {
    if (query.batch && query.track) {
      await assertFacultyCanAccessQuestionBank(ctx, query.batch, query.track);
      return worksheetRepository.findAll(ctx.instituteId, undefined, query);
    }
    return worksheetRepository.findAll(ctx.instituteId, ctx.userId, query);
  },

  async getById(id: string, ctx: AuthContext): Promise<IWorksheet & { resolvedImages: Record<string, ResolvedQuestionImage> }> {
    const worksheet = await worksheetRepository.findById(id, ctx.instituteId);
    if (!worksheet) throw new NotFoundError('Worksheet');
    await assertFacultyCanAccessQuestionBank(ctx, worksheet.batch, worksheet.track);
    const resolvedImages = await resolveQuestionImages(worksheet.questions, ctx.instituteId);
    return { ...worksheet, resolvedImages } as IWorksheet & { resolvedImages: Record<string, ResolvedQuestionImage> };
  },

  async delete(id: string, ctx: AuthContext): Promise<void> {
    const existing = await worksheetRepository.findById(id, ctx.instituteId);
    if (!existing) throw new NotFoundError('Worksheet');
    await assertFacultyCanAccessQuestionBank(ctx, existing.batch, existing.track);

    const deleted = await worksheetRepository.softDelete(id, ctx.instituteId);
    if (!deleted) throw new ValidationError('Could not delete this worksheet');
  },

  /** Post-save editing — title and/or per-question text/difficulty/time, matched by index. A
   *  structural change (adding/removing questions) isn't supported here; regenerate instead. */
  async update(id: string, data: UpdateWorksheetInput, ctx: AuthContext): Promise<IWorksheet> {
    const existing = await worksheetRepository.findById(id, ctx.instituteId);
    if (!existing) throw new NotFoundError('Worksheet');
    await assertFacultyCanAccessQuestionBank(ctx, existing.batch, existing.track);

    const patch: { title?: string; questions?: IWorksheet['questions'] } = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.questions) {
      if (data.questions.length !== existing.questions.length) {
        throw new ValidationError('Question count changed — regenerate the worksheet instead of editing it directly');
      }
      patch.questions = existing.questions.map((q, i) => ({
        ...q,
        questionText: data.questions![i].questionText,
        options: data.questions![i].options ?? undefined,
        difficulty: data.questions![i].difficulty,
        estimatedTimeMinutes: data.questions![i].estimatedTimeMinutes,
      }));
    }

    const updated = await worksheetRepository.update(id, ctx.instituteId, patch);
    if (!updated) throw new NotFoundError('Worksheet');
    return updated;
  },
};
