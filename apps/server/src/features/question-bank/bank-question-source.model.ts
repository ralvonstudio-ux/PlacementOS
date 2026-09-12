import mongoose, { Document, Schema } from 'mongoose';
import type { ContentBlock, ModulePage, PageFigure } from '@placementos/types';

export type QuestionSourceKind = 'image' | 'pdf_text';

/**
 * Permanent record of the raw text an upload converted to, kept separate from ExtractionJob
 * (which auto-expires after 6h and exists only for the upload -> poll flow). Lets a faculty
 * member re-run AI structuring on a page they already uploaded without re-scanning/re-uploading.
 */
export interface IBankQuestionSource extends Document {
  instituteId: string;
  userId: string;
  batch: string;
  track: string;
  kind: QuestionSourceKind;
  fileName?: string;
  extractedText: string;
  /** Faculty-assigned training module for this upload — pre-fills every question drafted from it. */
  trainingModuleName?: string;
  documentTitle?: string;
  language?: string;
  pages?: ModulePage[];
  reviewStatus?: 'ready_for_review' | 'saved';
  pageImageFileId?: string;
  figures?: PageFigure[];
  createdAt: Date;
  updatedAt: Date;
}

const contentBlockSchema = new Schema<ContentBlock>({}, { strict: false, _id: false });

const boundingBoxSchema = new Schema(
  { x: { type: Number, required: true }, y: { type: Number, required: true }, width: { type: Number, required: true }, height: { type: Number, required: true } },
  { _id: false }
);

const figureSchema = new Schema<PageFigure>(
  {
    figureId: { type: String, required: true },
    pageNumber: { type: Number, required: true },
    boundingBox: { type: boundingBoxSchema, required: true },
    figureType: { type: String, enum: ['decorative', 'content_supporting', 'diagram', 'chart_table', 'map', 'illustration'], required: true },
    caption: { type: String },
    description: { type: String, required: true },
    usableForQuestion: { type: Boolean, required: true },
  },
  { _id: false }
);

const modulePageSchema = new Schema<ModulePage>(
  {
    pageNumber: { type: Number, required: true },
    blocks: { type: [contentBlockSchema], default: [] },
    confidence: { type: String, enum: ['high', 'review', 'low'] },
    pageError: { type: String },
    pageImageFileId: { type: String },
    figures: { type: [figureSchema], default: undefined },
  },
  { _id: false }
);

const bankQuestionSourceSchema = new Schema<IBankQuestionSource>(
  {
    instituteId: { type: String, required: true },
    userId: { type: String, required: true },
    batch: { type: String, required: true },
    track: { type: String, required: true },
    kind: { type: String, enum: ['image', 'pdf_text'], required: true },
    fileName: { type: String },
    extractedText: { type: String, required: true },
    trainingModuleName: { type: String },
    documentTitle: { type: String },
    language: { type: String },
    pages: { type: [modulePageSchema], default: undefined },
    reviewStatus: { type: String, enum: ['ready_for_review', 'saved'] },
    pageImageFileId: { type: String },
    figures: { type: [figureSchema], default: undefined },
  },
  { timestamps: true, versionKey: false }
);

bankQuestionSourceSchema.index({ instituteId: 1, batch: 1, track: 1, createdAt: -1 });

export const BankQuestionSource = mongoose.model<IBankQuestionSource>('BankQuestionSource', bankQuestionSourceSchema);
