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

  async listUnacknowledged(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const result = await notificationService.listUnacknowledged(ctx);
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

  async acknowledge(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const notification = await notificationService.acknowledge(req.params.id, ctx);
      sendSuccess(res, notification, 'Acknowledged');
    } catch (err) { next(err); }
  },

  async send(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const result = await notificationService.sendStaffMessage(req.body, ctx);
      sendSuccess(res, result, `Message sent to ${result.sentCount} recipient(s)`);
    } catch (err) { next(err); }
  },

  async listBroadcasts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const result = await notificationService.listBroadcasts(ctx);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  },

  async getBroadcastRecipients(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const result = await notificationService.getBroadcastRecipients(req.params.broadcastId, ctx);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  },
};
