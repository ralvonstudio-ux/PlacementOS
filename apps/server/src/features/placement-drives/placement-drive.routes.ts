import { Router } from 'express';
import { placementDriveController } from './placement-drive.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();

router.use(authenticate);

// Candidate-facing — static routes before `/:id`.
router.get('/mine', authorize('candidate'), placementDriveController.listMine);
router.post('/:id/apply', authorize('candidate'), placementDriveController.apply);
router.post('/:id/withdraw', authorize('candidate'), placementDriveController.withdraw);

// TPO / admin — drive management and the selection pipeline.
router.get('/stats', authorize('admin', 'tpo'), placementDriveController.stats);
router.get('/', authorize('admin', 'tpo'), placementDriveController.list);
router.post('/', authorize('admin', 'tpo'), placementDriveController.create);
router.get('/:id', authorize('admin', 'tpo'), placementDriveController.getDetail);
router.patch('/:id', authorize('admin', 'tpo'), placementDriveController.update);
router.delete('/:id', authorize('admin', 'tpo'), placementDriveController.remove);
router.patch('/:id/status', authorize('admin', 'tpo'), placementDriveController.setStatus);
router.post('/:id/round-results', authorize('admin', 'tpo'), placementDriveController.recordRoundResult);
router.post('/:id/applications/status', authorize('admin', 'tpo'), placementDriveController.setApplicationStatus);

export default router;
