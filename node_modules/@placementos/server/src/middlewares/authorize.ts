import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from './errorHandler';
import type { UserRole } from '@placementos/types';

export const authorize =
  (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ForbiddenError('Not authenticated'));
      return;
    }
    const userRole = req.user.role as UserRole;
    if (!roles.includes(userRole)) {
      next(new ForbiddenError(`Access denied. Required role: ${roles.join(' or ')}`));
      return;
    }
    next();
  };
