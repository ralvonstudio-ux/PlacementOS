import mongoose, { Document, Schema } from 'mongoose';

export interface IInstitute extends Document {
  name: string;
  code: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const instituteSchema = new Schema<IInstitute>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    address: { type: String, trim: true },
    contactEmail: { type: String, trim: true, lowercase: true },
    contactPhone: { type: String, trim: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true, versionKey: false }
);

instituteSchema.index({ code: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });

export const Institute = mongoose.model<IInstitute>('Institute', instituteSchema);
