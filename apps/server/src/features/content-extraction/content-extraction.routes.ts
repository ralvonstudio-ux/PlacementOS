import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { documentUploadMiddleware } from '../../lib/image-upload';
import { contentExtractionController } from './content-extraction.controller';

const router = Router();

router.use(authenticate);
router.use(authorize('admin', 'tpo', 'faculty'));

router.post('/extract', documentUploadMiddleware, contentExtractionController.extract);

export default router;
