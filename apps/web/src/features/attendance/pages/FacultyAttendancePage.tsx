import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, ChevronRight } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTrainingScheduleList } from '@/features/training-schedule/hooks/useTrainingSchedule';

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function todayDayOfWeek(): number {
  // Training-schedule dayOfWeek is 1 (Mon) – 6 (Sat); Date#getDay() is 0 (Sun) – 6 (Sat).
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

/** Dedicated entry point for taking attendance — separate from "My Batches" (which is
 *  about browsing the weekly schedule) so it's a one-tap action from the sidebar,
 *  the way faculty actually use it day to day, especially on a phone between classes. */
export function FacultyAttendancePage() {
  const navigate = useNavigate();
  const { data: entries = [], isLoading } = useTrainingScheduleList();
  const today = todayDayOfWeek();

  const byBatchTrack = new Map<string, { batch: string; track: string; sessions: typeof entries }>();
  for (const entry of entries) {
    const key = `${entry.batch}::${entry.track}`;
    if (!byBatchTrack.has(key)) byBatchTrack.set(key, { batch: entry.batch, track: entry.track, sessions: [] });
    byBatchTrack.get(key)!.sessions.push(entry);
  }
  const batches = [...byBatchTrack.values()].sort((a, b) => {
    const aToday = a.sessions.some((s) => s.dayOfWeek === today);
    const bToday = b.sessions.some((s) => s.dayOfWeek === today);
    if (aToday !== bToday) return aToday ? -1 : 1;
    return a.batch.localeCompare(b.batch, undefined, { numeric: true });
  });

  return (
    <PageContainer>
      <WorkspaceHeader title="Attendance" subtitle="Pick a batch to take today's attendance — today's sessions are shown first" />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : batches.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No batches assigned yet" description="Ask your TPO to add you to a Training Schedule entry." />
      ) : (
        <div className="space-y-3">
          {batches.map((b) => {
            const isToday = b.sessions.some((s) => s.dayOfWeek === today);
            return (
              <button
                key={`${b.batch}-${b.track}`}
                onClick={() => navigate(`/faculty/attendance/${encodeURIComponent(b.batch)}/${encodeURIComponent(b.track)}`)}
                className="w-full flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 text-left hover:border-violet-200 hover:shadow-md transition-all active:scale-[0.99]"
              >
                <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                  <ClipboardCheck className="w-5 h-5 text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-base font-semibold text-gray-900">{b.batch}</p>
                    <span className="text-sm text-gray-400">·</span>
                    <p className="text-sm text-gray-500">{b.track}</p>
                    {isToday && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                        Today
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {b.sessions
                      .sort((s1, s2) => s1.dayOfWeek - s2.dayOfWeek)
                      .map((s) => `${DAY_NAMES[s.dayOfWeek]} ${s.startTime}`)
                      .join(' · ')}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
