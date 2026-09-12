import app from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { logger } from './lib/logger';

const start = async (): Promise<void> => {
  await connectDatabase();

  const server = app.listen(Number(env.PORT), () => {
    logger.info('PlacementOS Server started', {
      port: env.PORT,
      environment: env.NODE_ENV,
      health: `http://localhost:${env.PORT}/api/v1/health`,
    });
  });

  // keepAliveTimeout must exceed the load balancer's idle timeout so the
  // server never reuses a connection this process has already closed.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      await disconnectDatabase();
      logger.info('Server shut down cleanly');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { reason });
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  });
};

start().catch((error) => {
  logger.error('Failed to start server', { error });
  process.exit(1);
});
