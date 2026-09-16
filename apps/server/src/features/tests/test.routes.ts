import { Router } from 'express';
import { testController } from './test.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();

router.use(authenticate);

// Candidate-facing — static routes first.
router.get('/mine', authorize('candidate'), testController.listMine);
router.post('/assignments/:assignmentId/start', authorize('candidate'), testController.start);
router.post('/attempts/:attemptId/answers', authorize('candidate'), testController.submitAnswer);
router.post('/attempts/:attemptId/violations', authorize('candidate'), testController.logViolation);
router.post('/attempts/:attemptId/submit', authorize('candidate'), testController.submit);
router.post('/attempts/:attemptId/run', authorize('candidate'), testController.runCode);

// Staff — assignment (sendout) management. Static prefix registered before the paper-level
// `/:id/...` routes below so `/tests/assignments/...` never gets swallowed by `:id`.
router.get('/assignments', authorize('admin', 'tpo', 'faculty'), testController.listAllAssignments);
router.post('/assignments/:assignmentId/send-access-code', authorize('admin', 'tpo', 'faculty'), testController.sendAssignmentAccessCode);
router.patch('/assignments/:assignmentId/close', authorize('admin', 'tpo', 'faculty'), testController.closeAssignment);

// Faculty / TPO authoring + review (paper-level).
router.get('/', authorize('admin', 'tpo', 'faculty'), testController.list);
router.post('/', authorize('admin', 'tpo', 'faculty'), testController.create);
router.post('/generate-draft', authorize('admin', 'tpo', 'faculty'), testController.generateDraft);
router.patch('/:id', authorize('admin', 'tpo', 'faculty'), testController.update);
router.patch('/:id/submit-for-approval', authorize('admin', 'tpo', 'faculty'), testController.submitForApproval);
router.patch('/:id/review', authorize('admin', 'tpo'), testController.review);
router.post('/:id/assignments', authorize('admin', 'tpo', 'faculty'), testController.createAssignment);
router.get('/:id/assignments', authorize('admin', 'tpo', 'faculty'), testController.listAssignments);
router.delete('/:id', authorize('admin', 'tpo', 'faculty'), testController.remove);
router.get('/:id/review', authorize('admin', 'tpo', 'faculty'), testController.getReview);

export default router;
