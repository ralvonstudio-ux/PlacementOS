import { Router } from 'express';
import { importController, uploadMiddleware } from './import.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();

router.use(authenticate);
router.use(authorize('admin', 'tpo'));

router.get('/templates', importController.listTemplates);

router.post('/sessions', uploadMiddleware, importController.upload);
router.get('/sessions', importController.list);
router.get('/sessions/:id', importController.getById);
router.patch('/sessions/:id/mapping', importController.updateMapping);
router.patch('/sessions/:id/duplicates', importController.setDuplicateStrategy);
router.patch('/sessions/:id/rows/:rowNumber', importController.updateRow);
router.delete('/sessions/:id/rows/:rowNumber', importController.deleteRow);
router.post('/sessions/:id/confirm', importController.confirm);
router.post('/sessions/:id/cancel', importController.cancel);
router.post('/sessions/:id/rollback', importController.rollback);

export default router;
