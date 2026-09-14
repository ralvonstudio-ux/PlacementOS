import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, CalendarOff, Sparkles, Library, FileCheck2, ShieldCheck } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { ActionCard } from '@/components/ui/ActionCard';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTrainingScheduleList } from '@/features/training-schedule/hooks/useTrainingSchedule';
import { useMyLeaveRequests } from '@/features/leave-requests/hooks/useLeaveRequests';

function todayDayOfWeek(): number {
  const jsDay = new Date().getDay(); // 0=Sun..6=Sat
  return jsDay === 0 ? 7 : jsDay; // Sunday never matches a 1-6 schedule entry
}

export function FacultyDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: entries = [], isLoading } = useTrainingScheduleList();
  const { data: leaveRequests = [] } = useMyLeaveRequests();

  const todaysSessions = entries
    .filter((e) => e.dayOfWeek === todayDayOfWeek())
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const pendingLeaveCount = leaveRequests.filter((r) => r.status === 'pending').length;

  return (
    <PageContainer>
      <WorkspaceHeader
        title={`Welcome back${user ? `, ${user.firstName}` : ''}`}
        subtitle="Here's what's on today"
      />

      <div className="mb-10">
        <SectionTitle subtitle="Sessions scheduled for you today, per Training Schedule">Today's Sessions</SectionTitle>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : todaysSessions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center text-sm text-gray-400">
            No sessions scheduled for you today.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {todaysSessions.map((s) => (
              <div key={s._id} className="flex items-center gap-4 px-5 py-4">
                <div className="text-sm font-semibold text-gray-700 w-24 shrink-0">{s.startTime}–{s.endTime}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{s.batch}</p>
                  <p className="text-xs text-gray-500">{s.track}{s.room ? ` · ${s.room}` : ''}</p>
                </div>
                <button
                  onClick={() => navigate(`/faculty/attendance/${encodeURIComponent(s.batch)}/${encodeURIComponent(s.track)}`)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-violet-600 hover:bg-violet-700 text-xs font-semibold text-white transition-colors shrink-0"
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  Mark Attendance
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <SectionTitle>Quick Actions</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ActionCard
          icon={ClipboardCheck}
          title="My Batches"
          description="View your batches and mark attendance"
          accent="blue"
          onClick={() => navigate('/faculty/batches')}
        />
        <ActionCard
          icon={Sparkles}
          title="Academic Plan"
          description="Put in the syllabus, get a week-by-week plan"
          accent="purple"
          onClick={() => navigate('/faculty/academic-plan')}
        />
        <ActionCard
          icon={Library}
          title="Question Bank"
          description="Capture material and build papers"
          accent="indigo"
          onClick={() => navigate('/faculty/question-bank')}
        />
        <ActionCard
          icon={FileCheck2}
          title="Worksheets"
          description="Generate a practice worksheet"
          accent="emerald"
          onClick={() => navigate('/faculty/worksheets')}
        />
        <ActionCard
          icon={ShieldCheck}
          title="Tests"
          description="AI-draft a test and send it for approval"
          accent="blue"
          onClick={() => navigate('/faculty/tests')}
        />
        <ActionCard
          icon={CalendarOff}
          title="Leave Requests"
          description="Apply for leave or check status"
          accent="amber"
          badge={pendingLeaveCount > 0 ? `${pendingLeaveCount} pending` : undefined}
          onClick={() => navigate('/faculty/leave-requests')}
        />
      </div>
    </PageContainer>
  );
}
