import { instituteRepository } from './institute.repository';
import { createInstituteSchema, updateInstituteSchema } from './institute.validation';
import { NotFoundError, ValidationError } from '../../middlewares/errorHandler';
import { IInstitute } from './institute.model';

export const instituteService = {
  async list(): Promise<IInstitute[]> {
    return instituteRepository.findAll();
  },

  async getById(id: string): Promise<IInstitute> {
    const institute = await instituteRepository.findById(id);
    if (!institute) throw new NotFoundError('Institute');
    return institute;
  },

  async create(rawInput: unknown): Promise<IInstitute> {
    const data = createInstituteSchema.parse(rawInput);
    const existing = await instituteRepository.findByCode(data.code);
    if (existing) throw new ValidationError('An institute with this code already exists');
    return instituteRepository.create(data);
  },

  async update(id: string, rawInput: unknown): Promise<IInstitute> {
    const data = updateInstituteSchema.parse(rawInput);
    const institute = await instituteRepository.update(id, data);
    if (!institute) throw new NotFoundError('Institute');
    return institute;
  },

  async remove(id: string): Promise<void> {
    const deleted = await instituteRepository.softDelete(id);
    if (!deleted) throw new NotFoundError('Institute');
  },
};
