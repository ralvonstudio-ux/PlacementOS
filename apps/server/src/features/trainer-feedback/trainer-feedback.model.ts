import mongoose, { Document, Schema } from 'mongoose';

export interface ITrainerFeedbackRatings {
  subjectKnowledge: number;
  teachingQuality: number;
  communication: number;
  punctuality: number;
}

export interface ITrainerFeedback extends Document {
  instituteId: string;
  facultyId: string;
  candidateId: string;
  batch: string;
  track: string;
  isAnonymous: boolean;
  ratings: ITrainerFeedbackRatings;
  overallRating: number;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ratingField = { type: Number, required: true, min: 1, max: 5 };

const trainerFeedbackSchema = new Schema<ITrainerFeedback>(
  {
    instituteId: { type: String, required: true, index: true },
    facultyId: { type: String, required: true },
    candidateId: { type: String, required: true },
    batch: { type: String, required: true, trim: true },
    track: { type: String, required: true, trim: true },
    isAnonymous: { type: Boolean, default: false },
    ratings: {
      subjectKnowledge: ratingField,
      teachingQuality: ratingField,
      communication: ratingField,
      punctuality: ratingField,
    },
    overallRating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true, versionKey: false }
);

// One rating per student per trainer per subject — prevents duplicate submissions.
trainerFeedbackSchema.index({ instituteId: 1, facultyId: 1, candidateId: 1, track: 1 }, { unique: true });
trainerFeedbackSchema.index({ instituteId: 1, facultyId: 1, createdAt: -1 });
trainerFeedbackSchema.index({ instituteId: 1, batch: 1, createdAt: -1 });

export const TrainerFeedback = mongoose.model<ITrainerFeedback>('TrainerFeedback', trainerFeedbackSchema);
