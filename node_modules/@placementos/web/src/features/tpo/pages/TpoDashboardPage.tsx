import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, GraduationCap, CalendarClock, ClipboardList, Sparkles, Loader2 } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { useTpoDashboard, useBriefingSummary } from '../hooks/useTpo';
import { AttendanceWidget } from '../components/AttendanceWidget';
import { AlertsPanel } from '../components/AlertsPanel';
import { AttendanceInsightsCard } from '../components/AttendanceInsightsCard';
import { extractErrorMessage } from '@/services/api';

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

export function TpoDashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useTpoDashboard();
  const { mutateAsync: getBriefing, isPending: isBriefing } = useBriefingSummary();
  const [briefing, setBriefing] = useState<string | null>(null);
  const [briefingError, setBriefingError] = useState('');

  async function handleBriefing() {
    setBriefingError('');
    try {
      const result = await getBriefing();
      setBriefing(result.summary);
    } catch (err) {
      setBriefingError(extractErrorMessage(err));
    }
  }

  return (
    <PageContainer>
      <WorkspaceHeader
        title="TPO Dashboard"
        subtitle="Training & Placement Cell — live overview"
        action={
          <button
            onClick={handleBriefing}
            disabled={isBriefing}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50"
          >
            {isBriefing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Summarize with AI
          </button>
        }
      />

      {(briefing || briefingError) && (
        <div className={`mb-8 rounded-2xl border p-4 ${briefingError ? 'bg-red-50 border-red-100' : 'bg-violet-50 border-violet-100'}`}>
          <p className={`text-sm ${briefingError ? 'text-red-600' : 'text-violet-800'}`}>{briefingError || briefing}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-8">
        <StatCard icon={GraduationCap} label="Candidates" value={data?.candidates.total ?? '—'} sub={data ? `${data.candidates.placed} placed` : undefined} accent="bg-blue-50 text-blue-600" />
        <StatCard icon={Users} label="Faculty" value={data?.faculty.total ?? '—'} sub={data ? `${data.faculty.active} active` : undefined} accent="bg-purple-50 text-purple-600" />
        <StatCard icon={CalendarClock} label="Training Schedule" value={data?.trainingSchedule.published ?? '—'} sub="sessions scheduled" accent="bg-emerald-50 text-emerald-600" />
        <StatCard
          icon={ClipboardList}
          label="Pending Leave"
          value={data?.pendingLeaveRequests ?? '—'}
          sub={data && data.pendingLeaveRequests > 0 ? 'awaiting review' : undefined}
          accent="bg-amber-50 text-amber-600"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <SectionTitle subtitle="Candidate attendance across the whole institute">Attendance Today</SectionTitle>
            <AttendanceWidget data={data?.attendance} isLoading={isLoading} />
          </div>

          <div>
            <SectionTitle
              subtitle="Things that need your attention"
              trailing={
                data && data.pendingLeaveRequests > 0 ? (
                  <button onClick={() => navigate('/tpo/leave-approvals')} className="text-violet-600 hover:text-violet-700 font-medium">
                    Review leave requests →
                  </button>
                ) : undefined
              }
            >
              Alerts
            </SectionTitle>
            <AlertsPanel alerts={data?.alerts ?? []} isLoading={isLoading} />
          </div>
        </div>

        <AttendanceInsightsCard />
      </div>
    </PageContainer>
  );
}
