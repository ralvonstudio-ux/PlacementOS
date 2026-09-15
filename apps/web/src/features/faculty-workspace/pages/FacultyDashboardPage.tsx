import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck, Sparkles, Library, FileCheck2, CalendarOff, ShieldCheck, ChevronRight,
} from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTrainingScheduleList } from '@/features/training-schedule/hooks/useTrainingSchedule';
import { useMyLeaveRequests } from '@/features/leave-requests/hooks/useLeaveRequests';
import { LeaveStatusBadge } from '@/features/leave-requests/components/LeaveStatusBadge';

function todayDayOfWeek(): number {
  const jsDay = new Date().getDay(); // 0=Sun..6=Sat
  return jsDay === 0 ? 7 : jsDay; // Sunday never matches a 1-6 schedule entry
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatToday(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatRange(from: string, to: string): string {
  return from === to ? from : `${from} → ${to}`;
}

interface QuickLink {
  icon: typeof ClipboardCheck;
  title: string;
  subtitle: string;
  onClick: () => void;
  badge?: number;
}

function ListRow({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left hover:shadow-md hover:-translate-y-0.5 transition-all"
    >
      {children}
      <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
    </button>
  );
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
  const recentLeave = useMemo(
    () => [...leaveRequests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 2),
    [leaveRequests]
  );

  const quickLinks: QuickLink[] = [
    { icon: ClipboardCheck, title: 'My Batches', subtitle: 'View your batches and mark attendance', onClick: () => navigate('/faculty/batches') },
    { icon: Sparkles, title: 'Training Plan', subtitle: 'Your day-by-day teaching plan', onClick: () => navigate('/faculty/training-plan') },
    { icon: Library, title: 'Question Bank & Papers', subtitle: 'Capture material and build papers', onClick: () => navigate('/faculty/question-bank') },
    { icon: FileCheck2, title: 'Worksheet Generator', subtitle: 'One-click practice, homework & more', onClick: () => navigate('/faculty/worksheets') },
    { icon: ShieldCheck, title: 'Tests', subtitle: 'AI-draft a test and send it for approval', onClick: () => navigate('/faculty/tests') },
    { icon: CalendarOff, title: 'Leave Requests', subtitle: 'Apply for leave or check status', onClick: () => navigate('/faculty/leave-requests'), badge: pendingLeaveCount },
  ];

  return (
    <PageContainer className="pb-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-pink-500 text-white p-6 mb-6 shadow-lg shadow-violet-500/25">
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute right-8 -bottom-12 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
        <div className="relative">
          <p className="text-sm text-white/80">{greeting()},</p>
          <h1 className="text-3xl font-bold mt-0.5 leading-tight">{user?.firstName ?? 'there'}</h1>
          <p className="text-sm text-white/70 mt-1">{formatToday()}</p>
          <button
            type="button"
            onClick={() => navigate('/faculty/attendance')}
            className="mt-5 inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-white text-violet-700 text-sm font-bold shadow-sm hover:bg-white/90 transition-colors"
          >
            <ClipboardCheck className="w-4 h-4" /> Mark Attendance
          </button>
        </div>
      </div>

      {/* Today's classes */}
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Today&apos;s Classes</p>
      {isLoading ? (
        <div className="space-y-2 mb-6">
          {[1, 2].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : todaysSessions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center text-sm text-gray-400 mb-6">
          No sessions scheduled for you today.
        </div>
      ) : (
        <div className="space-y-2 mb-6">
          {todaysSessions.map((s) => (
            <ListRow key={s._id} onClick={() => navigate(`/faculty/attendance/${encodeURIComponent(s.batch)}/${encodeURIComponent(s.track)}`)}>
              <div className="text-xs font-semibold text-gray-400 w-[74px] shrink-0">{s.startTime}–{s.endTime}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{s.track}</p>
                <span className="inline-block mt-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-violet-50 text-violet-600">{s.batch}</span>
              </div>
            </ListRow>
          ))}
        </div>
      )}

      {/* Quick links */}
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Quick Actions</p>
      <div className="space-y-2 mb-6">
        {quickLinks.map((l) => (
          <ListRow key={l.title} onClick={l.onClick}>
            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
              <l.icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900">{l.title}</p>
              <p className="text-xs text-gray-400 truncate">{l.subtitle}</p>
            </div>
            {!!l.badge && <span className="w-2 h-2 rounded-full bg-pink-500 shrink-0" aria-label={`${l.badge} pending`} />}
          </ListRow>
        ))}
      </div>

      {/* My Leave */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">My Leave</p>
        <button
          type="button"
          onClick={() => navigate('/faculty/leave-requests')}
          className="text-xs font-semibold text-violet-600 hover:text-violet-700"
        >
          Apply for leave
        </button>
      </div>
      {recentLeave.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center text-sm text-gray-400">
          No leave requests yet.
        </div>
      ) : (
        <div className="space-y-2">
          {recentLeave.map((r) => (
            <div key={r._id} className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{formatRange(r.fromDate, r.toDate)}</p>
                <p className="text-xs text-gray-400 truncate">{r.reason}</p>
              </div>
              <LeaveStatusBadge status={r.status} />
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
