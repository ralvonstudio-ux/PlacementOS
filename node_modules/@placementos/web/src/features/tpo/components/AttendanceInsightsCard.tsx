import { useNavigate } from 'react-router-dom';
import { useAttendanceInsights } from '../hooks/useTpo';

// Descriptive-only: lowest-attendance batch/track pairs, sourced from
// GET /tpo/attendance-insights. Unlike the source Principal version (which
// reused a Reports feature's analytics endpoint), this hits a dedicated TPO
// endpoint since PlacementOS has no reports feature built yet.
export function AttendanceInsightsCard() {
  const navigate = useNavigate();
  const { data, isLoading } = useAttendanceInsights();

  const lowest = [...(data ?? [])].filter((r) => r.total > 0).sort((a, b) => a.rate - b.rate).slice(0, 5);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 h-full flex flex-col">
      <h3 className="text-[15px] font-semibold text-[#111827] tracking-tight">Attendance Insights</h3>
      <p className="text-[12px] text-[#6B7280] font-medium mb-3">Batches with the lowest attendance right now</p>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-9 bg-gray-50 rounded-xl animate-pulse" />)}
        </div>
      ) : lowest.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No attendance data yet</p>
      ) : (
        <div className="flex flex-col divide-y divide-black/[0.04]">
          {lowest.map((row) => (
            <button
              key={`${row.batch}-${row.track}`}
              type="button"
              onClick={() => navigate('/tpo/insights')}
              className="flex items-center justify-between py-2 hover:bg-black/[0.02] transition-colors text-left -mx-1 px-1 rounded-lg"
            >
              <span className="text-sm font-medium text-[#374151]">{row.batch} · {row.track}</span>
              <span className={`text-sm font-semibold ${row.rate < 75 ? 'text-[#EF4444]' : 'text-[#111827]'}`}>
                {row.rate}%
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
