import type { IBankQuestionSource } from './bank-question-source.model';
import type { PageFigure } from '@placementos/types';

/** A figure paired with the source it actually lives on — synthesis/authoring only ever sees the
 *  figure's own fields, but the caller needs this pairing afterward to fill in a chosen figureId's
 *  imageRef.sourceId. */
export interface ModuleFigure {
  figure: PageFigure;
  sourceId: string;
}

/** Flattens every usable figure across a set of uploads scoped to one training module — a
 *  single-image upload's top-level `figures`, and a module-capture's per-page `figures` — into
 *  one flat list, each tagged with the sourceId a picked figureId must resolve back to. */
export function collectModuleFigures(sources: IBankQuestionSource[], trainingModuleName: string): ModuleFigure[] {
  const out: ModuleFigure[] = [];
  for (const source of sources) {
    if (source.trainingModuleName !== trainingModuleName) continue;
    const sourceId = String(source._id);
    for (const figure of source.figures ?? []) out.push({ figure, sourceId });
    for (const page of source.pages ?? []) {
      for (const figure of page.figures ?? []) out.push({ figure, sourceId });
    }
  }
  return out;
}
