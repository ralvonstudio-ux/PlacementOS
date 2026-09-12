import { Router } from 'express';
import { candidateProfileController } from './candidate-profile.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { documentUploadMiddleware } from '../../lib/image-upload';

const router = Router();

router.use(authenticate);
router.use(authorize('candidate'));

router.get('/me', candidateProfileController.getMine);
router.put('/me', candidateProfileController.saveMine);
router.post('/me/resume', documentUploadMiddleware, candidateProfileController.uploadResume);
router.get('/me/leetcode', candidateProfileController.getMyLeetCodeStats);

export default router;
