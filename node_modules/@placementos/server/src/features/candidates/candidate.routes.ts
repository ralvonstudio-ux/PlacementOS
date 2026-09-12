import { Router } from 'express';
import { candidateController } from './candidate.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();

router.use(authenticate);

router.get('/', candidateController.list);
router.get('/:id', candidateController.getById);
router.post('/', authorize('admin', 'tpo'), candidateController.create);
router.patch('/:id', authorize('admin', 'tpo'), candidateController.update);
router.delete('/:id', authorize('admin', 'tpo'), candidateController.remove);
router.post('/:id/login', authorize('admin', 'tpo'), candidateController.createLogin);

export default router;
