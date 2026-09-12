import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { AuthProvider } from '@/features/auth/components/AuthProvider';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { NotFound } from '@/pages/NotFound';
import { Forbidden } from '@/pages/Forbidden';
import { Unauthorized } from '@/pages/Unauthorized';
import { Outlet } from 'react-router-dom';

// ── Faculty pages ──────────────────────────────────────────────────────────
const FacultyDashboardPage = lazy(() => import('@/features/faculty-workspace/pages/FacultyDashboardPage').then((m) => ({ default: m.FacultyDashboardPage })));
const FacultyBatchesPage = lazy(() => import('@/features/faculty-workspace/pages/FacultyBatchesPage').then((m) => ({ default: m.FacultyBatchesPage })));
const BatchAttendancePage = lazy(() => import('@/features/attendance/pages/BatchAttendancePage').then((m) => ({ default: m.BatchAttendancePage })));
const MyLeaveRequestsPage = lazy(() => import('@/features/leave-requests/pages/MyLeaveRequestsPage').then((m) => ({ default: m.MyLeaveRequestsPage })));
const FacultyTrainingPlanPage = lazy(() => import('@/features/training-plan/pages/FacultyTrainingPlanPage').then((m) => ({ default: m.FacultyTrainingPlanPage })));
const QuestionBankLandingPage = lazy(() => import('@/features/question-bank/pages/QuestionBankLandingPage').then((m) => ({ default: m.QuestionBankLandingPage })));
const QuestionCapturePage = lazy(() => import('@/features/question-bank/pages/QuestionCapturePage').then((m) => ({ default: m.QuestionCapturePage })));
const PaperGeneratorPage = lazy(() => import('@/features/question-bank/pages/PaperGeneratorPage').then((m) => ({ default: m.PaperGeneratorPage })));
const PaperPreviewPage = lazy(() => import('@/features/question-bank/pages/PaperPreviewPage').then((m) => ({ default: m.PaperPreviewPage })));
const PapersListPage = lazy(() => import('@/features/question-bank/pages/PapersListPage').then((m) => ({ default: m.PapersListPage })));
const WorksheetsPage = lazy(() => import('@/features/worksheet-generator/pages/WorksheetsPage').then((m) => ({ default: m.WorksheetsPage })));
const FacultyProfilePage = lazy(() => import('@/features/faculty-workspace/pages/FacultyProfilePage').then((m) => ({ default: m.FacultyProfilePage })));

// ── TPO pages ──────────────────────────────────────────────────────────────
const TpoDashboardPage = lazy(() => import('@/features/tpo/pages/TpoDashboardPage').then((m) => ({ default: m.TpoDashboardPage })));
const TpoInsightsPage = lazy(() => import('@/features/tpo/pages/TpoInsightsPage').then((m) => ({ default: m.TpoInsightsPage })));
const TpoFacultyPage = lazy(() => import('@/features/tpo/pages/TpoFacultyPage').then((m) => ({ default: m.TpoFacultyPage })));
const TpoLeaveApprovalsPage = lazy(() => import('@/features/leave-requests/pages/TpoLeaveApprovalsPage').then((m) => ({ default: m.TpoLeaveApprovalsPage })));
const TpoTrainingPlanOverviewPage = lazy(() => import('@/features/training-plan/pages/TpoTrainingPlanOverviewPage').then((m) => ({ default: m.TpoTrainingPlanOverviewPage })));
const TpoQuestionBankOverviewPage = lazy(() => import('@/features/question-bank/pages/TpoQuestionBankOverviewPage').then((m) => ({ default: m.TpoQuestionBankOverviewPage })));

// ── Shared ─────────────────────────────────────────────────────────────────
const SettingsPage = lazy(() => import('@/features/auth/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const MessagesPage = lazy(() => import('@/pages/MessagesPage').then((m) => ({ default: m.MessagesPage })));

/** Wraps every route in AuthProvider — needs to be inside the router (it calls useNavigate). */
function RootLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/forbidden', element: <Forbidden /> },
      { path: '/unauthorized', element: <Unauthorized /> },

      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <Navigate to="/faculty" replace /> },

              {
                path: 'faculty',
                element: <ProtectedRoute allowedRoles={['faculty']} />,
                children: [
                  { index: true, element: <FacultyDashboardPage /> },
                  { path: 'batches', element: <FacultyBatchesPage /> },
                  { path: 'attendance/:batch/:track', element: <BatchAttendancePage /> },
                  { path: 'leave-requests', element: <MyLeaveRequestsPage /> },
                  { path: 'training-plan', element: <FacultyTrainingPlanPage /> },
                  { path: 'question-bank', element: <QuestionBankLandingPage /> },
                  { path: 'question-bank/capture', element: <QuestionCapturePage /> },
                  { path: 'question-bank/papers', element: <PapersListPage /> },
                  { path: 'question-bank/papers/generate', element: <PaperGeneratorPage /> },
                  { path: 'question-bank/papers/:id', element: <PaperPreviewPage /> },
                  { path: 'worksheets', element: <WorksheetsPage /> },
                  { path: 'profile', element: <FacultyProfilePage /> },
                ],
              },

              {
                path: 'tpo',
                element: <ProtectedRoute allowedRoles={['tpo', 'admin']} />,
                children: [
                  { index: true, element: <TpoDashboardPage /> },
                  { path: 'insights', element: <TpoInsightsPage /> },
                  { path: 'leave-approvals', element: <TpoLeaveApprovalsPage /> },
                  { path: 'training-plan', element: <TpoTrainingPlanOverviewPage /> },
                  { path: 'question-bank-overview', element: <TpoQuestionBankOverviewPage /> },
                  { path: 'faculty', element: <TpoFacultyPage /> },
                ],
              },

              { path: 'settings', element: <SettingsPage /> },
              { path: 'messages', element: <MessagesPage /> },
            ],
          },
        ],
      },

      { path: '*', element: <NotFound /> },
    ],
  },
]);
