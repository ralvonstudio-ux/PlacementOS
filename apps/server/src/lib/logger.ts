import winston from 'winston';
import { getRequestContext } from '../middlewares/requestContext';

const { combine, timestamp, errors, colorize, printf, json } = winston.format;

const isDevelopment = process.env.NODE_ENV !== 'production';

// Pulls the current request's id/institute/user from AsyncLocalStorage (see
// requestContext.ts) so every log line is traceable to the request that
// produced it without every call site threading `req` through manually.
const attachRequestContext = winston.format((info) => {
  const ctx = getRequestContext();
  if (ctx) {
    info.requestId = ctx.requestId;
    if (ctx.instituteId) info.instituteId = ctx.instituteId;
    if (ctx.userId) info.userId = ctx.userId;
    if (ctx.role) info.role = ctx.role;
  }
  info.env = process.env.NODE_ENV || 'development';
  return info;
})();

const devFormat = combine(
  attachRequestContext,
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    const stackStr = stack ? `\n${stack}` : '';
    return `${timestamp} [${level}]: ${message}${metaStr}${stackStr}`;
  })
);

const prodFormat = combine(attachRequestContext, timestamp(), errors({ stack: true }), json());

export const logger = winston.createLogger({
  level: isDevelopment ? 'debug' : 'info',
  format: isDevelopment ? devFormat : prodFormat,
  transports: [new winston.transports.Console()],
  exitOnError: false,
});
