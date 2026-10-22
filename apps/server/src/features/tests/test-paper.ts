import type { ITestQuestionSnapshot, ITestSection } from './test.model';

/**
 * A test is a *pool*: each section may set `pickCount`, and every candidate then gets that
 * many of the section's questions, drawn at random per attempt. These helpers are the single
 * definition of what one candidate's paper looks like.
 */

type QuestionLike = Pick<ITestQuestionSnapshot, 'marks' | 'sectionIndex'>;
type SectionLike = Pick<ITestSection, 'pickCount'>;

const sectionIndexOf = (q: QuestionLike, sectionCount: number) => Math.min(q.sectionIndex ?? 0, Math.max(0, sectionCount - 1));

/** Question indexes grouped by section, sections in order. A test with no sections is one. */
function groupBySection(questions: QuestionLike[], sections: SectionLike[] | undefined): number[][] {
  const count = Math.max(1, sections?.length ?? 0);
  const groups: number[][] = Array.from({ length: count }, () => []);
  questions.forEach((q, i) => groups[sectionIndexOf(q, count)].push(i));
  return groups;
}

/** How many questions a section gives each candidate. */
const drawCount = (groupSize: number, section: SectionLike | undefined) =>
  section?.pickCount && section.pickCount < groupSize ? section.pickCount : groupSize;

/** One candidate's paper: per section, a random `pickCount` subset in random order; sections
 *  stay in their own order so section-by-section navigation still works. */
export function drawQuestionOrder(questions: QuestionLike[], sections: SectionLike[] | undefined): number[] {
  return groupBySection(questions, sections).flatMap((group, si) => {
    const shuffled = [...group];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, drawCount(group.length, sections?.[si]));
  });
}

/** Questions each candidate answers. */
export function paperQuestionCount(questions: QuestionLike[], sections: SectionLike[] | undefined): number {
  return groupBySection(questions, sections).reduce((sum, group, si) => sum + drawCount(group.length, sections?.[si]), 0);
}

/** Marks each candidate's paper is out of. Pooled sections are validated to have uniform
 *  marks (see test.validation), so any draw is worth the same. */
export function paperTotalMarks(questions: QuestionLike[], sections: SectionLike[] | undefined): number {
  return groupBySection(questions, sections).reduce((sum, group, si) => {
    const n = drawCount(group.length, sections?.[si]);
    if (n === group.length) return sum + group.reduce((s, i) => s + questions[i].marks, 0);
    return sum + n * (questions[group[0]]?.marks ?? 0);
  }, 0);
}
