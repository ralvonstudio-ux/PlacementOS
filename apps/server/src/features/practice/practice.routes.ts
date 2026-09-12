import { Router } from 'express';
import { practiceController } from './practice.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();

router.use(authenticate);

// Readable by anyone authenticated (candidates browse; faculty/TPO manage) — writes are gated below.
router.get('/questions', practiceController.listQuestions);
router.get('/companies', practiceController.listCompanies);
router.post('/questions', authorize('admin', 'tpo', 'faculty'), practiceController.createQuestion);
router.patch('/questions/:id', authorize('admin', 'tpo', 'faculty'), practiceController.updateQuestion);
router.delete('/questions/:id', authorize('admin', 'tpo', 'faculty'), practiceController.deleteQuestion);

router.get('/sheets', authorize('admin', 'tpo', 'faculty'), practiceController.listSheets);
router.post('/sheets', authorize('admin', 'tpo', 'faculty'), practiceController.createSheet);
router.delete('/sheets/:id', authorize('admin', 'tpo', 'faculty'), practiceController.deleteSheet);

router.get('/my-sheets', authorize('candidate'), practiceController.listMySheets);
router.get('/my-sheets/:id/questions', authorize('candidate'), practiceController.getMySheetQuestions);

export default router;
