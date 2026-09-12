import { Request, Response, NextFunction } from 'express';
import { tpoAssistantService } from './tpo-assistant.service';
import { sendSuccess } from '../../lib/response';
import { buildAuthContext } from '../../lib/auth-context';

export const tpoAssistantController = {
  async chat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildAuthContext(req.user!, req.ip ?? undefined);
      const result = await tpoAssistantService.chat(req.body, ctx);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  },
};
