import { Router } from 'express';
import { trainingScheduleController } from './training-schedule.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();

router.use(authenticate);

router.get('/', trainingScheduleController.list);
router.get('/:id', trainingScheduleController.getById);
router.post('/', authorize('admin', 'tpo'), trainingScheduleController.create);
router.patch('/:id', authorize('admin', 'tpo'), trainingScheduleController.update);
router.delete('/:id', authorize('admin', 'tpo'), trainingScheduleController.remove);

export default router;
