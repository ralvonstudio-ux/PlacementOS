import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { attendanceController } from './attendance.controller';

const router = Router();

router.use(authenticate);

// Writes are restricted to faculty/leadership — per-faculty ownership (a
// faculty member may only mark/view a batch/track they are scheduled to
// teach) is enforced inside attendance.service.ts via
// assertFacultyCanAccessQuestionBank, which no-ops for non-faculty roles.
const canWriteAttendance = authorize('admin', 'tpo', 'faculty');

// Static routes first — must come before /:id to avoid param conflicts
router.post('/bulk', canWriteAttendance, attendanceController.bulkMark);
router.get('/summary', attendanceController.getSummary);
router.get('/batch-overview', authorize('admin', 'tpo'), attendanceController.getBatchOverview);
router.get('/faculty-overview', authorize('admin', 'tpo'), attendanceController.getFacultyOverview);
router.get('/batch/:batch/:track', attendanceController.getBatchAttendance);
router.get('/candidate/:candidateId', attendanceController.getCandidateHistory);

// Generic resource routes
router.post('/', canWriteAttendance, attendanceController.markSingle);
router.get('/', attendanceController.list);
router.get('/:id', attendanceController.getById);
router.patch('/:id', canWriteAttendance, attendanceController.update);
router.delete('/:id', authorize('admin'), attendanceController.deleteRecord);

export default router;
