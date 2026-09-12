import mongoose, { Document, Schema } from 'mongoose';
import { PaperGenerationConfig, PaperValidationResult } from '@placementos/types';

export interface IGeneratedPaper extends Document {
  instituteId: string;
  config: PaperGenerationConfig;
  questionIds: string[]; // flat list, in section order — sections are rebuilt from this + config on read
  /** Actual question count per entry of `config.sections`, in order — needed to re-slice
   *  `questionIds` back into sections since the assembled count can fall short of `count`. */
  sectionSizes?: number[];
  totalMarksAssembled: number;
  validation: PaperValidationResult;
  createdBy: string;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const generatedPaperSchema = new Schema<IGeneratedPaper>(
  {
    instituteId: { type: String, required: true },
    config: { type: Schema.Types.Mixed, required: true },
    questionIds: { type: [String], default: [] },
    sectionSizes: { type: [Number] },
    totalMarksAssembled: { type: Number, required: true },
    validation: { type: Schema.Types.Mixed, required: true },
    createdBy: { type: String, required: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false }
);

generatedPaperSchema.index({ instituteId: 1, createdAt: -1 });
generatedPaperSchema.index({ instituteId: 1, isDeleted: 1, 'config.batch': 1, 'config.track': 1, createdAt: -1 });

export const GeneratedPaperModel = mongoose.model<IGeneratedPaper>('GeneratedPaper', generatedPaperSchema);
