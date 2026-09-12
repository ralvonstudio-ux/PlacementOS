import bcrypt from 'bcrypt';
import { userRepository, FindUsersOptions, PaginatedUsers } from './user.repository';
import { createUserSchema, updateUserSchema, statusChangeSchema } from './user.validation';
import { NotFoundError, ValidationError } from '../../middlewares/errorHandler';
import { IUser } from './user.model';
import { AuthContext } from '../../lib/auth-context';
import { ROLE_PERMISSIONS, ROLE_META, PERMISSION_META, Permission } from '../../lib/permissions';
import type { UserRole } from '@placementos/types';

const SALT_ROUNDS = 12;

export const userService = {
  async listUsers(instituteId: string, options: FindUsersOptions = {}): Promise<PaginatedUsers> {
    return userRepository.findAll(instituteId, options);
  },

  async getUser(id: string, instituteId: string): Promise<IUser> {
    const user = await userRepository.findById(id, instituteId);
    if (!user) throw new NotFoundError('User');
    return user;
  },

  async createUser(rawInput: unknown, ctx: AuthContext): Promise<IUser> {
    const data = createUserSchema.parse(rawInput);

    const existing = await userRepository.findByEmail(data.email);
    if (existing) throw new ValidationError('A user with this email already exists');

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

    return userRepository.create({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      passwordHash,
      role: data.role,
      instituteId: ctx.instituteId,
      createdBy: ctx.userId,
    });
  },

  async updateUser(id: string, rawInput: unknown, ctx: AuthContext): Promise<IUser> {
    const data = updateUserSchema.parse(rawInput);

    const updateData: Partial<IUser> & { password?: string } = { ...data };
    delete updateData.password;

    if (data.password) {
      (updateData as Record<string, unknown>).passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    }

    updateData.updatedBy = ctx.userId;

    const user = await userRepository.update(id, ctx.instituteId, updateData);
    if (!user) throw new NotFoundError('User');
    return user;
  },

  async changeStatus(id: string, rawInput: unknown, ctx: AuthContext): Promise<IUser> {
    if (id === ctx.userId) throw new ValidationError('You cannot change your own status');

    const { status } = statusChangeSchema.parse(rawInput);
    const user = await userRepository.update(id, ctx.instituteId, { status, updatedBy: ctx.userId });
    if (!user) throw new NotFoundError('User');
    return user;
  },

  async deleteUser(id: string, ctx: AuthContext): Promise<void> {
    if (id === ctx.userId) throw new ValidationError('You cannot delete your own account');
    const deleted = await userRepository.softDelete(id, ctx.instituteId);
    if (!deleted) throw new NotFoundError('User');
  },

  getRoles(): { id: UserRole; label: string; description: string; permissions: Permission[] }[] {
    return (Object.keys(ROLE_META) as UserRole[]).map((role) => ({
      id: role,
      ...ROLE_META[role],
      permissions: [...ROLE_PERMISSIONS[role]] as Permission[],
    }));
  },

  getPermissions(): { id: Permission; label: string; category: string }[] {
    return (Object.keys(PERMISSION_META) as Permission[]).map((permission) => ({
      id: permission,
      ...PERMISSION_META[permission],
    }));
  },
};
