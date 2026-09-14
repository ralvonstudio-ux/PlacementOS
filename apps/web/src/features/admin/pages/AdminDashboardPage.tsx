import { useNavigate } from 'react-router-dom';
import { Users, KeyRound, BookOpen, Users2, ArrowRight, LayoutGrid, CalendarClock, Upload } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { useAdminFacultyList } from '../hooks/useAdminFaculty';

function StatCard({ icon: Icon, label, value, sub, accent }: { icon: typeof Users; label: string; value: string | number; sub?: string; accent: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function QuickLink({ icon: Icon, title, description, onClick }: { icon: typeof Users; title: string; description: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-left hover:border-violet-200 hover:shadow-md transition-all"
    >
      <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-gray-300 shrink-0" />
    </button>
  );
}

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useAdminFacultyList({ limit: 100 });
  const faculty = data?.data ?? [];

  const activeCount = faculty.filter((f) => f.employmentStatus === 'active').length;
  const withLoginCount = faculty.filter((f) => !!f.loginEmail).length;
  const unassignedCount = faculty.filter((f) => f.assignedBatches.length === 0 && f.tracks.length === 0).length;

  return (
    <PageContainer>
      <WorkspaceHeader title="Admin Dashboard" subtitle="Manage teacher accounts and trainer assignments" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Users} label="Total Faculty" value={isLoading ? '—' : faculty.length} accent="bg-violet-50 text-violet-600" />
        <StatCard icon={Users} label="Active" value={isLoading ? '—' : activeCount} accent="bg-green-50 text-green-600" />
        <StatCard icon={KeyRound} label="With Login" value={isLoading ? '—' : withLoginCount} sub={!isLoading ? `${faculty.length - withLoginCount} pending` : undefined} accent="bg-blue-50 text-blue-600" />
        <StatCard icon={BookOpen} label="Unassigned" value={isLoading ? '—' : unassignedCount} sub="No batch or track yet" accent="bg-amber-50 text-amber-600" />
      </div>

      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Quick Actions</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <QuickLink
          icon={Users}
          title="Manage Faculty"
          description="Create teacher accounts, and assign trainers to their batches and tracks"
          onClick={() => navigate('/admin/faculty')}
        />
        <QuickLink
          icon={Users2}
          title="Manage Candidates"
          description="Create and manage student portal logins"
          onClick={() => navigate('/admin/candidates')}
        />
        <QuickLink
          icon={CalendarClock}
          title="Timetable"
          description="Weekly schedule, master grid, and substitute coverage"
          onClick={() => navigate('/tpo/timetable')}
        />
        <QuickLink
          icon={Upload}
          title="Data Import"
          description="Bulk-import faculty, candidates, or the training schedule from a spreadsheet"
          onClick={() => navigate('/tpo/import')}
        />
        <QuickLink
          icon={LayoutGrid}
          title="Full TPO Workspace"
          description="Insights, leave approvals, training plan, tests, and more"
          onClick={() => navigate('/tpo')}
        />
      </div>
    </PageContainer>
  );
}
