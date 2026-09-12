import { useNavigate } from 'react-router-dom';
import { BookOpen, ClipboardCheck } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTrainingScheduleList } from '@/features/training-schedule/hooks/useTrainingSchedule';

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function FacultyBatchesPage() {
  const navigate = useNavigate();
  const { data: entries = [], isLoading } = useTrainingScheduleList();

  const byBatchTrack = new Map<string, { batch: string; track: string; sessions: typeof entries }>();
  for (const entry of entries) {
    const key = `${entry.batch}::${entry.track}`;
    if (!byBatchTrack.has(key)) byBatchTrack.set(key, { batch: entry.batch, track: entry.track, sessions: [] });
    byBatchTrack.get(key)!.sessions.push(entry);
  }
  const batches = [...byBatchTrack.values()].sort((a, b) => a.batch.localeCompare(b.batch, undefined, { numeric: true }));

  return (
    <PageContainer>
      <WorkspaceHeader title="My Batches" subtitle="Every batch/track you're scheduled to train, per Training Schedule" />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : batches.length === 0 ? (
        <EmptyState icon={BookOpen} title="No batches assigned yet" description="Ask your TPO to add you to a Training Schedule entry." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {batches.map((b) => (
            <div key={`${b.batch}-${b.track}`} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-base font-semibold text-gray-900">{b.batch}</p>
                  <p className="text-sm text-gray-500">{b.track}</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-4 h-4 text-violet-600" />
                </div>
              </div>

              <div className="mt-4 flex-1 space-y-1">
                {b.sessions
                  .sort((s1, s2) => s1.dayOfWeek - s2.dayOfWeek)
                  .map((s) => (
                    <p key={s._id} className="text-xs text-gray-500">
                      {DAY_NAMES[s.dayOfWeek]} · {s.startTime}–{s.endTime}{s.room ? ` · ${s.room}` : ''}
                    </p>
                  ))}
              </div>

              <button
                onClick={() => navigate(`/faculty/attendance/${encodeURIComponent(b.batch)}/${encodeURIComponent(b.track)}`)}
                className="mt-4 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-xs font-semibold text-white transition-colors"
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                Mark Attendance
              </button>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
