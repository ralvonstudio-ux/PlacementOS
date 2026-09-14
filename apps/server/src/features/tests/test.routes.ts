import { Router } from 'express';
import { testController } from './test.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();

router.use(authenticate);

// Candidate-facing — static routes first.
router.get('/mine', authorize('candidate'), testController.listMine);
router.post('/:id/start', authorize('candidate'), testController.start);
router.post('/attempts/:attemptId/answers', authorize('candidate'), testController.submitAnswer);
router.post('/attempts/:attemptId/violations', authorize('candidate'), testController.logViolation);
router.post('/attempts/:attemptId/submit', authorize('candidate'), testController.submit);

// Faculty / TPO authoring + review.
router.get('/', authorize('admin', 'tpo', 'faculty'), testController.list);
router.post('/', authorize('admin', 'tpo', 'faculty'), testController.create);
router.post('/generate-draft', authorize('admin', 'tpo', 'faculty'), testController.generateDraft);
router.patch('/:id', authorize('admin', 'tpo', 'faculty'), testController.update);
router.patch('/:id/submit-for-approval', authorize('admin', 'tpo', 'faculty'), testController.submitForApproval);
router.patch('/:id/review', authorize('admin', 'tpo'), testController.review);
router.patch('/:id/publish', authorize('admin', 'tpo', 'faculty'), testController.publish);
router.patch('/:id/close', authorize('admin', 'tpo', 'faculty'), testController.close);
router.delete('/:id', authorize('admin', 'tpo', 'faculty'), testController.remove);
router.get('/:id/review', authorize('admin', 'tpo', 'faculty'), testController.getReview);

export default router;
