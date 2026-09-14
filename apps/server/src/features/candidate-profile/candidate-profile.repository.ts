import { CandidateProfile, ICandidateProfile } from './candidate-profile.model';
import { SaveCandidateProfileInput } from './candidate-profile.validation';

export const candidateProfileRepository = {
  async findByCandidateId(candidateId: string, instituteId: string): Promise<ICandidateProfile | null> {
    return CandidateProfile.findOne({ candidateId, instituteId });
  },

  async upsert(candidateId: string, instituteId: string, data: SaveCandidateProfileInput): Promise<ICandidateProfile> {
    return CandidateProfile.findOneAndUpdate(
      { candidateId, instituteId },
      { $set: data, $setOnInsert: { candidateId, instituteId } },
      { new: true, upsert: true, runValidators: true }
    );
  },

  async setResumeFileUrl(candidateId: string, instituteId: string, resumeFileUrl: string, resumeFileName?: string): Promise<ICandidateProfile> {
    return CandidateProfile.findOneAndUpdate(
      { candidateId, instituteId },
      { $set: { resumeFileUrl, resumeFileName }, $setOnInsert: { candidateId, instituteId } },
      { new: true, upsert: true }
    );
  },
};
