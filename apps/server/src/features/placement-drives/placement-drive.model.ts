import mongoose, { Document, Schema } from 'mongoose';
import type { DriveJobType, DriveStatus, DriveRoundType, DriveApplicationStatus, DriveRoundResult } from '@placementos/types';

export interface IDriveRound {
  name: string;
  type: DriveRoundType;
  scheduledAt?: Date;
}

export interface IDriveEligibility {
  minCgpa?: number;
  maxBacklogs?: number;
  departments: string[];
  batches: string[];
  placementYears: string[];
  excludePlaced: boolean;
}

export interface IPlacementDrive extends Document {
  instituteId: string;
  companyName: string;
  companyWebsite?: string;
  roleTitle: string;
  description?: string;
  jobType: DriveJobType;
  ctcLpa?: number;
  stipendPerMonth?: number;
  location?: string;
  eligibility: IDriveEligibility;
  rounds: IDriveRound[];
  applicationDeadline?: Date;
  driveDate?: Date;
  status: DriveStatus;
  /** Set the first time the drive is opened, so re-opening doesn't re-notify every student. */
  announcedAt?: Date;
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const JOB_TYPES: DriveJobType[] = ['full_time', 'internship', 'internship_ppo'];
const DRIVE_STATUSES: DriveStatus[] = ['draft', 'open', 'closed', 'completed'];
const ROUND_TYPES: DriveRoundType[] = ['aptitude', 'technical', 'coding', 'group_discussion', 'interview', 'hr', 'other'];

const roundSchema = new Schema<IDriveRound>(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ROUND_TYPES, default: 'other' },
    scheduledAt: { type: Date },
  },
  { _id: false }
);

const eligibilitySchema = new Schema<IDriveEligibility>(
  {
    minCgpa: { type: Number, min: 0, max: 10 },
    maxBacklogs: { type: Number, min: 0 },
    departments: { type: [String], default: [] },
    batches: { type: [String], default: [] },
    placementYears: { type: [String], default: [] },
    excludePlaced: { type: Boolean, default: true },
  },
  { _id: false }
);

const placementDriveSchema = new Schema<IPlacementDrive>(
  {
    instituteId: { type: String, required: true, index: true },
    companyName: { type: String, required: true, trim: true },
    companyWebsite: { type: String, trim: true },
    roleTitle: { type: String, required: true, trim: true },
    description: { type: String, trim: true, maxlength: 5000 },
    jobType: { type: String, enum: JOB_TYPES, required: true },
    ctcLpa: { type: Number, min: 0 },
    stipendPerMonth: { type: Number, min: 0 },
    location: { type: String, trim: true },
    eligibility: { type: eligibilitySchema, default: () => ({}) },
    rounds: { type: [roundSchema], default: [] },
    applicationDeadline: { type: Date },
    driveDate: { type: Date },
    status: { type: String, enum: DRIVE_STATUSES, default: 'draft' },
    announcedAt: { type: Date },
    createdBy: { type: String, required: true },
    updatedBy: { type: String },
  },
  { timestamps: true, versionKey: false }
);

placementDriveSchema.index({ instituteId: 1, status: 1, createdAt: -1 });

export const PlacementDrive = mongoose.model<IPlacementDrive>('PlacementDrive', placementDriveSchema);

export interface IDriveRoundOutcome {
  roundIndex: number;
  result: DriveRoundResult;
  updatedAt: Date;
}

export interface IDriveApplication extends Document {
  instituteId: string;
  driveId: string;
  candidateId: string;
  status: DriveApplicationStatus;
  roundResults: IDriveRoundOutcome[];
  offerCtcLpa?: number;
  appliedAt: Date;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const APPLICATION_STATUSES: DriveApplicationStatus[] = ['applied', 'shortlisted', 'selected', 'rejected', 'withdrawn'];

const driveApplicationSchema = new Schema<IDriveApplication>(
  {
    instituteId: { type: String, required: true, index: true },
    driveId: { type: String, required: true },
    candidateId: { type: String, required: true },
    status: { type: String, enum: APPLICATION_STATUSES, default: 'applied' },
    roundResults: {
      type: [
        new Schema<IDriveRoundOutcome>(
          {
            roundIndex: { type: Number, required: true },
            result: { type: String, enum: ['pending', 'cleared', 'rejected', 'absent'], required: true },
            updatedAt: { type: Date, required: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    offerCtcLpa: { type: Number, min: 0 },
    appliedAt: { type: Date, required: true },
    updatedBy: { type: String },
  },
  { timestamps: true, versionKey: false }
);

driveApplicationSchema.index({ instituteId: 1, driveId: 1, candidateId: 1 }, { unique: true });
driveApplicationSchema.index({ instituteId: 1, candidateId: 1 });
driveApplicationSchema.index({ instituteId: 1, status: 1 });

export const DriveApplication = mongoose.model<IDriveApplication>('DriveApplication', driveApplicationSchema);
