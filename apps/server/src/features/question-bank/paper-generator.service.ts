import { GeneratedQuestionPaper, GeneratedPaperSection, PaperGenerationConfig, BankQuestion as BankQuestionDto } from '@placementos/types';
import { AuthContext } from '../../lib/auth-context';
import { NotFoundError, ValidationError } from '../../middlewares/errorHandler';
import { logger } from '../../lib/logger';
import { trainingModuleRecordRepository } from './training-module-record.repository';
import { bankQuestionRepository } from './bank-question.repository';
import { bankQuestionSourceRepository } from './bank-question-source.repository';
import { questionExtractionService } from './question-extraction.service';
import { generatedPaperRepository } from './generated-paper.repository';
import { paperValidationService } from './paper-validation.service';
import { IBankQuestion, QuestionDifficulty } from './bank-question.model';
import { ITrainingModuleRecord } from './training-module-record.model';
import { collectModuleFigures } from './figure-lookup';
import { resolveQuestionImages } from './image-resolution';
import { assertFacultyCanAccessQuestionBank, getFacultyAllowedBatchTracks } from '../training-schedule/training-schedule.service';

function toDto(q: IBankQuestion): BankQuestionDto {
  return {
    _id: String(q._id),
    instituteId: q.instituteId,
    batch: q.batch,
    track: q.track,
    trainingModuleId: q.trainingModuleId,
    trainingModuleName: q.trainingModuleName,
    topic: q.topic,
    topicId: q.topicId,
    subtopicId: q.subtopicId,
    questionText: q.questionText,
    questionType: q.questionType,
    options: q.options,
    correctAnswer: q.correctAnswer,
    difficulty: q.difficulty,
    marks: q.marks,
    estimatedTimeMinutes: q.estimatedTimeMinutes,
    bloomsLevel: q.bloomsLevel,
    keywords: q.keywords,
    source: q.source,
    usageHistory: q.usageHistory.map((u) => ({ examId: u.examId, usedAt: u.usedAt.toISOString() })),
    createdBy: q.createdBy,
    isDeleted: q.isDeleted,
    imageRef: q.imageRef,
    imageRequirement: q.imageRequirement,
    visualBased: q.visualBased,
  };
}

/** Greedily fills each requested marks-bucket, preferring questions whose difficulty still has quota remaining and that have been used least recently. */
function selectQuestions(pool: IBankQuestion[], config: PaperGenerationConfig): IBankQuestion[] {
  const remaining: Record<QuestionDifficulty, number> = { ...config.difficultyMix };
  const selectedIds = new Set<string>();
  const selected: IBankQuestion[] = [];
  const typeFilter = new Set(config.questionTypes);

  const sortedBreakdown = [...config.marksBreakdown].sort((a, b) => a.marks - b.marks);

  for (const entry of sortedBreakdown) {
    const candidates = pool.filter((q) => q.marks === entry.marks && !selectedIds.has(String(q._id)) && (typeFilter.size === 0 || typeFilter.has(q.questionType)));

    candidates.sort((a, b) => {
      const aPriority = remaining[a.difficulty] > 0 ? 0 : 1;
      const bPriority = remaining[b.difficulty] > 0 ? 0 : 1;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a.usageHistory.length - b.usageHistory.length;
    });

    const take = candidates.slice(0, entry.count);
    for (const q of take) {
      selectedIds.add(String(q._id));
      selected.push(q);
      if (remaining[q.difficulty] > 0) remaining[q.difficulty] -= 1;
    }
  }

  return selected;
}

/** Fills any marks-bucket the pool couldn't satisfy exactly by asking the AI to write new
 *  questions for it — the requested marks value is never treated as a reason to come back empty. */
async function fillMarksGapsWithAi(
  pool: IBankQuestion[], selected: IBankQuestion[], modules: ITrainingModuleRecord[], config: PaperGenerationConfig, ctx: AuthContext
): Promise<IBankQuestion[]> {
  const actualByMarks = new Map<number, number>();
  for (const q of selected) actualByMarks.set(q.marks, (actualByMarks.get(q.marks) ?? 0) + 1);

  const sources = await bankQuestionSourceRepository.findAll(ctx.instituteId, config.batch, config.track).catch(() => []);

  const marksByModule = new Map<string, number>();
  for (const q of selected) marksByModule.set(q.trainingModuleId, (marksByModule.get(q.trainingModuleId) ?? 0) + 1);

  interface Task {
    marks: number;
    count: number;
    module_: ITrainingModuleRecord;
    contextText: string;
    questionType?: PaperGenerationConfig['questionTypes'][number];
  }
  const tasks: Task[] = [];

  for (const entry of config.marksBreakdown) {
    const have = actualByMarks.get(entry.marks) ?? 0;
    const short = entry.count - have;
    if (short <= 0) continue;

    const module_ = [...modules].sort((a, b) => (marksByModule.get(String(a._id)) ?? 0) - (marksByModule.get(String(b._id)) ?? 0))[0];
    if (!module_) continue;
    marksByModule.set(String(module_._id), (marksByModule.get(String(module_._id)) ?? 0) + short);

    const contextQuestions = pool.filter((q) => q.trainingModuleId === String(module_._id)).map((q) => q.questionText).slice(0, 10);
    const contextSourceText = sources.filter((s) => s.trainingModuleName === module_.moduleName).map((s) => s.extractedText).join('\n\n');
    const contextText = [...contextQuestions, contextSourceText].filter(Boolean).join('\n\n') || `Module topics: ${module_.topics.join(', ') || module_.moduleName}`;

    if (config.questionTypes.length === 0) {
      tasks.push({ marks: entry.marks, count: short, module_, contextText, questionType: undefined });
    } else {
      const perType = new Map<PaperGenerationConfig['questionTypes'][number], number>();
      for (let i = 0; i < short; i++) {
        const t = config.questionTypes[i % config.questionTypes.length];
        perType.set(t, (perType.get(t) ?? 0) + 1);
      }
      for (const [questionType, count] of perType) {
        tasks.push({ marks: entry.marks, count, module_, contextText, questionType });
      }
    }
  }

  if (tasks.length === 0) return [];

  const results = await Promise.allSettled(tasks.map((task) =>
    questionExtractionService.synthesizeQuestions(
      {
        batch: config.batch, track: config.track, trainingModuleName: task.module_.moduleName, marks: task.marks, count: task.count,
        questionType: task.questionType, contextText: task.contextText, languageComplexity: config.languageComplexity,
        includeImages: config.includeImages, figures: config.includeImages ? collectModuleFigures(sources, task.module_.moduleName) : undefined,
      },
      ctx
    )
  ));

  const created: IBankQuestion[] = [];
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const result = results[i];

    if (result.status === 'rejected') {
      logger.error('[PaperGenerator] AI question synthesis failed for a marks gap', {
        instituteId: ctx.instituteId, trainingModuleId: String(task.module_._id), marks: task.marks,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
      continue;
    }

    const drafts = result.value;
    if (drafts.length === 0) continue;

    const newQuestions = await bankQuestionRepository.createMany(drafts.map((d) => ({
      instituteId: ctx.instituteId, batch: config.batch, track: config.track,
      trainingModuleId: String(task.module_._id), trainingModuleName: task.module_.moduleName,
      topic: d.topic, questionText: d.questionText, questionType: d.questionType, options: d.options,
      correctAnswer: d.correctAnswer, difficulty: d.difficulty, marks: task.marks,
      estimatedTimeMinutes: d.estimatedTimeMinutes, bloomsLevel: d.bloomsLevel, keywords: d.keywords,
      source: 'AI-generated to complete a paper request', createdBy: ctx.userId,
      imageRef: d.imageRef, imageRequirement: d.imageRequirement,
    })));

    created.push(...newQuestions);
    selected.push(...newQuestions);
    pool.push(...newQuestions);
  }

  return created;
}

/** Swaps out selected questions from a difficulty with genuine surplus for freshly AI-authored
 *  replacements targeted at a difficulty still short of its requested count — runs after marks
 *  gaps are filled. Swaps only happen once the AI call for that batch succeeds. */
async function fillDifficultyGapsWithAi(
  pool: IBankQuestion[], selected: IBankQuestion[], modules: ITrainingModuleRecord[], config: PaperGenerationConfig, ctx: AuthContext
): Promise<IBankQuestion[]> {
  const requestedTotal = config.difficultyMix.easy + config.difficultyMix.medium + config.difficultyMix.hard;
  if (requestedTotal === 0) return [];

  const actual: Record<QuestionDifficulty, number> = { easy: 0, medium: 0, hard: 0 };
  for (const q of selected) actual[q.difficulty] += 1;

  const shortfall: Record<QuestionDifficulty, number> = {
    easy: Math.max(0, config.difficultyMix.easy - actual.easy),
    medium: Math.max(0, config.difficultyMix.medium - actual.medium),
    hard: Math.max(0, config.difficultyMix.hard - actual.hard),
  };
  const surplus: Record<QuestionDifficulty, number> = {
    easy: Math.max(0, actual.easy - config.difficultyMix.easy),
    medium: Math.max(0, actual.medium - config.difficultyMix.medium),
    hard: Math.max(0, actual.hard - config.difficultyMix.hard),
  };

  interface SwapTask {
    marks: number;
    difficulty: QuestionDifficulty;
    questionType?: BankQuestionDto['questionType'];
    count: number;
    module_: ITrainingModuleRecord;
    victims: IBankQuestion[];
  }
  const tasks = new Map<string, SwapTask>();
  const marksByModule = new Map<string, number>();
  for (const q of selected) marksByModule.set(q.trainingModuleId, (marksByModule.get(q.trainingModuleId) ?? 0) + 1);

  (['hard', 'medium', 'easy'] as const).forEach((level) => {
    let need = shortfall[level];
    while (need > 0) {
      let victimIdx = -1;
      let bestSurplus = 0;
      for (let i = 0; i < selected.length; i++) {
        const d = selected[i].difficulty;
        if (d === level || surplus[d] <= 0) continue;
        if (surplus[d] > bestSurplus) { bestSurplus = surplus[d]; victimIdx = i; }
      }
      if (victimIdx === -1) break;

      const victim = selected[victimIdx];
      surplus[victim.difficulty] -= 1;
      selected.splice(victimIdx, 1);

      const module_ = modules.find((m) => String(m._id) === victim.trainingModuleId)
        ?? [...modules].sort((a, b) => (marksByModule.get(String(a._id)) ?? 0) - (marksByModule.get(String(b._id)) ?? 0))[0];

      const key = `${victim.marks}::${level}::${victim.questionType}`;
      const task = tasks.get(key) ?? { marks: victim.marks, difficulty: level, questionType: victim.questionType, count: 0, module_, victims: [] };
      task.count += 1;
      task.victims.push(victim);
      tasks.set(key, task);
      need -= 1;
    }
  });

  if (tasks.size === 0) return [];

  const sources = config.includeImages
    ? await bankQuestionSourceRepository.findAll(ctx.instituteId, config.batch, config.track).catch(() => [])
    : [];

  const taskList = [...tasks.values()];
  const results = await Promise.allSettled(taskList.map((task) =>
    questionExtractionService.synthesizeQuestions(
      {
        batch: config.batch, track: config.track, trainingModuleName: task.module_.moduleName, marks: task.marks, count: task.count,
        difficulty: task.difficulty, questionType: task.questionType,
        contextText: pool.filter((q) => q.trainingModuleId === String(task.module_._id)).map((q) => q.questionText).slice(0, 10).join('\n\n'),
        languageComplexity: config.languageComplexity,
        includeImages: config.includeImages, figures: config.includeImages ? collectModuleFigures(sources, task.module_.moduleName) : undefined,
      },
      ctx
    )
  ));

  const created: IBankQuestion[] = [];
  for (let i = 0; i < taskList.length; i++) {
    const task = taskList[i];
    const result = results[i];

    if (result.status === 'rejected' || result.value.length === 0) {
      logger.error('[PaperGenerator] AI difficulty-gap synthesis failed', {
        instituteId: ctx.instituteId, trainingModuleId: String(task.module_._id), difficulty: task.difficulty, marks: task.marks,
        error: result.status === 'rejected' ? (result.reason instanceof Error ? result.reason.message : String(result.reason)) : undefined,
      });
      selected.push(...task.victims);
      continue;
    }

    const drafts = result.value;
    const newQuestions = await bankQuestionRepository.createMany(drafts.map((d) => ({
      instituteId: ctx.instituteId, batch: config.batch, track: config.track,
      trainingModuleId: String(task.module_._id), trainingModuleName: task.module_.moduleName,
      topic: d.topic, questionText: d.questionText, questionType: d.questionType, options: d.options,
      correctAnswer: d.correctAnswer, difficulty: task.difficulty, marks: task.marks,
      estimatedTimeMinutes: d.estimatedTimeMinutes, bloomsLevel: d.bloomsLevel, keywords: d.keywords,
      source: 'AI-generated to complete a paper request', createdBy: ctx.userId,
      imageRef: d.imageRef, imageRequirement: d.imageRequirement,
    })));

    created.push(...newQuestions);
    selected.push(...newQuestions);
    pool.push(...newQuestions);

    if (newQuestions.length < task.victims.length) {
      selected.push(...task.victims.slice(newQuestions.length));
    }
  }

  return created;
}

function groupByMarks(questions: IBankQuestion[]): GeneratedPaperSection[] {
  const byMarks = new Map<number, IBankQuestion[]>();
  for (const q of questions) {
    const bucket = byMarks.get(q.marks) ?? [];
    bucket.push(q);
    byMarks.set(q.marks, bucket);
  }
  return [...byMarks.entries()].sort(([a], [b]) => a - b).map(([marks, qs]) => ({ marks, questions: qs.map(toDto) }));
}

/** Assembles a paper section-by-section — each section is its own self-contained
 *  selectQuestions + gap-fill run, drawing from a shared pool that shrinks as earlier sections
 *  claim questions so nothing is double-counted across sections. */
async function generateBySections(
  pool: IBankQuestion[], modules: ITrainingModuleRecord[], config: PaperGenerationConfig, ctx: AuthContext
): Promise<{ selected: IBankQuestion[]; sections: GeneratedPaperSection[]; sectionSizes: number[] }> {
  const usedIds = new Set<string>();
  const workingPool = [...pool];
  const allSelected: IBankQuestion[] = [];
  const sections: GeneratedPaperSection[] = [];
  const sectionSizes: number[] = [];

  for (const sec of config.sections!) {
    const subConfig: PaperGenerationConfig = {
      ...config,
      marksBreakdown: [{ marks: sec.marksEach, count: sec.count }],
      difficultyMix: sec.difficulty ? { easy: 0, medium: 0, hard: 0, [sec.difficulty]: sec.count } : { easy: 0, medium: 0, hard: 0 },
      questionTypes: sec.questionTypes.length > 0 ? sec.questionTypes : config.questionTypes,
    };

    const availablePool = workingPool.filter((q) => !usedIds.has(String(q._id)));
    const secSelected = selectQuestions(availablePool, subConfig);
    await fillMarksGapsWithAi(availablePool, secSelected, modules, subConfig, ctx);
    if (sec.difficulty) await fillDifficultyGapsWithAi(availablePool, secSelected, modules, subConfig, ctx);

    for (const q of secSelected) usedIds.add(String(q._id));
    for (const q of availablePool) {
      if (!workingPool.some((w) => String(w._id) === String(q._id))) workingPool.push(q);
    }

    allSelected.push(...secSelected);
    sections.push({ marks: sec.marksEach, name: sec.name, questions: secSelected.map(toDto) });
    sectionSizes.push(secSelected.length);
  }

  return { selected: allSelected, sections, sectionSizes };
}

export const paperGeneratorService = {
  async generate(config: PaperGenerationConfig, ctx: AuthContext): Promise<GeneratedQuestionPaper> {
    await assertFacultyCanAccessQuestionBank(ctx, config.batch, config.track);
    const modules = await trainingModuleRecordRepository.findByIds(ctx.instituteId, config.trainingModuleIds);
    if (modules.length === 0) throw new ValidationError('No matching training modules found for this batch/track');

    const pool = await bankQuestionRepository.findEligible(ctx.instituteId, config.batch, config.track, config.trainingModuleIds, config.topicIds);

    const usingSections = Boolean(config.sections && config.sections.length > 0);
    let selected: IBankQuestion[];
    let sections: GeneratedPaperSection[];
    let sectionSizes: number[] | undefined;
    let validationConfig = config;

    if (usingSections) {
      const result = await generateBySections(pool, modules, config, ctx);
      selected = result.selected;
      sections = result.sections;
      sectionSizes = result.sectionSizes;
      validationConfig = {
        ...config,
        marksBreakdown: config.sections!.map((s) => ({ marks: s.marksEach, count: s.count })),
        difficultyMix: config.sections!.reduce(
          (acc, s) => { if (s.difficulty) acc[s.difficulty] += s.count; return acc; },
          { easy: 0, medium: 0, hard: 0 }
        ),
      };
    } else {
      selected = selectQuestions(pool, config);
      await fillMarksGapsWithAi(pool, selected, modules, config, ctx);
      await fillDifficultyGapsWithAi(pool, selected, modules, config, ctx);
      sections = groupByMarks(selected);
    }

    if (selected.length === 0) {
      throw new ValidationError('No questions in the bank for the selected batch/track/modules yet, and AI question generation is not configured on this server — upload sources first.');
    }

    const validation = paperValidationService.validate(validationConfig, modules, selected);
    const totalMarksAssembled = selected.reduce((sum, q) => sum + q.marks, 0);

    const record = await generatedPaperRepository.create({
      instituteId: ctx.instituteId,
      config,
      questionIds: selected.map((q) => String(q._id)),
      sectionSizes,
      totalMarksAssembled,
      validation,
      createdBy: ctx.userId,
    });

    await bankQuestionRepository.recordUsage(selected.map((q) => String(q._id)), undefined, new Date());

    const resolvedImages = await resolveQuestionImages(selected, ctx.instituteId);

    return {
      _id: String(record._id),
      instituteId: record.instituteId,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      config,
      sections,
      totalMarksAssembled,
      validation,
      createdBy: ctx.userId,
      resolvedImages,
    };
  },

  async getById(id: string, ctx: AuthContext): Promise<GeneratedQuestionPaper> {
    const record = await generatedPaperRepository.findById(id, ctx.instituteId);
    if (!record) throw new NotFoundError('Generated paper');
    await assertFacultyCanAccessQuestionBank(ctx, record.config.batch, record.config.track);

    const questions = await bankQuestionRepository.findByIds(ctx.instituteId, record.questionIds);
    const byId = new Map(questions.map((q) => [String(q._id), q]));
    const ordered = record.questionIds.map((qid) => byId.get(qid)).filter((q): q is IBankQuestion => !!q);

    let sections: GeneratedPaperSection[];
    if (record.config.sections?.length && record.sectionSizes?.length === record.config.sections.length) {
      sections = [];
      let offset = 0;
      for (let i = 0; i < record.config.sections.length; i++) {
        const sec = record.config.sections[i];
        const size = record.sectionSizes[i];
        sections.push({ marks: sec.marksEach, name: sec.name, questions: ordered.slice(offset, offset + size).map(toDto) });
        offset += size;
      }
    } else {
      sections = groupByMarks(ordered);
    }

    const resolvedImages = await resolveQuestionImages(ordered, ctx.instituteId);

    return {
      _id: String(record._id),
      instituteId: record.instituteId,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      config: record.config,
      sections,
      totalMarksAssembled: record.totalMarksAssembled,
      validation: record.validation,
      createdBy: record.createdBy,
      resolvedImages,
    };
  },

  async list(opts: { batch?: string; track?: string; page?: number; limit?: number }, ctx: AuthContext) {
    const repoOpts: Parameters<typeof generatedPaperRepository.findAll>[1] = { ...opts };
    if (opts.batch && opts.track) {
      await assertFacultyCanAccessQuestionBank(ctx, opts.batch, opts.track);
    } else if (ctx.role === 'faculty') {
      const allowed = await getFacultyAllowedBatchTracks(ctx);
      const narrowed = allowed.filter((p) => (!opts.batch || p.batch === opts.batch) && (!opts.track || p.track === opts.track));
      if (narrowed.length === 0) return { data: [], total: 0, page: opts.page ?? 1, limit: opts.limit ?? 20 };
      repoOpts.batchTrackPairs = narrowed;
    }

    const { papers, total, page, limit } = await generatedPaperRepository.findAll(ctx.instituteId, repoOpts);
    return {
      data: papers.map((p) => ({
        _id: String(p._id),
        config: p.config,
        totalMarksAssembled: p.totalMarksAssembled,
        createdBy: p.createdBy,
        createdAt: p.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
    };
  },

  async delete(id: string, ctx: AuthContext): Promise<void> {
    const existing = await generatedPaperRepository.findById(id, ctx.instituteId);
    if (!existing) throw new NotFoundError('Generated paper');
    await assertFacultyCanAccessQuestionBank(ctx, existing.config.batch, existing.config.track);
    const deleted = await generatedPaperRepository.softDelete(id, ctx.instituteId);
    if (!deleted) throw new NotFoundError('Generated paper');
  },
};
