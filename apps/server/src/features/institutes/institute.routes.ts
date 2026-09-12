import { Router } from 'express';
import { instituteController } from './institute.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();

router.use(authenticate);

router.get('/', instituteController.list);
router.get('/:id', instituteController.getById);
router.post('/', authorize('admin'), instituteController.create);
router.patch('/:id', authorize('admin'), instituteController.update);
router.delete('/:id', authorize('admin'), instituteController.remove);

export default router;
