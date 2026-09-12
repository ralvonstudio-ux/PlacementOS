import mongoose, { Document, Schema } from 'mongoose';
import type { QuestionExtractionResult, TextExtractionResult } from './question-extraction.service';
import type { ModuleCaptureJobResult } from '@placementos/types';

export type ExtractionJobStatus = 'processing' | 'completed' | 'failed';
export type ExtractionJobKind = 'image' | 'pdf_text' | 'chapter_capture';

/**
 * Same in-process background-job pattern used elsewhere (enqueue -> poll GET .../jobs/:id).
 * `kind: 'chapter_capture'` covers the multi-page structured-OCR batch flow: `totalPages`/
 * `completedPages` track progress while pages are still being processed, and `result` holds the
 * per-page structured blocks once done. Auto-expires via the TTL index below.
 */
export interface IExtractionJob extends Document {
  instituteId: string;
  userId: string;
  kind: ExtractionJobKind;
  status: ExtractionJobStatus;
  totalPages?: number;
  completedPages?: number;
  result?: QuestionExtractionResult | TextExtractionResult | ModuleCaptureJobResult;
  error?: string;
  batch?: string;
  track?: string;
  trainingModuleName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const extractionJobSchema = new Schema<IExtractionJob>(
  {
    instituteId: { type: String, required: true },
    userId: { type: String, required: true },
    kind: { type: String, enum: ['image', 'pdf_text', 'chapter_capture'], required: true },
    status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing' },
    totalPages: { type: Number },
    completedPages: { type: Number, default: 0 },
    result: { type: Schema.Types.Mixed },
    error: { type: String },
    batch: { type: String },
    track: { type: String },
    trainingModuleName: { type: String },
  },
  { timestamps: true, versionKey: false }
);

extractionJobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 6 });
extractionJobSchema.index({ instituteId: 1, userId: 1, createdAt: -1 });

export const ExtractionJob = mongoose.model<IExtractionJob>('ExtractionJob', extractionJobSchema);
