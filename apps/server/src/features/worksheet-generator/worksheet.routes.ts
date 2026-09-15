import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { documentUploadMiddleware } from '../../lib/image-upload';
import { worksheetController } from './worksheet.controller';

const router = Router();

router.use(authenticate);

// Candidate-facing — must come before the staff-only `/:id` routes below, since `:id` would
// otherwise swallow the literal `/my` and `/my/:id` paths first.
router.get('/my', authorize('candidate'), worksheetController.listMine);
router.get('/my/:id', authorize('candidate'), worksheetController.getMineById);

router.use(authorize('admin', 'tpo', 'faculty'));

router.post('/generate', worksheetController.generate);
router.post('/generate-from-content', worksheetController.generateFromContent);
router.post('/upload', documentUploadMiddleware, worksheetController.uploadAttachment);
router.post('/', worksheetController.save);
router.get('/', worksheetController.list);
router.get('/:id', worksheetController.getById);
router.patch('/:id', worksheetController.update);
router.delete('/:id', worksheetController.delete);

export default router;
