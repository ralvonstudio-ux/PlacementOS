import { ExtractionJob, IExtractionJob, ExtractionJobKind } from './extraction-job.model';
import type { QuestionExtractionResult, TextExtractionResult } from './question-extraction.service';
import type { ModuleCaptureJobResult } from '@placementos/types';

type JobResult = QuestionExtractionResult | TextExtractionResult | ModuleCaptureJobResult;

export const extractionJobRepository = {
  async create(data: { instituteId: string; userId: string; kind: ExtractionJobKind; totalPages?: number; batch?: string; track?: string; trainingModuleName?: string }): Promise<IExtractionJob> {
    return ExtractionJob.create({ ...data, status: 'processing', completedPages: 0 });
  },

  async findById(id: string, instituteId: string): Promise<IExtractionJob | null> {
    return ExtractionJob.findOne({ _id: id, instituteId }).lean<IExtractionJob>();
  },

  async markCompleted(id: string, result: JobResult): Promise<void> {
    await ExtractionJob.updateOne({ _id: id }, { $set: { status: 'completed', result } });
  },

  async markFailed(id: string, error: string): Promise<void> {
    await ExtractionJob.updateOne({ _id: id }, { $set: { status: 'failed', error } });
  },

  async updateProgress(id: string, completedPages: number, partialResult?: JobResult): Promise<void> {
    const update: Record<string, unknown> = { completedPages };
    if (partialResult) update.result = partialResult;
    await ExtractionJob.updateOne({ _id: id }, { $set: update });
  },
};
