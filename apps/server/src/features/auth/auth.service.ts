import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { User } from '../users/user.model';
import { userRepository } from '../users/user.repository';
import { tokenService, AccessTokenPayload } from './token.service';
import { UnauthorizedError, ValidationError } from '../../middlewares/errorHandler';
import { loginSchema, changePasswordSchema, registerSchema } from '../users/user.validation';
import { logger } from '../../lib/logger';

const SALT_ROUNDS = 12;

export const authService = {
  async register(rawInput: unknown): Promise<{ accessToken: string; refreshToken: string; sessionId: string; user: AccessTokenPayload }> {
    const data = registerSchema.parse(rawInput);

    const existing = await userRepository.findByEmail(data.email);
    if (existing) throw new ValidationError('A user with this email already exists');

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    const user = await userRepository.create({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      passwordHash,
      role: data.role,
      instituteId: data.instituteId,
    });

    const payload: AccessTokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      instituteId: user.instituteId,
      firstName: user.firstName,
      lastName: user.lastName,
    };
    const accessToken = tokenService.generateAccessToken(payload);
    const sessionId = crypto.randomUUID();
    const refreshToken = tokenService.generateRefreshToken({ ...payload, tokenVersion: user.tokenVersion, sessionId });

    logger.info('User registered', { userId: payload.userId, email: user.email });

    return { accessToken, refreshToken, sessionId, user: payload };
  },

  async login(
    rawInput: unknown,
    ip?: string
  ): Promise<{
    accessToken: string; refreshToken: string; sessionId: string; user: AccessTokenPayload;
  }> {
    const { identifier: rawIdentifier, password } = loginSchema.parse(rawInput);
    const identifier = rawIdentifier.trim().toLowerCase();

    const user = identifier.includes('@')
      ? await userRepository.findByEmail(identifier)
      : await userRepository.findByUsername(identifier);
    if (!user) {
      logger.warn('Login failed: user not found', { identifier, ip });
      throw new UnauthorizedError('Invalid credentials');
    }

    if (user.status !== 'active') {
      logger.warn('Login failed: inactive user', { identifier, ip });
      throw new UnauthorizedError('Account is inactive. Contact your administrator.');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      logger.warn('Login failed: wrong password', { identifier, ip });
      throw new UnauthorizedError('Invalid credentials');
    }

    userRepository.updateLastLogin(user._id.toString()).catch((err: unknown) => {
      logger.error('updateLastLogin failed', { userId: user._id.toString(), err });
    });

    const payload: AccessTokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      instituteId: user.instituteId,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    const accessToken = tokenService.generateAccessToken(payload);
    const sessionId = crypto.randomUUID();
    const refreshToken = tokenService.generateRefreshToken({ ...payload, tokenVersion: user.tokenVersion, sessionId });

    logger.info('Login success', { userId: payload.userId, email: user.email, ip });

    return { accessToken, refreshToken, sessionId, user: payload };
  },

  async refresh(rawToken: string, expectedSessionId: string): Promise<{ accessToken: string; refreshToken: string }> {
    let decoded;
    try {
      decoded = tokenService.verifyRefreshToken(rawToken);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    if (decoded.sessionId !== expectedSessionId) {
      throw new UnauthorizedError('Session mismatch — please log in again');
    }

    const user = await userRepository.findByIdForAuth(decoded.userId);
    if (!user) throw new UnauthorizedError('User not found');
    if (user.status !== 'active') throw new UnauthorizedError('Account is inactive');
    if (user.tokenVersion !== decoded.tokenVersion) {
      throw new UnauthorizedError('Token has been revoked. Please log in again.');
    }

    const payload: AccessTokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      instituteId: user.instituteId,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    return {
      accessToken: tokenService.generateAccessToken(payload),
      refreshToken: tokenService.generateRefreshToken({ ...payload, tokenVersion: user.tokenVersion, sessionId: decoded.sessionId }),
    };
  },

  async logout(userId: string): Promise<void> {
    await userRepository.incrementTokenVersion(userId);
    logger.info('Logout', { userId });
  },

  async me(userId: string): Promise<AccessTokenPayload & { lastLoginAt?: Date }> {
    const user = await userRepository.findByIdForAuth(userId);
    if (!user) throw new UnauthorizedError('User not found');
    return {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      instituteId: user.instituteId,
      firstName: user.firstName,
      lastName: user.lastName,
      lastLoginAt: user.lastLoginAt,
    };
  },

  async changePassword(userId: string, rawInput: unknown): Promise<void> {
    const { currentPassword, newPassword } = changePasswordSchema.parse(rawInput);

    const user = await userRepository.findByIdForAuth(userId);
    if (!user) throw new UnauthorizedError('User not found');

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) throw new ValidationError('Current password is incorrect');

    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await userRepository.updatePassword(userId, newHash);

    logger.info('Password changed', { userId });
  },

  /** Dev-only convenience — seeds a single admin account for a given institute. */
  async seedFirstAdmin(instituteId: string): Promise<{ email: string; password: string }> {
    const password = 'Admin@123';
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const existing = await User.findOne({ email: 'admin@placementos.app' });
    if (existing) {
      await User.updateOne(
        { email: 'admin@placementos.app' },
        { $set: { passwordHash, instituteId, status: 'active', tokenVersion: existing.tokenVersion + 1 } }
      );
      logger.info('Seed: admin password reset', { instituteId });
      return { email: 'admin@placementos.app', password };
    }

    await User.create({
      firstName: 'System',
      lastName: 'Administrator',
      email: 'admin@placementos.app',
      passwordHash,
      role: 'admin',
      instituteId,
      status: 'active',
    });

    logger.info('Seed: first admin created', { instituteId });
    return { email: 'admin@placementos.app', password };
  },
};
