import type { BankQuestionImageRef, ResolvedQuestionImage } from '@placementos/types';
import { bankQuestionSourceRepository } from './bank-question-source.repository';
import { readImage } from '../../lib/image-store';

/**
 * Resolves every distinct imageRef across a set of papers/worksheet questions into an actual
 * displayable payload (full page image as a data URI + the figure's fractional crop). Deliberately
 * recomputed on every read rather than persisted on the paper/worksheet document itself, to avoid
 * reintroducing the 16MB-per-document risk GridFS was adopted to avoid.
 *
 * Never throws on a missing/unreadable image — that imageRef is just left unresolved.
 */
export async function resolveQuestionImages(
  questions: { imageRef?: BankQuestionImageRef }[],
  instituteId: string
): Promise<Record<string, ResolvedQuestionImage>> {
  const refs = questions.map((q) => q.imageRef).filter((r): r is BankQuestionImageRef => !!r?.sourceId && !!r.figureId);
  if (refs.length === 0) return {};

  const uniqueSourceIds = [...new Set(refs.map((r) => r.sourceId))];
  const sources = await Promise.all(uniqueSourceIds.map((id) => bankQuestionSourceRepository.findById(id, instituteId)));
  const sourceById = new Map(sources.filter((s) => !!s).map((s) => [String(s!._id), s!]));

  const result: Record<string, ResolvedQuestionImage> = {};
  for (const ref of refs) {
    const key = `${ref.sourceId}:${ref.figureId}`;
    if (result[key]) continue;

    const source = sourceById.get(ref.sourceId);
    if (!source) continue;

    // A figure (and the page image it belongs to) can live at the source's top level
    // (single-image upload) or under one specific page (module capture) — check both.
    let figure = source.figures?.find((f) => f.figureId === ref.figureId);
    let fileId = source.pageImageFileId;
    if (!figure) {
      for (const page of source.pages ?? []) {
        const match = page.figures?.find((f) => f.figureId === ref.figureId);
        if (match) {
          figure = match;
          fileId = page.pageImageFileId;
          break;
        }
      }
    }
    if (!figure || !fileId) continue;

    const image = await readImage(fileId, instituteId);
    if (!image) continue;

    result[key] = {
      pageImageDataUri: `data:${image.contentType};base64,${image.buffer.toString('base64')}`,
      boundingBox: figure.boundingBox,
    };
  }
  return result;
}
