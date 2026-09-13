import mongoose, { Document, Schema } from 'mongoose';

export type ImportType = 'training-schedule' | 'faculty' | 'candidates';
export type ImportStatus = 'mapping' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'rolled_back';
export type ImportRowStatus = 'pending' | 'valid' | 'invalid' | 'duplicate' | 'created' | 'skipped';
export type DuplicateStrategy = 'skip' | 'overwrite' | 'create';

export interface IImportRow {
  rowNumber: number;
  raw: Record<string, string>;
  mapped: Record<string, unknown>;
  errors: string[];
  status: ImportRowStatus;
  /** Set once `confirm` creates (or updates) the entity for this row. */
  entityId?: string;
}

export interface IImportSession extends Document {
  instituteId: string;
  importType: ImportType;
  originalFileName: string;
  totalRows: number;
  status: ImportStatus;
  rawHeaders: string[];
  columnMapping: Record<string, string>;
  duplicateStrategy: DuplicateStrategy;
  rows: IImportRow[];
  createdEntityIds: string[];
  errorMessage?: string;
  createdBy: string;
  confirmedAt?: Date;
  rolledBackAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const importRowSchema = new Schema<IImportRow>(
  {
    rowNumber: { type: Number, required: true },
    raw: { type: Schema.Types.Mixed, default: {} },
    mapped: { type: Schema.Types.Mixed, default: {} },
    errors: { type: [String], default: [] },
    status: { type: String, enum: ['pending', 'valid', 'invalid', 'duplicate', 'created', 'skipped'], default: 'pending' },
    entityId: { type: String },
  },
  { _id: false, suppressReservedKeysWarning: true }
);

const importSessionSchema = new Schema<IImportSession>(
  {
    instituteId: { type: String, required: true, index: true },
    importType: { type: String, enum: ['training-schedule', 'faculty', 'candidates'], required: true },
    originalFileName: { type: String, required: true },
    totalRows: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ['mapping', 'processing', 'completed', 'failed', 'cancelled', 'rolled_back'], default: 'mapping' },
    rawHeaders: { type: [String], default: [] },
    columnMapping: { type: Schema.Types.Mixed, default: {} },
    duplicateStrategy: { type: String, enum: ['skip', 'overwrite', 'create'], default: 'skip' },
    rows: { type: [importRowSchema], default: [] },
    createdEntityIds: { type: [String], default: [] },
    errorMessage: { type: String },
    createdBy: { type: String, required: true },
    confirmedAt: { type: Date },
    rolledBackAt: { type: Date },
  },
  { timestamps: true, versionKey: false }
);

importSessionSchema.index({ instituteId: 1, createdAt: -1 });

export const ImportSession = mongoose.model<IImportSession>('ImportSession', importSessionSchema);
