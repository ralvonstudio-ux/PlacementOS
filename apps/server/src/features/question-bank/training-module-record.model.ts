import mongoose, { Document, Schema } from 'mongoose';

// Auto-derived from AI extraction (no manual pre-setup required) — a faculty member uploading a
// photo/PDF gets its training module matched against existing rows for that batch+track (fuzzy
// name match, see training-module-record.repository.ts), or a new one created on the fly.

export type ModuleDifficulty = 'easy' | 'moderate' | 'hard';
export type ModulePriority = 'core' | 'important' | 'supplementary';
export type ModuleExtractionStatus = 'unprocessed' | 'processing' | 'processed';

export interface ISubtopicNode {
  subtopicId: string;
  name: string;
  order: number;
}

export interface ITopicNode {
  topicId: string;
  name: string;
  order: number;
  subtopics: ISubtopicNode[];
}

export interface ITrainingModuleRecord extends Document {
  instituteId: string;
  batch: string;
  track: string;
  moduleName: string;
  topics: string[];
  // Structured topic/subtopic hierarchy derived from AI module-capture — optional, only modules
  // captured after this existed carry one; legacy modules keep relying on the flat `topics` list.
  topicTree?: ITopicNode[];
  order?: number;
  estimatedPeriods?: number;
  difficulty?: ModuleDifficulty;
  priority?: ModulePriority;
  revisionWeight?: number; // 1 (light) – 5 (heavy)
  // Process-once guard for module-capture re-extraction: a chapter_capture job hashes its
  // normalized source text and skips re-running the AI when the hash matches what's processed.
  extractionStatus: ModuleExtractionStatus;
  sourceContentHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MODULE_DIFFICULTIES: ModuleDifficulty[] = ['easy', 'moderate', 'hard'];
const MODULE_PRIORITIES: ModulePriority[] = ['core', 'important', 'supplementary'];
const MODULE_EXTRACTION_STATUSES: ModuleExtractionStatus[] = ['unprocessed', 'processing', 'processed'];

const subtopicNodeSchema = new Schema<ISubtopicNode>(
  {
    subtopicId: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    order: { type: Number, required: true },
  },
  { _id: false }
);

const topicNodeSchema = new Schema<ITopicNode>(
  {
    topicId: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    order: { type: Number, required: true },
    subtopics: { type: [subtopicNodeSchema], default: [] },
  },
  { _id: false }
);

const trainingModuleRecordSchema = new Schema<ITrainingModuleRecord>(
  {
    instituteId: { type: String, required: true, index: true },
    batch: { type: String, required: true, trim: true },
    track: { type: String, required: true, trim: true },
    moduleName: { type: String, required: true, trim: true },
    topics: { type: [String], default: [] },
    topicTree: { type: [topicNodeSchema], default: undefined },
    order: { type: Number },
    estimatedPeriods: { type: Number, min: 1 },
    difficulty: { type: String, enum: MODULE_DIFFICULTIES },
    priority: { type: String, enum: MODULE_PRIORITIES },
    revisionWeight: { type: Number, min: 1, max: 5 },
    extractionStatus: { type: String, enum: MODULE_EXTRACTION_STATUSES, default: 'unprocessed' },
    sourceContentHash: { type: String },
  },
  { timestamps: true, versionKey: false }
);

trainingModuleRecordSchema.index({ instituteId: 1, batch: 1, track: 1, moduleName: 1 }, { unique: true });

export const TrainingModuleRecord = mongoose.model<ITrainingModuleRecord>('TrainingModuleRecord', trainingModuleRecordSchema);
