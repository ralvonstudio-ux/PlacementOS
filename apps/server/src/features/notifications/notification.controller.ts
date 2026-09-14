import { Request, Response, NextFunction } from 'express';
import { notificationService } from './notification.service';
import { sendSuccess } from '../../lib/response';
import { buildAuthContext } from '../../lib/auth-context';

export const notificationController = {
  async listMine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const result = await notificationService.listMine(ctx);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  },

  async markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const notification = await notificationService.markRead(req.params.id, ctx);
      sendSuccess(res, notification, 'Notification marked as read');
    } catch (err) { next(err); }
  },

  async markAllRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      await notificationService.markAllRead(ctx);
      sendSuccess(res, null, 'All notifications marked as read');
    } catch (err) { next(err); }
  },
};
