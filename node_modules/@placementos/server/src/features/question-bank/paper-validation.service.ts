import { PaperGenerationConfig, PaperValidationResult } from '@placementos/types';
import { IBankQuestion } from './bank-question.model';
import { ITrainingModuleRecord } from './training-module-record.model';

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export const paperValidationService = {
  /** Runs the coverage/duplicate/distribution/weightage/Bloom's/time checks over an assembled paper. */
  validate(config: PaperGenerationConfig, modules: ITrainingModuleRecord[], selected: IBankQuestion[]): PaperValidationResult {
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // ── Coverage: modules requested but zero questions selected ──────────────
    const moduleIdsWithQuestions = new Set(selected.map((q) => q.trainingModuleId));
    const uncovered = modules.filter((m) => !moduleIdsWithQuestions.has(String(m._id)));
    for (const m of uncovered) {
      warnings.push(`"${m.moduleName}" has no questions in this paper.`);
    }
    const coveragePercent = modules.length > 0 ? Math.round(((modules.length - uncovered.length) / modules.length) * 100) : 100;

    // ── Broken MCQs: fewer than 2 options means nothing prints for the candidate to choose from.
    const brokenMcqs = selected.filter((q) => q.questionType === 'mcq' && (q.options?.filter((o) => o.trim()).length ?? 0) < 2);
    for (const q of brokenMcqs) {
      warnings.push(`"${q.questionText.slice(0, 50)}…" is an MCQ with fewer than 2 answer options — fix it in the Question Bank before printing.`);
    }

    // ── Duplicate detection ────────────────────────────────────────────────────
    const seen = new Map<string, string>();
    for (const q of selected) {
      const key = normalize(q.questionText).slice(0, 80);
      if (seen.has(key)) {
        warnings.push(`Possible duplicate: "${q.questionText.slice(0, 50)}…" appears more than once.`);
      } else {
        seen.set(key, q.questionText);
      }
    }

    // ── Marks distribution ──────────────────────────────────────────────────────
    const actualByMarks = new Map<number, number>();
    for (const q of selected) actualByMarks.set(q.marks, (actualByMarks.get(q.marks) ?? 0) + 1);
    for (const entry of config.marksBreakdown) {
      const actual = actualByMarks.get(entry.marks) ?? 0;
      if (actual < entry.count) {
        warnings.push(`Only ${actual}/${entry.count} questions found worth ${entry.marks} mark(s) each.`);
      }
    }

    // ── Difficulty balance ──────────────────────────────────────────────────────
    const actualDifficulty = { easy: 0, medium: 0, hard: 0 };
    for (const q of selected) actualDifficulty[q.difficulty] += 1;
    const requestedTotal = config.difficultyMix.easy + config.difficultyMix.medium + config.difficultyMix.hard;
    if (requestedTotal > 0) {
      (['easy', 'medium', 'hard'] as const).forEach((level) => {
        const requested = config.difficultyMix[level];
        const actual = actualDifficulty[level];
        if (requested > 0 && actual < requested) {
          warnings.push(`Only ${actual}/${requested} ${level} questions found.`);
        }
      });
      const easyShare = actualDifficulty.easy / Math.max(1, selected.length);
      if (easyShare > 0.7) {
        suggestions.push('This paper is heavily weighted toward easy questions — consider adding more medium/hard questions.');
      }
    }

    // ── Bloom's taxonomy balance ────────────────────────────────────────────────
    const higherOrder = selected.filter((q) => ['analyze', 'evaluate', 'create'].includes(q.bloomsLevel)).length;
    if (selected.length > 0 && higherOrder === 0) {
      suggestions.push('No higher-order thinking (analyze/evaluate/create) questions included — consider adding at least one.');
    }

    // ── Module weightage: marks assembled per module vs. its share of topics ──
    const totalTopics = modules.reduce((sum, m) => sum + Math.max(1, m.topics.length), 0);
    const marksByModule = new Map<string, number>();
    for (const q of selected) marksByModule.set(q.trainingModuleId, (marksByModule.get(q.trainingModuleId) ?? 0) + q.marks);
    const totalAssembled = selected.reduce((sum, q) => sum + q.marks, 0);
    for (const m of modules) {
      const expectedShare = Math.max(1, m.topics.length) / Math.max(1, totalTopics);
      const actualShare = totalAssembled > 0 ? (marksByModule.get(String(m._id)) ?? 0) / totalAssembled : 0;
      if (expectedShare > 0.15 && actualShare < expectedShare * 0.4) {
        suggestions.push(`"${m.moduleName}" looks under-represented relative to its size — consider adding more marks here.`);
      }
    }

    // ── Estimated time vs. exam duration ────────────────────────────────────────
    const totalEstimatedTimeMinutes = selected.reduce((sum, q) => sum + q.estimatedTimeMinutes, 0);
    if (config.durationMinutes && totalEstimatedTimeMinutes > config.durationMinutes) {
      warnings.push(`Estimated solving time (${totalEstimatedTimeMinutes} min) exceeds the exam duration (${config.durationMinutes} min).`);
    }

    return { warnings, suggestions, coveragePercent, totalEstimatedTimeMinutes };
  },
};
