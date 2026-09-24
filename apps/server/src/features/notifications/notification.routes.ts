import { Router } from 'express';
import { notificationController } from './notification.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();

router.use(authenticate);

// Recipient-facing — reading their own notifications. Candidates and faculty can both now
// be message recipients (a broadcast's audience can be either, or both).
router.get('/mine', authorize('candidate', 'faculty'), notificationController.listMine);
router.get('/unacknowledged', authorize('candidate', 'faculty'), notificationController.listUnacknowledged);
router.patch('/:id/read', authorize('candidate', 'faculty'), notificationController.markRead);
router.patch('/read-all', authorize('candidate', 'faculty'), notificationController.markAllRead);
router.patch('/:id/acknowledge', authorize('candidate', 'faculty'), notificationController.acknowledge);

// Staff-facing — composing a one-way message to chosen candidates/faculty, and reviewing
// past broadcasts' acknowledgment status.
router.post('/send', authorize('admin', 'tpo', 'faculty'), notificationController.send);
router.get('/broadcasts', authorize('admin', 'tpo', 'faculty'), notificationController.listBroadcasts);
router.get('/broadcasts/:broadcastId/recipients', authorize('admin', 'tpo', 'faculty'), notificationController.getBroadcastRecipients);

export default router;
