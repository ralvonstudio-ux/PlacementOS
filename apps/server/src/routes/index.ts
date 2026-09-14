import { Router } from 'express';
import { healthController } from '../controllers/health.controller';
import authRoutes from '../features/auth/auth.routes';
import userRoutes from '../features/users/user.routes';
import facultyRoutes from '../features/faculty/faculty.routes';
import instituteRoutes from '../features/institutes/institute.routes';
import candidateRoutes from '../features/candidates/candidate.routes';
import attendanceRoutes from '../features/attendance/attendance.routes';
import leaveRequestRoutes from '../features/leave-requests/leave-request.routes';
import trainingScheduleRoutes from '../features/training-schedule/training-schedule.routes';
import trainingPlanRoutes from '../features/training-plan/training-plan.routes';
import moduleTrackerRoutes from '../features/module-tracker/module-tracker.routes';
import questionBankRoutes from '../features/question-bank/question-bank.routes';
import worksheetGeneratorRoutes from '../features/worksheet-generator/worksheet.routes';
import tpoRoutes from '../features/tpo/tpo.routes';
import tpoAssistantRoutes from '../features/tpo-assistant/tpo-assistant.routes';
import candidateProfileRoutes from '../features/candidate-profile/candidate-profile.routes';
import practiceRoutes from '../features/practice/practice.routes';
import testRoutes from '../features/tests/test.routes';
import notificationRoutes from '../features/notifications/notification.routes';
import importRoutes from '../features/import/import.routes';

const router = Router();

router.get('/health', healthController.check);

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/faculty', facultyRoutes);
router.use('/institutes', instituteRoutes);
router.use('/candidates', candidateRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/leave-requests', leaveRequestRoutes);
router.use('/training-schedule', trainingScheduleRoutes);
router.use('/training-plan', trainingPlanRoutes);
router.use('/module-tracker', moduleTrackerRoutes);
router.use('/question-bank', questionBankRoutes);
router.use('/worksheet-generator', worksheetGeneratorRoutes);
router.use('/tpo', tpoRoutes);
router.use('/tpo-assistant', tpoAssistantRoutes);
router.use('/candidate-profile', candidateProfileRoutes);
router.use('/practice', practiceRoutes);
router.use('/tests', testRoutes);
router.use('/notifications', notificationRoutes);
router.use('/import', importRoutes);

export default router;
