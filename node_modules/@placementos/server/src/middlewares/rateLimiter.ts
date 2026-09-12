import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request, Response } from 'express';
import { env } from '../config/env';
import { tokenService } from '../features/auth/token.service';

const rateLimitResponse = (message: string) => ({
  success: false,
  error: { message, code: 'RATE_LIMIT_EXCEEDED', statusCode: 429 },
});

const makeRateLimitHandler = (message: string) => (_req: Request, res: Response) => {
  res.status(429).json(rateLimitResponse(message));
};

const isDevelopment = process.env.NODE_ENV === 'development';

// apiLimiter runs ahead of the `authenticate` middleware, so req.user isn't
// populated yet here. Verify the access token directly to key on the actual
// signed-in user instead of falling back to express-rate-limit's default
// IP-only key — this only ever narrows the bucket a request lands in.
const keyGenerator = (req: Request): string => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = tokenService.verifyAccessToken(header.slice(7));
      return `user:${payload.userId}`;
    } catch {
      // fall through to IP-keying below
    }
  }
  return ipKeyGenerator(req.ip ?? '');
};

export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: isDevelopment ? 100_000 : env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: makeRateLimitHandler('Too many requests. Please slow down.'),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevelopment ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeRateLimitHandler('Too many login attempts. Please try again in 15 minutes.'),
});

// Keyed on the submitted identifier (email/username) rather than IP, so it
// caps attempts against a single account regardless of source IP.
export const authAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevelopment ? 1000 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    const identifier = (req.body as { identifier?: string } | undefined)?.identifier;
    return typeof identifier === 'string' ? identifier.trim().toLowerCase() : 'unknown';
  },
  handler: makeRateLimitHandler('Too many login attempts for this account. Please try again in 15 minutes.'),
});
