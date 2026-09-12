import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { connectDatabase } from './config/database';
import { logger } from './lib/logger';
import { requestContextMiddleware } from './middlewares/requestContext';
import { requestLogger } from './middlewares/requestLogger';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { apiLimiter } from './middlewares/rateLimiter';
import router from './routes';

const app: Application = express();

// Reverse proxies (Render, etc.) set X-Forwarded-For; trust one proxy hop so
// express-rate-limit and req.ip work correctly.
app.set('trust proxy', 1);

// On serverless platforms this module may be imported directly as the request
// handler and server.ts's start() never runs.
connectDatabase().catch((error) => {
  logger.error('MongoDB connection failed', { error: String(error), message: (error as Error).message });
});

// ── Security ──────────────────────────────────────────────────────────────────
const envOrigins = env.FRONTEND_URL.split(',').map((origin) => origin.trim()).filter(Boolean);
const allowedOrigins = Array.from(new Set(envOrigins));
const isLocalhostOrigin = (origin: string): boolean =>
  env.NODE_ENV !== 'production' && /^https?:\/\/localhost:\d+$/.test(origin);

app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: Math.floor(process.uptime()) });
});

app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || isLocalhostOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id'],
  })
);

// ── Body Parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ── Request Context & Logging ─────────────────────────────────────────────────
app.use(requestContextMiddleware);
app.use(requestLogger);

// ── Rate Limiting ─────────────────────────────────────────────────────────────
app.use('/api/', apiLimiter);

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/v1', router);

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use(notFoundHandler);

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use(errorHandler);

export default app;
