import { Router } from 'express';
import { tpoController } from './tpo.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();

router.use(authenticate);
router.use(authorize('admin', 'tpo'));

router.get('/dashboard', tpoController.getDashboard);
router.get('/faculty-summary', tpoController.getFacultySummary);
router.post('/briefing-summary', tpoController.getBriefingSummary);
router.get('/attendance-insights', tpoController.getAttendanceInsights);

export default router;
