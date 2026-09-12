import { Router } from 'express';
import { tpoAssistantController } from './tpo-assistant.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();

router.use(authenticate);
router.use(authorize('admin', 'tpo'));

router.post('/chat', tpoAssistantController.chat);

export default router;
