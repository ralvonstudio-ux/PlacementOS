import { TrendingDown } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAttendanceInsights } from '../hooks/useTpo';

export function TpoInsightsPage() {
  const { data = [], isLoading } = useAttendanceInsights();
  const sorted = [...data].sort((a, b) => a.rate - b.rate);

  return (
    <PageContainer>
      <WorkspaceHeader title="Attendance Insights" subtitle="Per-batch/track attendance rate over the last 7 days, lowest first" />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState icon={TrendingDown} title="No attendance data yet" description="Insights will appear once faculty start marking attendance." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-5 py-3">Batch</th>
                  <th className="px-5 py-3">Track</th>
                  <th className="px-5 py-3 text-right">Records</th>
                  <th className="px-5 py-3 text-right">Attendance Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorted.map((row) => (
                  <tr key={`${row.batch}-${row.track}`}>
                    <td className="px-5 py-3 font-medium text-gray-900 whitespace-nowrap">{row.batch}</td>
                    <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{row.track}</td>
                    <td className="px-5 py-3 text-right text-gray-500">{row.total}</td>
                    <td className={`px-5 py-3 text-right font-semibold ${row.rate < 75 ? 'text-red-600' : row.rate < 85 ? 'text-amber-600' : 'text-green-600'}`}>
                      {row.rate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
