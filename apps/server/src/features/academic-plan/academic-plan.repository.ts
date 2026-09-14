import { AcademicPlan, IAcademicPlan, IAcademicPlanSession } from './academic-plan.model';

export const academicPlanRepository = {
  async findActive(instituteId: string, facultyId: string, batch: string, track: string): Promise<IAcademicPlan | null> {
    return AcademicPlan.findOne({ instituteId, facultyId, batch, track, isDeleted: false });
  },

  async findById(id: string, instituteId: string): Promise<IAcademicPlan | null> {
    return AcademicPlan.findOne({ _id: id, instituteId, isDeleted: false });
  },

  /** Upserts the one active plan per faculty+batch+track — regenerating replaces its
   *  syllabus/lecture/week inputs and sessions in place rather than creating a new row,
   *  so a faculty member always has exactly one current plan per batch/track to edit. */
  async upsert(
    instituteId: string,
    facultyId: string,
    batch: string,
    track: string,
    data: { title: string; syllabusText: string; totalLectures: number; totalWeeks: number; startDate: string; sessions: IAcademicPlanSession[]; createdBy: string }
  ): Promise<IAcademicPlan> {
    const existing = await AcademicPlan.findOne({ instituteId, facultyId, batch, track, isDeleted: false });
    if (existing) {
      existing.title = data.title;
      existing.syllabusText = data.syllabusText;
      existing.totalLectures = data.totalLectures;
      existing.totalWeeks = data.totalWeeks;
      existing.startDate = data.startDate;
      existing.sessions = data.sessions;
      existing.version += 1;
      return existing.save();
    }
    return AcademicPlan.create({ instituteId, facultyId, batch, track, ...data, version: 1 });
  },

  async save(plan: IAcademicPlan): Promise<IAcademicPlan> {
    return plan.save();
  },

  async softDelete(id: string, instituteId: string): Promise<boolean> {
    const result = await AcademicPlan.updateOne({ _id: id, instituteId, isDeleted: false }, { $set: { isDeleted: true, deletedAt: new Date() } });
    return result.modifiedCount > 0;
  },
};
