import { Router } from 'express';
import { trainingScheduleController } from './training-schedule.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();

router.use(authenticate);

// ── Period slots (bell schedule) ────────────────────────────────────────────
router.get('/periods', trainingScheduleController.listPeriods);
router.post('/periods', authorize('admin', 'tpo'), trainingScheduleController.createPeriod);
router.patch('/periods/reorder', authorize('admin', 'tpo'), trainingScheduleController.reorderPeriods);
router.patch('/periods/:id', authorize('admin', 'tpo'), trainingScheduleController.updatePeriod);
router.delete('/periods/:id', authorize('admin', 'tpo'), trainingScheduleController.removePeriod);

// ── Conflicts & master grid ─────────────────────────────────────────────────
router.get('/conflicts', authorize('admin', 'tpo'), trainingScheduleController.conflicts);
router.get('/master-grid', authorize('admin', 'tpo'), trainingScheduleController.masterGrid);
router.patch('/master-grid/cell', authorize('admin', 'tpo'), trainingScheduleController.setMasterGridCell);

// ── Substitutes ──────────────────────────────────────────────────────────────
router.get('/substitutes/needed', authorize('admin', 'tpo'), trainingScheduleController.needsSubstitute);
router.get('/substitutes/suggest-teachers', authorize('admin', 'tpo'), trainingScheduleController.suggestSubstituteTeachers);
router.get('/substitutes', authorize('admin', 'tpo'), trainingScheduleController.listSubstitutes);
router.post('/substitutes', authorize('admin', 'tpo'), trainingScheduleController.createSubstitute);
router.patch('/substitutes/:id', authorize('admin', 'tpo'), trainingScheduleController.updateSubstitute);
router.delete('/substitutes/:id', authorize('admin', 'tpo'), trainingScheduleController.removeSubstitute);

// ── Entries (existing) ──────────────────────────────────────────────────────
router.get('/', trainingScheduleController.list);
router.get('/:id', trainingScheduleController.getById);
router.post('/', authorize('admin', 'tpo'), trainingScheduleController.create);
router.patch('/:id', authorize('admin', 'tpo'), trainingScheduleController.update);
router.delete('/:id', authorize('admin', 'tpo'), trainingScheduleController.remove);

export default router;
