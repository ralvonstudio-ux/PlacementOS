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
import { useAuth } from '@/features/auth/hooks/useAuth';
import { getHomePathForRole } from '@/features/auth/utils/roleHome';

// ── Faculty pages ──────────────────────────────────────────────────────────
const FacultyDashboardPage = lazy(() => import('@/features/faculty-workspace/pages/FacultyDashboardPage').then((m) => ({ default: m.FacultyDashboardPage })));
const FacultyBatchesPage = lazy(() => import('@/features/faculty-workspace/pages/FacultyBatchesPage').then((m) => ({ default: m.FacultyBatchesPage })));
const FacultyAttendancePage = lazy(() => import('@/features/attendance/pages/FacultyAttendancePage').then((m) => ({ default: m.FacultyAttendancePage })));
const BatchAttendancePage = lazy(() => import('@/features/attendance/pages/BatchAttendancePage').then((m) => ({ default: m.BatchAttendancePage })));
const BatchRosterPage = lazy(() => import('@/features/attendance/pages/BatchRosterPage').then((m) => ({ default: m.BatchRosterPage })));
const AcademicPlanPage = lazy(() => import('@/features/academic-plan/pages/AcademicPlanPage').then((m) => ({ default: m.AcademicPlanPage })));
const MyLeaveRequestsPage = lazy(() => import('@/features/leave-requests/pages/MyLeaveRequestsPage').then((m) => ({ default: m.MyLeaveRequestsPage })));
const QuestionBankLandingPage = lazy(() => import('@/features/question-bank/pages/QuestionBankLandingPage').then((m) => ({ default: m.QuestionBankLandingPage })));
const QuestionCapturePage = lazy(() => import('@/features/question-bank/pages/QuestionCapturePage').then((m) => ({ default: m.QuestionCapturePage })));
const PaperGeneratorPage = lazy(() => import('@/features/question-bank/pages/PaperGeneratorPage').then((m) => ({ default: m.PaperGeneratorPage })));
const PaperPreviewPage = lazy(() => import('@/features/question-bank/pages/PaperPreviewPage').then((m) => ({ default: m.PaperPreviewPage })));
const PapersListPage = lazy(() => import('@/features/question-bank/pages/PapersListPage').then((m) => ({ default: m.PapersListPage })));
const WorksheetsPage = lazy(() => import('@/features/worksheet-generator/pages/WorksheetsPage').then((m) => ({ default: m.WorksheetsPage })));
const FacultyProfilePage = lazy(() => import('@/features/faculty-workspace/pages/FacultyProfilePage').then((m) => ({ default: m.FacultyProfilePage })));
const FacultyTestsPage = lazy(() => import('@/features/tests/pages/TpoTestsPage').then((m) => ({ default: m.TpoTestsPage })));
const FacultyTestBuilderPage = lazy(() => import('@/features/tests/pages/TestBuilderPage').then((m) => ({ default: m.TestBuilderPage })));
const FacultyTestReviewPage = lazy(() => import('@/features/tests/pages/TestReviewPage').then((m) => ({ default: m.TestReviewPage })));

// ── Admin pages ────────────────────────────────────────────────────────────
const AdminDashboardPage = lazy(() => import('@/features/admin/pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })));
const AdminFacultyPage = lazy(() => import('@/features/admin/pages/AdminFacultyPage').then((m) => ({ default: m.AdminFacultyPage })));

// ── Timetable pages (training schedule) ─────────────────────────────────────
const BatchTimetablePage = lazy(() => import('@/features/training-schedule/pages/BatchTimetablePage').then((m) => ({ default: m.BatchTimetablePage })));
const PeriodSetupPage = lazy(() => import('@/features/training-schedule/pages/PeriodSetupPage').then((m) => ({ default: m.PeriodSetupPage })));
const MasterGridPage = lazy(() => import('@/features/training-schedule/pages/MasterGridPage').then((m) => ({ default: m.MasterGridPage })));
const SubstituteWorkspace = lazy(() => import('@/features/training-schedule/pages/SubstituteWorkspace').then((m) => ({ default: m.SubstituteWorkspace })));

// ── Import pages (bulk CSV/Excel upload) ────────────────────────────────────
const ImportDashboard = lazy(() => import('@/features/import/pages/ImportDashboard').then((m) => ({ default: m.ImportDashboard })));
const UploadCenter = lazy(() => import('@/features/import/pages/UploadCenter').then((m) => ({ default: m.UploadCenter })));
const ImportSessionDetail = lazy(() => import('@/features/import/pages/ImportSessionDetail').then((m) => ({ default: m.ImportSessionDetail })));
const ImportHistory = lazy(() => import('@/features/import/pages/ImportHistory').then((m) => ({ default: m.ImportHistory })));

// ── TPO pages ──────────────────────────────────────────────────────────────
const TpoDashboardPage = lazy(() => import('@/features/tpo/pages/TpoDashboardPage').then((m) => ({ default: m.TpoDashboardPage })));
const TpoAttendancePage = lazy(() => import('@/features/tpo/pages/TpoAttendancePage').then((m) => ({ default: m.TpoAttendancePage })));
const TpoInsightsPage = lazy(() => import('@/features/tpo/pages/TpoInsightsPage').then((m) => ({ default: m.TpoInsightsPage })));
const TpoFacultyPage = lazy(() => import('@/features/tpo/pages/TpoFacultyPage').then((m) => ({ default: m.TpoFacultyPage })));
const TpoLeaveApprovalsPage = lazy(() => import('@/features/leave-requests/pages/TpoLeaveApprovalsPage').then((m) => ({ default: m.TpoLeaveApprovalsPage })));
const TpoQuestionBankOverviewPage = lazy(() => import('@/features/question-bank/pages/TpoQuestionBankOverviewPage').then((m) => ({ default: m.TpoQuestionBankOverviewPage })));
const TpoCandidatesPage = lazy(() => import('@/features/candidates/pages/TpoCandidatesPage').then((m) => ({ default: m.TpoCandidatesPage })));
const TpoPracticeLibraryPage = lazy(() => import('@/features/practice/pages/TpoPracticeLibraryPage').then((m) => ({ default: m.TpoPracticeLibraryPage })));
const TpoTestsPage = lazy(() => import('@/features/tests/pages/TpoTestsPage').then((m) => ({ default: m.TpoTestsPage })));
const TestBuilderPage = lazy(() => import('@/features/tests/pages/TestBuilderPage').then((m) => ({ default: m.TestBuilderPage })));
const TestReviewPage = lazy(() => import('@/features/tests/pages/TestReviewPage').then((m) => ({ default: m.TestReviewPage })));

// ── Candidate pages ──────────────────────────────────────────────────────────
const CandidateDashboardPage = lazy(() => import('@/features/candidate-profile/pages/CandidateDashboardPage').then((m) => ({ default: m.CandidateDashboardPage })));
const ResumeBuilderPage = lazy(() => import('@/features/candidate-profile/pages/ResumeBuilderPage').then((m) => ({ default: m.ResumeBuilderPage })));
const PracticeBrowsePage = lazy(() => import('@/features/practice/pages/PracticeBrowsePage').then((m) => ({ default: m.PracticeBrowsePage })));
const CandidatePracticeSheetsPage = lazy(() => import('@/features/practice/pages/CandidatePracticeSheetsPage').then((m) => ({ default: m.CandidatePracticeSheetsPage })));
const TestListPage = lazy(() => import('@/features/tests/pages/TestListPage').then((m) => ({ default: m.TestListPage })));
const TestTakingPage = lazy(() => import('@/features/tests/pages/TestTakingPage').then((m) => ({ default: m.TestTakingPage })));

// ── Shared ─────────────────────────────────────────────────────────────────
const SettingsPage = lazy(() => import('@/features/auth/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const MessagesPage = lazy(() => import('@/features/messages/pages/MessagesPage').then((m) => ({ default: m.MessagesPage })));

/** Wraps every route in AuthProvider — needs to be inside the router (it calls useNavigate). */
function RootLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

/** Sends "/" to whichever workspace actually matches the logged-in user's role, instead of
 *  hardcoding one role and letting everyone else bounce off a role-gated route into Forbidden. */
function RoleHomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? getHomePathForRole(user.role) : '/login'} replace />;
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
              { index: true, element: <RoleHomeRedirect /> },

              {
                path: 'faculty',
                element: <ProtectedRoute allowedRoles={['faculty']} />,
                children: [
                  { index: true, element: <FacultyDashboardPage /> },
                  { path: 'attendance', element: <FacultyAttendancePage /> },
                  { path: 'batches', element: <FacultyBatchesPage /> },
                  { path: 'attendance/:batch/:track', element: <BatchAttendancePage /> },
                  { path: 'attendance/:batch/:track/roster', element: <BatchRosterPage /> },
                  { path: 'leave-requests', element: <MyLeaveRequestsPage /> },
                  { path: 'question-bank', element: <QuestionBankLandingPage /> },
                  { path: 'question-bank/capture', element: <QuestionCapturePage /> },
                  { path: 'question-bank/papers', element: <PapersListPage /> },
                  { path: 'question-bank/papers/generate', element: <PaperGeneratorPage /> },
                  { path: 'question-bank/papers/:id', element: <PaperPreviewPage /> },
                  { path: 'worksheets', element: <WorksheetsPage /> },
                  { path: 'training-plan', element: <AcademicPlanPage /> },
                  { path: 'tests', element: <FacultyTestsPage /> },
                  { path: 'tests/new', element: <FacultyTestBuilderPage /> },
                  { path: 'tests/:id/review', element: <FacultyTestReviewPage /> },
                  { path: 'profile', element: <FacultyProfilePage /> },
                ],
              },

              {
                path: 'admin',
                element: <ProtectedRoute allowedRoles={['admin']} />,
                children: [
                  { index: true, element: <AdminDashboardPage /> },
                  { path: 'faculty', element: <AdminFacultyPage /> },
                  { path: 'candidates', element: <TpoCandidatesPage /> },
                ],
              },

              {
                path: 'tpo',
                element: <ProtectedRoute allowedRoles={['tpo', 'admin']} />,
                children: [
                  { index: true, element: <TpoDashboardPage /> },
                  { path: 'attendance', element: <TpoAttendancePage /> },
                  { path: 'insights', element: <TpoInsightsPage /> },
                  { path: 'leave-approvals', element: <TpoLeaveApprovalsPage /> },
                  { path: 'question-bank-overview', element: <TpoQuestionBankOverviewPage /> },
                  { path: 'timetable', element: <BatchTimetablePage /> },
                  { path: 'timetable/periods', element: <PeriodSetupPage /> },
                  { path: 'timetable/master-grid', element: <MasterGridPage /> },
                  { path: 'timetable/substitutes', element: <SubstituteWorkspace /> },
                  { path: 'import', element: <ImportDashboard /> },
                  { path: 'import/upload', element: <UploadCenter /> },
                  { path: 'import/history', element: <ImportHistory /> },
                  { path: 'import/sessions/:id', element: <ImportSessionDetail /> },
                  { path: 'faculty', element: <TpoFacultyPage /> },
                  { path: 'candidates', element: <TpoCandidatesPage /> },
                  { path: 'practice', element: <TpoPracticeLibraryPage /> },
                  { path: 'tests', element: <TpoTestsPage /> },
                  { path: 'tests/new', element: <TestBuilderPage /> },
                  { path: 'tests/:id/review', element: <TestReviewPage /> },
                ],
              },

              {
                path: 'candidate',
                element: <ProtectedRoute allowedRoles={['candidate']} />,
                children: [
                  { index: true, element: <CandidateDashboardPage /> },
                  { path: 'resume', element: <ResumeBuilderPage /> },
                  { path: 'leetcode', element: <Navigate to="/candidate" replace /> },
                  { path: 'practice/:category', element: <PracticeBrowsePage /> },
                  { path: 'practice-sheets', element: <CandidatePracticeSheetsPage /> },
                  { path: 'tests', element: <TestListPage /> },
                ],
              },

              { path: 'settings', element: <SettingsPage /> },
              { path: 'messages', element: <MessagesPage /> },
            ],
          },
        ],
      },

      // Rendered outside AppLayout, deliberately without sidebar/topbar chrome — the proctored
      // test-taking screen owns the entire viewport for the duration of the attempt.
      {
        element: <ProtectedRoute allowedRoles={['candidate']} />,
        children: [{ path: 'candidate/tests/:testId/attempt', element: <TestTakingPage /> }],
      },

      { path: '*', element: <NotFound /> },
    ],
  },
]);
