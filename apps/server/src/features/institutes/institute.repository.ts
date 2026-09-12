import { Institute, IInstitute } from './institute.model';

export const instituteRepository = {
  async create(data: { name: string; code: string; address?: string; contactEmail?: string; contactPhone?: string }): Promise<IInstitute> {
    return Institute.create(data);
  },

  async findById(id: string): Promise<IInstitute | null> {
    return Institute.findOne({ _id: id, isDeleted: false });
  },

  async findByCode(code: string): Promise<IInstitute | null> {
    return Institute.findOne({ code: code.toUpperCase(), isDeleted: false });
  },

  async findAll(): Promise<IInstitute[]> {
    return Institute.find({ isDeleted: false }).sort({ createdAt: -1 });
  },

  async update(id: string, data: Partial<IInstitute>): Promise<IInstitute | null> {
    return Institute.findOneAndUpdate({ _id: id, isDeleted: false }, { $set: data }, { new: true });
  },

  async softDelete(id: string): Promise<boolean> {
    const result = await Institute.updateOne({ _id: id, isDeleted: false }, { $set: { isDeleted: true, deletedAt: new Date() } });
    return result.modifiedCount > 0;
  },
};
