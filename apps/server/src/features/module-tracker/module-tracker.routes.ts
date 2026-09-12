import { Router } from 'express';
import { moduleTrackerController } from './module-tracker.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();

router.use(authenticate);

router.get('/modules', moduleTrackerController.list);
router.post('/modules', authorize('admin', 'tpo'), moduleTrackerController.create);
router.patch('/modules/:id', authorize('admin', 'tpo'), moduleTrackerController.update);
router.delete('/modules/:id', authorize('admin', 'tpo'), moduleTrackerController.remove);

router.get('/coverage', moduleTrackerController.getCoverage);
router.patch('/modules/:moduleId/progress', authorize('admin', 'tpo', 'faculty'), moduleTrackerController.setProgress);

export default router;
