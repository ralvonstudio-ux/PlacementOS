import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import type { UserRole } from '@placementos/types';

export interface AccessTokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  instituteId: string;
  firstName: string;
  lastName: string;
}

interface RefreshTokenPayload extends AccessTokenPayload {
  tokenVersion: number;
  sessionId: string;
}

export interface DecodedRefreshToken extends RefreshTokenPayload {
  iat: number;
  exp: number;
}

const ACCESS_EXPIRES = '15m' as const;
const REFRESH_EXPIRES = '7d' as const;

export const tokenService = {
  generateAccessToken(payload: AccessTokenPayload): string {
    return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });
  },

  generateRefreshToken(payload: RefreshTokenPayload): string {
    return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
  },

  verifyAccessToken(token: string): AccessTokenPayload {
    return jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as AccessTokenPayload;
  },

  verifyRefreshToken(token: string): DecodedRefreshToken {
    return jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] }) as DecodedRefreshToken;
  },
};
