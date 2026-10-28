import { PlacementDrive, IPlacementDrive, DriveApplication, IDriveApplication } from './placement-drive.model';
import { Candidate, ICandidate } from '../candidates/candidate.model';
import type { DriveApplicationStatus } from '@placementos/types';

export type LeanDrive = IPlacementDrive & { _id: { toString(): string } };
export type LeanApplication = IDriveApplication & { _id: { toString(): string } };
export type LeanCandidate = ICandidate & { _id: { toString(): string } };

const CANDIDATE_FIELDS = 'fullName rollNumber department batch email placementYear status cgpa activeBacklogs';

export const placementDriveRepository = {
  async create(data: Partial<IPlacementDrive>): Promise<LeanDrive> {
    const drive = await PlacementDrive.create(data);
    return drive.toObject() as LeanDrive;
  },

  async list(instituteId: string): Promise<LeanDrive[]> {
    return PlacementDrive.find({ instituteId }).sort({ createdAt: -1 }).lean<LeanDrive[]>();
  },

  async listVisibleToCandidates(instituteId: string): Promise<LeanDrive[]> {
    return PlacementDrive.find({ instituteId, status: { $ne: 'draft' } }).sort({ createdAt: -1 }).lean<LeanDrive[]>();
  },

  async findById(id: string, instituteId: string): Promise<LeanDrive | null> {
    return PlacementDrive.findOne({ _id: id, instituteId }).lean<LeanDrive | null>();
  },

  async update(id: string, instituteId: string, data: Partial<IPlacementDrive>): Promise<LeanDrive | null> {
    return PlacementDrive.findOneAndUpdate({ _id: id, instituteId }, { $set: data }, { new: true }).lean<LeanDrive | null>();
  },

  async remove(id: string, instituteId: string): Promise<void> {
    await PlacementDrive.deleteOne({ _id: id, instituteId });
    await DriveApplication.deleteMany({ driveId: id, instituteId });
  },
};

export const driveApplicationRepository = {
  async listForDrive(instituteId: string, driveId: string): Promise<LeanApplication[]> {
    return DriveApplication.find({ instituteId, driveId }).sort({ appliedAt: 1 }).lean<LeanApplication[]>();
  },

  async listForDrives(instituteId: string, driveIds: string[]): Promise<LeanApplication[]> {
    return DriveApplication.find({ instituteId, driveId: { $in: driveIds } }).lean<LeanApplication[]>();
  },

  async listForCandidate(instituteId: string, candidateId: string): Promise<LeanApplication[]> {
    return DriveApplication.find({ instituteId, candidateId }).lean<LeanApplication[]>();
  },

  async listByStatus(instituteId: string, status: DriveApplicationStatus): Promise<LeanApplication[]> {
    return DriveApplication.find({ instituteId, status }).lean<LeanApplication[]>();
  },

  async findOne(instituteId: string, driveId: string, candidateId: string): Promise<LeanApplication | null> {
    return DriveApplication.findOne({ instituteId, driveId, candidateId }).lean<LeanApplication | null>();
  },

  async findByIds(instituteId: string, driveId: string, ids: string[]): Promise<LeanApplication[]> {
    return DriveApplication.find({ instituteId, driveId, _id: { $in: ids } }).lean<LeanApplication[]>();
  },

  async create(data: Partial<IDriveApplication>): Promise<void> {
    await DriveApplication.create(data);
  },

  async update(id: string, data: Partial<IDriveApplication>, unset: string[] = []): Promise<void> {
    await DriveApplication.updateOne(
      { _id: id },
      { $set: data, ...(unset.length ? { $unset: Object.fromEntries(unset.map((k) => [k, 1])) } : {}) }
    );
  },
};

export const driveCandidateRepository = {
  async findById(instituteId: string, id: string): Promise<LeanCandidate | null> {
    return Candidate.findOne({ _id: id, instituteId, isDeleted: false }).select(CANDIDATE_FIELDS).lean<LeanCandidate | null>();
  },

  async findByIds(instituteId: string, ids: string[]): Promise<LeanCandidate[]> {
    return Candidate.find({ _id: { $in: ids }, instituteId }).select(CANDIDATE_FIELDS).lean<LeanCandidate[]>();
  },

  async listActive(instituteId: string, placementYear?: string): Promise<LeanCandidate[]> {
    return Candidate.find({ instituteId, isDeleted: false, status: { $ne: 'inactive' }, ...(placementYear ? { placementYear } : {}) })
      .select(CANDIDATE_FIELDS)
      .lean<LeanCandidate[]>();
  },

  async setStatus(instituteId: string, ids: string[], status: 'active' | 'placed', onlyIfStatus?: 'active' | 'placed'): Promise<void> {
    if (!ids.length) return;
    await Candidate.updateMany({ _id: { $in: ids }, instituteId, ...(onlyIfStatus ? { status: onlyIfStatus } : {}) }, { $set: { status } });
  },
};
