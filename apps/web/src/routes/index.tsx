import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazyWithReload } from '@/lib/lazyWithReload';
import { RouteErrorBoundary } from './RouteErrorBoundary';
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
const FacultyDashboardPage = lazyWithReload(() => import('@/features/faculty-workspace/pages/FacultyDashboardPage').then((m) => ({ default: m.FacultyDashboardPage })), 'FacultyDashboardPage');
const FacultyBatchesPage = lazyWithReload(() => import('@/features/faculty-workspace/pages/FacultyBatchesPage').then((m) => ({ default: m.FacultyBatchesPage })), 'FacultyBatchesPage');
const FacultyAttendancePage = lazyWithReload(() => import('@/features/attendance/pages/FacultyAttendancePage').then((m) => ({ default: m.FacultyAttendancePage })), 'FacultyAttendancePage');
const BatchAttendancePage = lazyWithReload(() => import('@/features/attendance/pages/BatchAttendancePage').then((m) => ({ default: m.BatchAttendancePage })), 'BatchAttendancePage');
const BatchRosterPage = lazyWithReload(() => import('@/features/attendance/pages/BatchRosterPage').then((m) => ({ default: m.BatchRosterPage })), 'BatchRosterPage');
const AcademicPlanPage = lazyWithReload(() => import('@/features/academic-plan/pages/AcademicPlanPage').then((m) => ({ default: m.AcademicPlanPage })), 'AcademicPlanPage');
const MyLeaveRequestsPage = lazyWithReload(() => import('@/features/leave-requests/pages/MyLeaveRequestsPage').then((m) => ({ default: m.MyLeaveRequestsPage })), 'MyLeaveRequestsPage');
const QuestionBankLandingPage = lazyWithReload(() => import('@/features/question-bank/pages/QuestionBankLandingPage').then((m) => ({ default: m.QuestionBankLandingPage })), 'QuestionBankLandingPage');
const QuestionCapturePage = lazyWithReload(() => import('@/features/question-bank/pages/QuestionCapturePage').then((m) => ({ default: m.QuestionCapturePage })), 'QuestionCapturePage');
const PaperGeneratorPage = lazyWithReload(() => import('@/features/question-bank/pages/PaperGeneratorPage').then((m) => ({ default: m.PaperGeneratorPage })), 'PaperGeneratorPage');
const PaperPreviewPage = lazyWithReload(() => import('@/features/question-bank/pages/PaperPreviewPage').then((m) => ({ default: m.PaperPreviewPage })), 'PaperPreviewPage');
const PapersListPage = lazyWithReload(() => import('@/features/question-bank/pages/PapersListPage').then((m) => ({ default: m.PapersListPage })), 'PapersListPage');
const WorksheetsPage = lazyWithReload(() => import('@/features/worksheet-generator/pages/WorksheetsPage').then((m) => ({ default: m.WorksheetsPage })), 'WorksheetsPage');
const WorksheetDetailPage = lazyWithReload(() => import('@/features/worksheet-generator/pages/WorksheetDetailPage').then((m) => ({ default: m.WorksheetDetailPage })), 'WorksheetDetailPage');
const FacultyProfilePage = lazyWithReload(() => import('@/features/faculty-workspace/pages/FacultyProfilePage').then((m) => ({ default: m.FacultyProfilePage })), 'FacultyProfilePage');
const FacultyTestsPage = lazyWithReload(() => import('@/features/tests/pages/TpoTestsPage').then((m) => ({ default: m.TpoTestsPage })), 'TpoTestsPage');
const FacultyTestBuilderPage = lazyWithReload(() => import('@/features/tests/pages/TestBuilderPage').then((m) => ({ default: m.TestBuilderPage })), 'TestBuilderPage');
const FacultyTestReviewPage = lazyWithReload(() => import('@/features/tests/pages/TestReviewPage').then((m) => ({ default: m.TestReviewPage })), 'TestReviewPage');

// ── Admin pages ────────────────────────────────────────────────────────────
const AdminDashboardPage = lazyWithReload(() => import('@/features/admin/pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })), 'AdminDashboardPage');
const AdminFacultyPage = lazyWithReload(() => import('@/features/admin/pages/AdminFacultyPage').then((m) => ({ default: m.AdminFacultyPage })), 'AdminFacultyPage');

// ── Timetable pages (training schedule) ─────────────────────────────────────
const BatchTimetablePage = lazyWithReload(() => import('@/features/training-schedule/pages/BatchTimetablePage').then((m) => ({ default: m.BatchTimetablePage })), 'BatchTimetablePage');
const PeriodSetupPage = lazyWithReload(() => import('@/features/training-schedule/pages/PeriodSetupPage').then((m) => ({ default: m.PeriodSetupPage })), 'PeriodSetupPage');
const MasterGridPage = lazyWithReload(() => import('@/features/training-schedule/pages/MasterGridPage').then((m) => ({ default: m.MasterGridPage })), 'MasterGridPage');
const SubstituteWorkspace = lazyWithReload(() => import('@/features/training-schedule/pages/SubstituteWorkspace').then((m) => ({ default: m.SubstituteWorkspace })), 'SubstituteWorkspace');

// ── Import pages (bulk CSV/Excel upload) ────────────────────────────────────
const ImportDashboard = lazyWithReload(() => import('@/features/import/pages/ImportDashboard').then((m) => ({ default: m.ImportDashboard })), 'ImportDashboard');
const UploadCenter = lazyWithReload(() => import('@/features/import/pages/UploadCenter').then((m) => ({ default: m.UploadCenter })), 'UploadCenter');
const ImportSessionDetail = lazyWithReload(() => import('@/features/import/pages/ImportSessionDetail').then((m) => ({ default: m.ImportSessionDetail })), 'ImportSessionDetail');
const ImportHistory = lazyWithReload(() => import('@/features/import/pages/ImportHistory').then((m) => ({ default: m.ImportHistory })), 'ImportHistory');

// ── TPO pages ──────────────────────────────────────────────────────────────
const TpoDashboardPage = lazyWithReload(() => import('@/features/tpo/pages/TpoDashboardPage').then((m) => ({ default: m.TpoDashboardPage })), 'TpoDashboardPage');
const TpoAttendancePage = lazyWithReload(() => import('@/features/tpo/pages/TpoAttendancePage').then((m) => ({ default: m.TpoAttendancePage })), 'TpoAttendancePage');
const TpoInsightsPage = lazyWithReload(() => import('@/features/tpo/pages/TpoInsightsPage').then((m) => ({ default: m.TpoInsightsPage })), 'TpoInsightsPage');
const TpoFacultyPage = lazyWithReload(() => import('@/features/tpo/pages/TpoFacultyPage').then((m) => ({ default: m.TpoFacultyPage })), 'TpoFacultyPage');
const TpoLeaveApprovalsPage = lazyWithReload(() => import('@/features/leave-requests/pages/TpoLeaveApprovalsPage').then((m) => ({ default: m.TpoLeaveApprovalsPage })), 'TpoLeaveApprovalsPage');
const TpoQuestionBankOverviewPage = lazyWithReload(() => import('@/features/question-bank/pages/TpoQuestionBankOverviewPage').then((m) => ({ default: m.TpoQuestionBankOverviewPage })), 'TpoQuestionBankOverviewPage');
const TpoCandidatesPage = lazyWithReload(() => import('@/features/candidates/pages/TpoCandidatesPage').then((m) => ({ default: m.TpoCandidatesPage })), 'TpoCandidatesPage');
const TpoPracticeLibraryPage = lazyWithReload(() => import('@/features/practice/pages/TpoPracticeLibraryPage').then((m) => ({ default: m.TpoPracticeLibraryPage })), 'TpoPracticeLibraryPage');
const TpoTestsPage = lazyWithReload(() => import('@/features/tests/pages/TpoTestsPage').then((m) => ({ default: m.TpoTestsPage })), 'TpoTestsPage');
const TestBuilderPage = lazyWithReload(() => import('@/features/tests/pages/TestBuilderPage').then((m) => ({ default: m.TestBuilderPage })), 'TestBuilderPage');
const TestReviewPage = lazyWithReload(() => import('@/features/tests/pages/TestReviewPage').then((m) => ({ default: m.TestReviewPage })), 'TestReviewPage');

// ── Candidate pages ──────────────────────────────────────────────────────────
const CandidateDashboardPage = lazyWithReload(() => import('@/features/candidate-profile/pages/CandidateDashboardPage').then((m) => ({ default: m.CandidateDashboardPage })), 'CandidateDashboardPage');
const ResumeBuilderPage = lazyWithReload(() => import('@/features/candidate-profile/pages/ResumeBuilderPage').then((m) => ({ default: m.ResumeBuilderPage })), 'ResumeBuilderPage');
const PracticeBrowsePage = lazyWithReload(() => import('@/features/practice/pages/PracticeBrowsePage').then((m) => ({ default: m.PracticeBrowsePage })), 'PracticeBrowsePage');
const CandidatePracticeSheetsPage = lazyWithReload(() => import('@/features/practice/pages/CandidatePracticeSheetsPage').then((m) => ({ default: m.CandidatePracticeSheetsPage })), 'CandidatePracticeSheetsPage');
const CandidateWorksheetsPage = lazyWithReload(() => import('@/features/worksheet-generator/pages/CandidateWorksheetsPage').then((m) => ({ default: m.CandidateWorksheetsPage })), 'CandidateWorksheetsPage');
const TestListPage = lazyWithReload(() => import('@/features/tests/pages/TestListPage').then((m) => ({ default: m.TestListPage })), 'TestListPage');
const TestTakingPage = lazyWithReload(() => import('@/features/tests/pages/TestTakingPage').then((m) => ({ default: m.TestTakingPage })), 'TestTakingPage');

// ── Shared ─────────────────────────────────────────────────────────────────
const SettingsPage = lazyWithReload(() => import('@/features/auth/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })), 'SettingsPage');
const MessagesPage = lazyWithReload(() => import('@/features/messages/pages/MessagesPage').then((m) => ({ default: m.MessagesPage })), 'MessagesPage');

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
    errorElement: <RouteErrorBoundary />,
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
                  { path: 'worksheets/:id', element: <WorksheetDetailPage /> },
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
                  { path: 'worksheets', element: <CandidateWorksheetsPage /> },
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
