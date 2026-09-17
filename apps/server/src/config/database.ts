import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../lib/logger';
import { Candidate } from '../features/candidates/candidate.model';

// Caches the in-flight connect() promise so every caller — the eager call at
// module load, and the per-request middleware in app.ts that awaits this
// before handling anything — waits on the SAME attempt instead of each one
// racing off on its own. Without this, a second caller made while readyState
// was merely "connecting" (2) used to return immediately without actually
// waiting for the connection to finish, which on a serverless cold start
// meant requests routinely got served before Mongo was ready at all.
let connectionPromise: Promise<void> | null = null;

// Safe to call from multiple entry points / concurrently. Skips reconnecting
// if a connection is already up; awaits the shared in-flight attempt if one
// is already in progress; resets the cache on failure so the next call
// (e.g. the next request) gets a fresh retry rather than a cached rejection.
export const connectDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (!connectionPromise) {
    connectionPromise = (async () => {
      try {
        mongoose.set('strictQuery', true);

        await mongoose.connect(env.MONGODB_URI, {
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 30000,
          connectTimeoutMS: 5000,
          maxPoolSize: 50,
          minPoolSize: 5,
          waitQueueTimeoutMS: 10000,
        });

        logger.info('MongoDB connected', {
          host: mongoose.connection.host,
          db: mongoose.connection.name,
        });

        try {
          const { migrateLegacyTests } = await import('../features/tests/test-migration');
          await migrateLegacyTests();
        } catch (error) {
          logger.error('Legacy test migration failed', { error });
        }

        // One-time self-heal: candidate.model.ts's `{instituteId, loginEmail}` unique
        // index has a partialFilterExpression (only enforce uniqueness when loginEmail
        // is actually set), but a deploy from before that fix left the OLD plain unique
        // index sitting on production — Mongoose's autoIndex only ever creates missing
        // indexes, never drops/replaces a conflicting one. That stale index rejects
        // every candidate past the first with no loginEmail as a "duplicate null" key
        // error. syncIndexes() reconciles the live indexes with the schema (dropping
        // ones no longer declared, creating ones that are) — safe to run on every
        // connect since it's a no-op once the indexes already match.
        try {
          await Candidate.syncIndexes();
        } catch (error) {
          logger.warn('Candidate index sync failed — leaving existing indexes as-is', { error });
        }

        mongoose.connection.on('disconnected', () => {
          logger.warn('MongoDB disconnected — retrying automatically');
        });

        mongoose.connection.on('reconnected', () => {
          logger.info('MongoDB reconnected');
        });
      } catch (error) {
        connectionPromise = null;
        logger.error('MongoDB connection failed', { error });
        throw error;
      }
    })();
  }

  return connectionPromise;
};

export const disconnectDatabase = async (): Promise<void> => {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
};
