import { ClipboardList, X } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTpoPlanOverview, usePlanAlerts, useResolvePlanAlert } from '../hooks/useTrainingPlan';

const SEVERITY_CLASSES: Record<string, string> = {
  critical: 'bg-red-50 border-red-100 text-red-700',
  warning: 'bg-amber-50 border-amber-100 text-amber-700',
  info: 'bg-violet-50 border-violet-100 text-violet-700',
};

export function TpoTrainingPlanOverviewPage() {
  const { data: overview = [], isLoading } = useTpoPlanOverview();
  const { data: alerts = [] } = usePlanAlerts();
  const { mutate: resolveAlert } = useResolvePlanAlert();

  return (
    <PageContainer>
      <WorkspaceHeader title="Training Plan Overview" subtitle="Read-only view of every faculty member's weekly training plan" />

      {alerts.length > 0 && (
        <div className="mb-8 space-y-2">
          <SectionTitle>Alerts</SectionTitle>
          {alerts.map((alert) => (
            <div key={alert._id} className={`flex items-start justify-between gap-3 px-4 py-3 rounded-xl border ${SEVERITY_CLASSES[alert.severity] ?? SEVERITY_CLASSES.info}`}>
              <p className="text-sm font-medium">{alert.message}</p>
              <button onClick={() => resolveAlert(alert._id)} className="p-1 rounded-lg hover:bg-black/5 transition-colors shrink-0" aria-label="Dismiss">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <SectionTitle>By Trainer</SectionTitle>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}
          </div>
        ) : overview.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No training plans yet" description="Plans will appear here once faculty start generating them." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-5 py-3">Trainer</th>
                  <th className="px-5 py-3">Batch</th>
                  <th className="px-5 py-3">Track</th>
                  <th className="px-5 py-3 text-right">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {overview.map((row) => {
                  const pct = row.totalDays > 0 ? Math.round((row.completedDays / row.totalDays) * 100) : 0;
                  return (
                    <tr key={`${row.facultyId}-${row.batch}-${row.track}`}>
                      <td className="px-5 py-3 font-medium text-gray-900 whitespace-nowrap">{row.facultyName}</td>
                      <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{row.batch}</td>
                      <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{row.track}</td>
                      <td className="px-5 py-3 text-right text-gray-500 whitespace-nowrap">
                        {row.completedDays}/{row.totalDays} days ({pct}%)
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
