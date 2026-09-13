import { useState } from 'react';
import { UserCog, Check, X as XIcon } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useNeedsSubstitute, useSubstitutes, useCreateSubstitute, useUpdateSubstitute } from '../hooks/useTrainingSchedule';
import { trainingScheduleApi } from '../api/training-schedule.api';
import { useQuery } from '@tanstack/react-query';
import { extractErrorMessage } from '@/services/api';
import { toast } from 'sonner';
import type { NeedsSubstituteEntry } from '@placementos/types';

const todayIso = () => new Date().toISOString().slice(0, 10);

function SubstitutePicker({ entry, onAssigned }: { entry: NeedsSubstituteEntry; onAssigned: () => void }) {
  const { data: suggestions = [] } = useQuery({
    queryKey: ['substitute-suggestions', entry.entry.track, entry.entry.dayOfWeek, entry.entry.facultyId],
    queryFn: () => trainingScheduleApi.suggestSubstituteTeachers(entry.entry.track, entry.entry.dayOfWeek, entry.entry.facultyId),
  });
  const { mutateAsync: createSub, isPending } = useCreateSubstitute();

  async function assign(facultyId: string) {
    try {
      await createSub({ date: entry.date, entryId: entry.entry._id, substituteFacultyId: facultyId });
      toast.success('Substitute assigned');
      onAssigned();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {suggestions.slice(0, 4).map((s) => (
        <button
          key={s.facultyId}
          onClick={() => assign(s.facultyId)}
          disabled={isPending || !s.available}
          className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors disabled:opacity-40 ${
            s.sameTrack ? 'bg-violet-100 text-violet-700 hover:bg-violet-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          title={!s.available ? 'Already teaching at this time' : s.sameTrack ? 'Teaches this track' : undefined}
        >
          {s.facultyName}
        </button>
      ))}
      {suggestions.length === 0 && <span className="text-xs text-gray-400">No suggestions available</span>}
    </div>
  );
}

export function SubstituteWorkspace() {
  const [date, setDate] = useState(todayIso());
  const { data: needed = [], isLoading, refetch } = useNeedsSubstitute(date);
  const { data: assigned = [] } = useSubstitutes({ date });
  const { mutate: updateSub } = useUpdateSubstitute();

  return (
    <PageContainer>
      <WorkspaceHeader title="Substitutes" subtitle="Cover sessions for faculty on approved leave" />

      <div className="mb-5">
        <label className="block text-xs font-semibold text-gray-500 mb-1.5">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
        />
      </div>

      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Needs Substitute</p>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-8">
        {isLoading ? (
          <div className="p-5 space-y-3 animate-pulse">{[1, 2].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl" />)}</div>
        ) : needed.length === 0 ? (
          <EmptyState icon={UserCog} title="All covered" description="No sessions need a substitute for this date." />
        ) : (
          <div className="divide-y divide-gray-50">
            {needed.map((n) => (
              <div key={n.entry._id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-[200px]">
                  <p className="text-sm font-semibold text-gray-900">{n.entry.batch} · {n.entry.track}</p>
                  <p className="text-xs text-gray-500">{n.facultyName} is on leave · {n.entry.startTime}–{n.entry.endTime}</p>
                </div>
                <SubstitutePicker entry={n} onAssigned={() => void refetch()} />
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Assigned Today</p>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {assigned.filter((s) => s.status !== 'cancelled').length === 0 ? (
          <EmptyState icon={UserCog} title="No substitutes assigned" description="Assigned coverage for this date will show up here." />
        ) : (
          <div className="divide-y divide-gray-50">
            {assigned.filter((s) => s.status !== 'cancelled').map((s) => (
              <div key={s._id} className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{s.batch ?? ''} {s.track ? `· ${s.track}` : ''}</p>
                  <p className="text-xs text-gray-500">{s.originalFacultyName ?? s.originalFacultyId} → {s.substituteFacultyName ?? s.substituteFacultyId ?? 'Unassigned'}</p>
                </div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${s.status === 'assigned' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {s.status}
                </span>
                <button onClick={() => updateSub({ id: s._id, payload: { status: 'cancelled' } })} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0" title="Cancel">
                  <XIcon className="w-3.5 h-3.5" />
                </button>
                {s.status === 'pending' && (
                  <span className="text-gray-300"><Check className="w-3.5 h-3.5" /></span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
