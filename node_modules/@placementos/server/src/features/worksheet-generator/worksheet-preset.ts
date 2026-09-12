import { QuestionKind, QuestionDifficulty, QuestionBloomsLevel } from '../question-bank/bank-question.model';
import { WorksheetType } from './worksheet.model';

export interface WorksheetPreset {
  label: string;
  difficulties: QuestionDifficulty[];
  questionTypes: QuestionKind[];
  bloomsLevels: QuestionBloomsLevel[];
  authoringGuidance: string;
}

export const WORKSHEET_PRESETS: Record<WorksheetType, WorksheetPreset> = {
  practice: {
    label: 'Practice Worksheet',
    difficulties: [],
    questionTypes: [],
    bloomsLevels: [],
    authoringGuidance: 'a balanced mix of easy, medium, and hard practice questions covering the core content',
  },
  homework: {
    label: 'Homework',
    difficulties: ['easy', 'medium'],
    questionTypes: ['short', 'very_short', 'fill_blank'],
    bloomsLevels: [],
    authoringGuidance: 'short, quick-to-answer questions suitable for independent take-home practice',
  },
  revision: {
    label: 'Revision Sheet',
    difficulties: [],
    questionTypes: [],
    bloomsLevels: [],
    authoringGuidance: 'a spread of questions revisiting the key ideas across these training modules, mixed difficulty',
  },
  hots: {
    label: 'HOTS Questions',
    difficulties: ['medium', 'hard'],
    questionTypes: ['hots', 'case_study'],
    bloomsLevels: ['analyze', 'evaluate', 'create'],
    authoringGuidance: 'higher-order-thinking questions that require analysis, evaluation, or application beyond rote recall',
  },
  olympiad: {
    label: 'Advanced/Competitive Questions',
    difficulties: ['hard'],
    questionTypes: ['hots', 'case_study', 'assertion_reason'],
    bloomsLevels: ['analyze', 'evaluate', 'create'],
    authoringGuidance: 'challenging, competitive-exam-caliber enrichment questions that go beyond standard placement-test level',
  },
  remedial: {
    label: 'Remedial Worksheet',
    difficulties: ['easy'],
    questionTypes: ['very_short', 'fill_blank', 'mcq'],
    bloomsLevels: ['remember', 'understand'],
    authoringGuidance: 'simple, foundational questions for candidates who need extra reinforcement of the basics',
  },
};
