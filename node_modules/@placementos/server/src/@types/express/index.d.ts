import 'express';
import type { UserRole } from '@placementos/types';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: UserRole;
        instituteId: string;
        firstName: string;
        lastName: string;
      };
    }
  }
}
