import { Router } from 'express';
import { notificationController } from './notification.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();

router.use(authenticate);

// Candidate-facing — reading their own notifications.
router.get('/mine', authorize('candidate'), notificationController.listMine);
router.patch('/:id/read', authorize('candidate'), notificationController.markRead);
router.patch('/read-all', authorize('candidate'), notificationController.markAllRead);

// Staff-facing — composing a one-way message to chosen candidates.
router.post('/send', authorize('admin', 'tpo', 'faculty'), notificationController.send);

export default router;
