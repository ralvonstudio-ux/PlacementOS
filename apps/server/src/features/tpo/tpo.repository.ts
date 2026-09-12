import { Candidate } from '../candidates/candidate.model';
import { Faculty } from '../faculty/faculty.model';
import { TrainingScheduleEntry } from '../training-schedule/training-schedule.model';
import type { TpoCandidateStats, TpoFacultyStats, TpoTrainingScheduleStats } from '@placementos/types';

export const tpoRepository = {
  async getCandidateStats(instituteId: string): Promise<TpoCandidateStats> {
    const [total, active, placed] = await Promise.all([
      Candidate.countDocuments({ instituteId, isDeleted: false }),
      Candidate.countDocuments({ instituteId, isDeleted: false, status: 'active' }),
      Candidate.countDocuments({ instituteId, isDeleted: false, status: 'placed' }),
    ]);
    return { total, active, placed };
  },

  async getFacultyStats(instituteId: string): Promise<TpoFacultyStats> {
    const [total, active] = await Promise.all([
      Faculty.countDocuments({ instituteId, isDeleted: false }),
      Faculty.countDocuments({ instituteId, isDeleted: false, employmentStatus: 'active' }),
    ]);
    return { total, active };
  },

  /** No draft/publish workflow exists for Training Schedule (unlike SchoolOS's Timetable) — every
   *  entry that exists is effectively live, so this reports the total as "published" and 0 draft. */
  async getTrainingScheduleStats(instituteId: string): Promise<TpoTrainingScheduleStats> {
    const published = await TrainingScheduleEntry.countDocuments({ instituteId, isDeleted: false });
    return { published, draft: 0 };
  },
};
