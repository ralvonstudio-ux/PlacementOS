import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { sendSuccess } from '../lib/response';

export const healthController = {
  check(_req: Request, res: Response): void {
    sendSuccess(
      res,
      {
        status: 'ok',
        db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
      },
      'Healthy'
    );
  },
};
