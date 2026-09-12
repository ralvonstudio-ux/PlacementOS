import bcrypt from 'bcrypt';
import { facultyRepository, FindFacultyOptions, PaginatedFaculty } from './faculty.repository';
import { userRepository } from '../users/user.repository';
import { createFacultySchema, updateFacultySchema, changeStatusSchema, createLoginSchema } from './faculty.validation';
import { NotFoundError, ValidationError } from '../../middlewares/errorHandler';
import { IFaculty } from './faculty.model';
import { AuthContext } from '../../lib/auth-context';

const SALT_ROUNDS = 12;

export const facultyService = {
  async list(instituteId: string, options: FindFacultyOptions = {}): Promise<PaginatedFaculty> {
    return facultyRepository.findAll(instituteId, options);
  },

  async getById(id: string, instituteId: string): Promise<IFaculty> {
    const faculty = await facultyRepository.findById(id, instituteId);
    if (!faculty) throw new NotFoundError('Faculty');
    return faculty;
  },

  async create(rawInput: unknown, ctx: AuthContext): Promise<IFaculty> {
    const data = createFacultySchema.parse(rawInput);

    const existing = await facultyRepository.findByEmployeeId(data.employeeId, ctx.instituteId);
    if (existing) throw new ValidationError('A faculty member with this employee ID already exists');

    return facultyRepository.create({
      ...data,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      joiningDate: data.joiningDate ? new Date(data.joiningDate) : undefined,
      instituteId: ctx.instituteId,
      createdBy: ctx.userId,
    });
  },

  async update(id: string, rawInput: unknown, ctx: AuthContext): Promise<IFaculty> {
    const data = updateFacultySchema.parse(rawInput);
    const updateData: Record<string, unknown> = { ...data, updatedBy: ctx.userId };
    if (data.dateOfBirth) updateData.dateOfBirth = new Date(data.dateOfBirth);
    if (data.joiningDate) updateData.joiningDate = new Date(data.joiningDate);

    const faculty = await facultyRepository.update(id, ctx.instituteId, updateData);
    if (!faculty) throw new NotFoundError('Faculty');
    return faculty;
  },

  async changeStatus(id: string, rawInput: unknown, ctx: AuthContext): Promise<IFaculty> {
    const { employmentStatus } = changeStatusSchema.parse(rawInput);
    const faculty = await facultyRepository.update(id, ctx.instituteId, { employmentStatus, updatedBy: ctx.userId });
    if (!faculty) throw new NotFoundError('Faculty');
    return faculty;
  },

  async remove(id: string, ctx: AuthContext): Promise<void> {
    const deleted = await facultyRepository.softDelete(id, ctx.instituteId, ctx.userId);
    if (!deleted) throw new NotFoundError('Faculty');
  },

  /** Creates a login (User account, role 'faculty') linked to this Faculty
   *  profile by loginEmail/employeeId — mirrors the SchoolOS "Create Login" flow. */
  async createLogin(id: string, rawInput: unknown, ctx: AuthContext): Promise<{ email: string }> {
    const { loginEmail, password } = createLoginSchema.parse(rawInput);
    const faculty = await facultyRepository.findById(id, ctx.instituteId);
    if (!faculty) throw new NotFoundError('Faculty');

    const existingUser = await userRepository.findByEmail(loginEmail);
    if (existingUser) throw new ValidationError('A user with this login email already exists');

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await userRepository.create({
      firstName: faculty.fullName.split(' ')[0] || faculty.fullName,
      lastName: faculty.fullName.split(' ').slice(1).join(' ') || faculty.fullName,
      email: loginEmail,
      passwordHash,
      role: 'faculty',
      instituteId: ctx.instituteId,
      createdBy: ctx.userId,
    });

    await facultyRepository.update(id, ctx.instituteId, { loginEmail, updatedBy: ctx.userId });

    return { email: loginEmail };
  },
};
