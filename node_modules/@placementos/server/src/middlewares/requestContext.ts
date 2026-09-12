import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';
import { Request, Response, NextFunction } from 'express';

// Threads a per-request id through every log line without passing `req` down
// every call stack. AsyncLocalStorage keeps this safe across concurrent
// requests on the same process.

export interface RequestContext {
  requestId: string;
  startedAt: number;
  instituteId?: string;
  userId?: string;
  role?: string;
  ip?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export const requestContextMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = randomUUID();
  res.setHeader('X-Request-Id', requestId);

  const context: RequestContext = {
    requestId,
    startedAt: Date.now(),
    ip: req.ip,
  };

  storage.run(context, () => next());
};

// req.user is populated by the auth middleware, which runs after this one —
// call this from auth middleware once the JWT is verified so later log lines
// in the same request carry the user/institute/role too.
export function attachRequestUser(user: { userId?: string; instituteId?: string; role?: string }): void {
  const ctx = storage.getStore();
  if (!ctx) return;
  ctx.userId = user.userId;
  ctx.instituteId = user.instituteId;
  ctx.role = user.role;
}
