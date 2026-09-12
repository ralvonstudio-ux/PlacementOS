import { BankQuestionSource, IBankQuestionSource, QuestionSourceKind } from './bank-question-source.model';
import type { ModulePage, PageFigure } from '@placementos/types';
import { deleteImage } from '../../lib/image-store';

export const bankQuestionSourceRepository = {
  async create(data: {
    instituteId: string;
    userId: string;
    batch: string;
    track: string;
    kind: QuestionSourceKind;
    fileName?: string;
    extractedText: string;
    trainingModuleName?: string;
    documentTitle?: string;
    language?: string;
    pages?: ModulePage[];
    reviewStatus?: 'ready_for_review' | 'saved';
    pageImageFileId?: string;
    figures?: PageFigure[];
  }): Promise<IBankQuestionSource> {
    return BankQuestionSource.create(data);
  },

  /** batch/track omitted -> every stored upload for the institute (the "pending uploads" view). */
  async findAll(instituteId: string, batch?: string, track?: string): Promise<IBankQuestionSource[]> {
    const filter: Record<string, string> = { instituteId };
    if (batch) filter.batch = batch;
    if (track) filter.track = track;
    return BankQuestionSource.find(filter).sort({ createdAt: -1 }).lean<IBankQuestionSource[]>();
  },

  /** Every upload in the institute, across every batch/track — backs the TPO's materials overview. */
  async findAllForInstitute(instituteId: string): Promise<IBankQuestionSource[]> {
    return BankQuestionSource.find({ instituteId }).lean<IBankQuestionSource[]>();
  },

  async findById(id: string, instituteId: string): Promise<IBankQuestionSource | null> {
    return BankQuestionSource.findOne({ _id: id, instituteId }).lean<IBankQuestionSource>();
  },

  async updateModuleName(id: string, instituteId: string, trainingModuleName: string): Promise<IBankQuestionSource | null> {
    return BankQuestionSource.findOneAndUpdate({ _id: id, instituteId }, { trainingModuleName }, { new: true }).lean<IBankQuestionSource>();
  },

  async updateStructuredContent(
    id: string,
    instituteId: string,
    data: { documentTitle?: string; pages: ModulePage[]; extractedText: string; reviewStatus?: 'ready_for_review' | 'saved' }
  ): Promise<IBankQuestionSource | null> {
    return BankQuestionSource.findOneAndUpdate({ _id: id, instituteId }, { $set: data }, { new: true }).lean<IBankQuestionSource>();
  },

  /** Hard delete — a source is just converted OCR text, not a graded record. Any questions
   *  already saved from it keep their own copy of every field (sourceRef just loses its target). */
  async delete(id: string, instituteId: string): Promise<boolean> {
    const source = await BankQuestionSource.findOne({ _id: id, instituteId }).lean<IBankQuestionSource>();
    const fileIds = [source?.pageImageFileId, ...(source?.pages ?? []).map((p) => p.pageImageFileId)].filter((v): v is string => !!v);
    await Promise.all(fileIds.map((fileId) => deleteImage(fileId)));

    const res = await BankQuestionSource.deleteOne({ _id: id, instituteId });
    return res.deletedCount > 0;
  },
};
