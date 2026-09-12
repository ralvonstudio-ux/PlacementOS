import { Router } from 'express';
import { facultyController } from './faculty.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();

router.use(authenticate);

router.get('/', facultyController.list);
router.get('/:id', facultyController.getById);
router.post('/', authorize('admin', 'tpo'), facultyController.create);
router.patch('/:id', authorize('admin', 'tpo'), facultyController.update);
router.patch('/:id/status', authorize('admin', 'tpo'), facultyController.changeStatus);
router.post('/:id/login', authorize('admin'), facultyController.createLogin);
router.delete('/:id', authorize('admin'), facultyController.remove);

export default router;
