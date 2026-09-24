import { Router } from 'express';
import { trainerFeedbackController } from './trainer-feedback.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();

router.use(authenticate);

router.post('/', authorize('candidate'), trainerFeedbackController.submit);
router.get('/my-trainers', authorize('candidate'), trainerFeedbackController.myTrainers);
router.get('/overview', authorize('admin', 'tpo'), trainerFeedbackController.overview);
router.get('/', authorize('admin', 'tpo'), trainerFeedbackController.list);

export default router;
