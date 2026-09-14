import { PeriodSlot, IPeriodSlot } from './training-schedule.period.model';

export const periodSlotRepository = {
  async findAll(instituteId: string): Promise<IPeriodSlot[]> {
    return PeriodSlot.find({ instituteId, isDeleted: false }).sort({ orderIndex: 1 });
  },

  async findById(id: string, instituteId: string): Promise<IPeriodSlot | null> {
    return PeriodSlot.findOne({ _id: id, instituteId, isDeleted: false });
  },

  async create(data: Partial<IPeriodSlot>): Promise<IPeriodSlot> {
    return PeriodSlot.create(data);
  },

  async update(id: string, instituteId: string, data: Partial<IPeriodSlot>): Promise<IPeriodSlot | null> {
    return PeriodSlot.findOneAndUpdate({ _id: id, instituteId, isDeleted: false }, { $set: data }, { new: true });
  },

  async softDelete(id: string, instituteId: string, deletedBy?: string): Promise<boolean> {
    const result = await PeriodSlot.updateOne(
      { _id: id, instituteId, isDeleted: false },
      { $set: { isDeleted: true, updatedBy: deletedBy } }
    );
    return result.modifiedCount > 0;
  },

  async reorder(instituteId: string, orderedIds: string[]): Promise<void> {
    await Promise.all(
      orderedIds.map((id, idx) => PeriodSlot.updateOne({ _id: id, instituteId, isDeleted: false }, { $set: { orderIndex: idx } }))
    );
  },
};
