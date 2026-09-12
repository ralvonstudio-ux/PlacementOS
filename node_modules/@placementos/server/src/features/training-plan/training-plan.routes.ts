import { Router } from 'express';
import { trainingPlanController } from './training-plan.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();

router.use(authenticate);

router.get('/tpo/overview', authorize('admin', 'tpo'), trainingPlanController.getTpoOverview);
router.get('/tpo/:facultyId', authorize('admin', 'tpo'), trainingPlanController.getForFaculty);
router.get('/alerts', authorize('admin', 'tpo'), trainingPlanController.listAlerts);
router.patch('/alerts/:alertId/resolve', authorize('admin', 'tpo'), trainingPlanController.resolveAlert);

router.post('/generate', authorize('faculty'), trainingPlanController.generate);
router.get('/mine', trainingPlanController.getWeek);
router.get('/month', trainingPlanController.getMonth);
router.patch('/:id/days', authorize('admin', 'tpo', 'faculty'), trainingPlanController.setDayStatus);
router.patch('/:id/days/edit', authorize('admin', 'tpo', 'faculty'), trainingPlanController.editDay);
router.patch('/:id/days/move', authorize('admin', 'tpo', 'faculty'), trainingPlanController.moveDay);

export default router;
