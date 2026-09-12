import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { sendSuccess, sendCreated } from '../../lib/response';
import { env } from '../../config/env';
import { ValidationError, UnauthorizedError } from '../../middlewares/errorHandler';

export const authController = {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.register(req.body);
      sendCreated(res, result, 'Registered successfully');
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ip = req.ip ?? req.socket.remoteAddress;
      const result = await authService.login(req.body, ip);
      sendCreated(res, result, 'Login successful');
    } catch (err) {
      next(err);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken, sessionId } = req.body as { refreshToken?: string; sessionId?: string };
      if (!refreshToken || !sessionId) {
        next(new UnauthorizedError('refreshToken and sessionId are required'));
        return;
      }
      const tokens = await authService.refresh(refreshToken, sessionId);
      sendSuccess(res, tokens, 'Tokens refreshed');
    } catch (err) {
      next(err);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.logout(req.user!.userId);
      sendSuccess(res, null, 'Logged out successfully');
    } catch (err) {
      next(err);
    }
  },

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await authService.me(req.user!.userId);
      sendSuccess(res, user, 'User profile fetched');
    } catch (err) {
      next(err);
    }
  },

  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.changePassword(req.user!.userId, req.body);
      sendSuccess(res, null, 'Password changed successfully');
    } catch (err) {
      next(err);
    }
  },

  async seed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (env.NODE_ENV !== 'development') {
        next(new ValidationError('Seed endpoint is only available in development'));
        return;
      }
      const { instituteId } = req.body as { instituteId?: string };
      if (!instituteId) {
        next(new ValidationError('instituteId is required in the request body — there is no default institute.'));
        return;
      }
      const result = await authService.seedFirstAdmin(instituteId);
      sendCreated(res, result, 'Admin user seeded. Change the password after first login.');
    } catch (err) {
      next(err);
    }
  },
};
