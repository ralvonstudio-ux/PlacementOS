import { Request, Response, NextFunction } from 'express';
import { buildAuthContext } from '../../lib/auth-context';
import { fileToDataUri } from '../../lib/image-upload';
import { sendSuccess, sendCreated, sendPaginated } from '../../lib/response';
import { ValidationError } from '../../middlewares/errorHandler';
import { questionExtractionService } from './question-extraction.service';
import { questionBankService } from './question-bank.service';
import { paperGeneratorService } from './paper-generator.service';
import {
  extractionTargetSchema,
  extractChapterTargetSchema,
  confirmExtractedQuestionsSchema,
  createQuestionSchema,
  updateQuestionSchema,
  listQuestionsSchema,
  listQuestionGroupsSchema,
  deleteQuestionGroupsSchema,
  mergeQuestionGroupsSchema,
  listModulesSchema,
  listSourcesSchema,
  updateSourceSchema,
  retryPageParamsSchema,
  saveChapterSourceSchema,
  paperGenerationConfigSchema,
  reExtractSourceSchema,
} from './question-bank.validation';

export const questionBankController = {
  /** POST /question-bank/extract/image?batch=B1&track=DSA&detectImages=true */
  async extractFromImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) throw new ValidationError('An image file is required');
      const target = extractionTargetSchema.parse(req.query);
      const ctx = buildAuthContext(req.user!);
      const job = await questionExtractionService.enqueueExtractFromImage(
        target.batch, target.track, target.trainingModuleName, fileToDataUri(req.file), ctx, req.file.originalname, target.detectImages
      );
      sendCreated(res, job, 'Reading the page…');
    } catch (err) { next(err); }
  },

  /** POST /question-bank/extract/pdf?batch=B1&track=DSA */
  async extractFromPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) throw new ValidationError('A PDF file is required');
      const target = extractionTargetSchema.parse(req.query);
      const ctx = buildAuthContext(req.user!);
      const job = await questionExtractionService.enqueueExtractFromPdf(
        target.batch, target.track, target.trainingModuleName, req.file.buffer, ctx, req.file.originalname
      );
      sendCreated(res, job, 'Reading the document…');
    } catch (err) { next(err); }
  },

  /** GET /question-bank/extract/jobs/:id */
  async getExtractionJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!);
      const job = await questionExtractionService.getExtractionJob(req.params.id, ctx);
      sendSuccess(res, job);
    } catch (err) { next(err); }
  },

  /** POST /question-bank/extract/chapter — one image per captured page, read straight into question drafts. */
  async extractChapter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      if (files.length === 0) throw new ValidationError('At least one page image is required');
      const target = extractChapterTargetSchema.parse(req.body ?? {});
      const images = files.map((f) => ({ dataUri: fileToDataUri(f), fileName: f.originalname }));
      const job = await questionBankService.enqueueChapterCapture(target.batch, target.track, target.trainingModuleName, images, buildAuthContext(req.user!), target.detectImages);
      sendCreated(res, job, `Reading ${files.length} page(s)…`);
    } catch (err) { next(err); }
  },

  /** POST /question-bank/extract/jobs/:id/pages/:pageNumber/retry */
  async retryChapterPage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) throw new ValidationError('An image file is required');
      const params = retryPageParamsSchema.parse({ id: req.params.id, pageNumber: req.params.pageNumber });
      const ctx = buildAuthContext(req.user!);
      const result = await questionBankService.retryChapterPage(params.id, params.pageNumber, fileToDataUri(req.file), ctx);
      sendSuccess(res, result, 'Page reprocessed');
    } catch (err) { next(err); }
  },

  /** POST /question-bank/sources — finalizes a reviewed module capture into a permanent, saved source. */
  async saveChapterSource(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = saveChapterSourceSchema.parse(req.body);
      const ctx = buildAuthContext(req.user!);
      const source = await questionBankService.saveChapterSource(data, ctx);
      sendCreated(res, source, 'Training module saved');
    } catch (err) { next(err); }
  },

  /** POST /question-bank/extract/confirm — save reviewed draft questions to the bank */
  async confirmExtracted(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = confirmExtractedQuestionsSchema.parse(req.body);
      const ctx = buildAuthContext(req.user!);
      const questions = await questionBankService.confirmExtractedQuestions(data, ctx);
      sendCreated(res, questions, `${questions.length} question(s) saved to the bank`);
    } catch (err) { next(err); }
  },

  /** GET /question-bank/sources[?batch=B1&track=DSA] */
  async listSources(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listSourcesSchema.parse(req.query);
      const ctx = buildAuthContext(req.user!);
      const sources = await questionBankService.listSources(query, ctx);
      sendSuccess(res, sources);
    } catch (err) { next(err); }
  },

  /** GET /question-bank/sources/:id */
  async getSource(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!);
      const source = await questionBankService.getSource(req.params.id, ctx);
      sendSuccess(res, source);
    } catch (err) { next(err); }
  },

  /** POST /question-bank/sources/:id/re-extract */
  async reExtractSource(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const options = reExtractSourceSchema.parse(req.body ?? {});
      const ctx = buildAuthContext(req.user!);
      const job = await questionBankService.reExtractSource(req.params.id, options, ctx);
      sendCreated(res, job, 'Re-reading the saved text…');
    } catch (err) { next(err); }
  },

  /** PATCH /question-bank/sources/:id */
  async updateSource(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = updateSourceSchema.parse(req.body);
      const ctx = buildAuthContext(req.user!);
      const source = await questionBankService.updateSource(req.params.id, data, ctx);
      sendSuccess(res, source, 'Saved');
    } catch (err) { next(err); }
  },

  /** DELETE /question-bank/sources/:id */
  async deleteSource(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!);
      await questionBankService.deleteSource(req.params.id, ctx);
      sendSuccess(res, null, 'Upload deleted');
    } catch (err) { next(err); }
  },

  /** GET /question-bank/modules?batch=B1&track=DSA */
  async listModules(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listModulesSchema.parse(req.query);
      const ctx = buildAuthContext(req.user!);
      const modules = await questionBankService.listModules(query, ctx);
      sendSuccess(res, modules);
    } catch (err) { next(err); }
  },

  /** GET /question-bank/questions */
  async listQuestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listQuestionsSchema.parse(req.query);
      const ctx = buildAuthContext(req.user!);
      const result = await questionBankService.listQuestions(query, ctx);
      sendPaginated(res, result.questions, { page: result.page, limit: result.limit, total: result.total });
    } catch (err) { next(err); }
  },

  /** GET /question-bank/questions/groups */
  async listQuestionGroups(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listQuestionGroupsSchema.parse(req.query);
      const ctx = buildAuthContext(req.user!);
      const groups = await questionBankService.listQuestionGroups(query, ctx);
      sendSuccess(res, groups);
    } catch (err) { next(err); }
  },

  /** DELETE /question-bank/questions/groups */
  async deleteQuestionGroups(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = deleteQuestionGroupsSchema.parse(req.body);
      const ctx = buildAuthContext(req.user!);
      const count = await questionBankService.deleteQuestionGroups(data.groups, ctx);
      sendSuccess(res, null, `${count} question(s) deleted`);
    } catch (err) { next(err); }
  },

  /** POST /question-bank/questions/groups/merge */
  async mergeQuestionGroups(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = mergeQuestionGroupsSchema.parse(req.body);
      const ctx = buildAuthContext(req.user!);
      const count = await questionBankService.mergeQuestionGroups(data.groups, data.targetModuleName, ctx);
      sendSuccess(res, { modified: count }, 'Training modules merged');
    } catch (err) { next(err); }
  },

  /** GET /question-bank/questions/:id */
  async getQuestion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!);
      const question = await questionBankService.getQuestion(req.params.id, ctx);
      sendSuccess(res, question);
    } catch (err) { next(err); }
  },

  /** POST /question-bank/questions — manual add without AI */
  async createQuestion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = createQuestionSchema.parse(req.body);
      const ctx = buildAuthContext(req.user!);
      const question = await questionBankService.createQuestion(data, ctx);
      sendCreated(res, question, 'Question added');
    } catch (err) { next(err); }
  },

  /** PATCH /question-bank/questions/:id */
  async updateQuestion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = updateQuestionSchema.parse(req.body);
      const ctx = buildAuthContext(req.user!);
      const question = await questionBankService.updateQuestion(req.params.id, data, ctx);
      sendSuccess(res, question, 'Question updated');
    } catch (err) { next(err); }
  },

  /** DELETE /question-bank/questions/:id */
  async deleteQuestion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!);
      await questionBankService.deleteQuestion(req.params.id, ctx);
      sendSuccess(res, null, 'Question deleted');
    } catch (err) { next(err); }
  },

  /** POST /question-bank/papers/generate */
  async generatePaper(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = paperGenerationConfigSchema.parse(req.body);
      const ctx = buildAuthContext(req.user!);
      const paper = await paperGeneratorService.generate(config, ctx);
      sendCreated(res, paper, 'Paper generated');
    } catch (err) { next(err); }
  },

  /** GET /question-bank/papers/:id */
  async getPaper(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!);
      const paper = await paperGeneratorService.getById(req.params.id, ctx);
      sendSuccess(res, paper);
    } catch (err) { next(err); }
  },

  /** GET /question-bank/papers — browse previously generated papers for a batch/track. */
  async listPapers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!);
      const { batch, track, page, limit } = req.query;
      const result = await paperGeneratorService.list(
        {
          batch: typeof batch === 'string' ? batch : undefined,
          track: typeof track === 'string' ? track : undefined,
          page: page ? Number(page) : undefined,
          limit: limit ? Number(limit) : undefined,
        },
        ctx
      );
      sendSuccess(res, result);
    } catch (err) { next(err); }
  },

  /** DELETE /question-bank/papers/:id */
  async deletePaper(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!);
      await paperGeneratorService.delete(req.params.id, ctx);
      sendSuccess(res, null, 'Paper deleted');
    } catch (err) { next(err); }
  },

  /** GET /question-bank/tpo/overview */
  async getTpoOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!);
      const overview = await questionBankService.getTpoOverview(ctx);
      sendSuccess(res, overview);
    } catch (err) { next(err); }
  },
};
