import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { academicPlanController } from './academic-plan.controller';

const router = Router();

router.use(authenticate);
router.use(authorize('admin', 'tpo', 'faculty'));

router.post('/generate', academicPlanController.generate);
router.get('/', academicPlanController.get);
router.patch('/:id/sessions/:lectureNumber', academicPlanController.editSession);
router.post('/:id/sessions', academicPlanController.addSession);
router.delete('/:id/sessions/:lectureNumber', academicPlanController.deleteSession);
router.post('/:id/reorder', academicPlanController.reorderSessions);
router.delete('/:id', academicPlanController.remove);

export default router;
