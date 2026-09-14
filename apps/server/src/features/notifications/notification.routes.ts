import { Router } from 'express';
import { notificationController } from './notification.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();

router.use(authenticate);

// Candidate-facing only for now — the sole notification type today (test access codes)
// only ever targets candidates.
router.get('/mine', authorize('candidate'), notificationController.listMine);
router.patch('/:id/read', authorize('candidate'), notificationController.markRead);
router.patch('/read-all', authorize('candidate'), notificationController.markAllRead);

export default router;
