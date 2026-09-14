import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Grid3x3 } from 'lucide-react';
import { useMasterGrid } from '../hooks/useTrainingSchedule';
import { MasterGridCellEditor } from '../components/MasterGridCellEditor';
import type { PeriodSlot } from '@placementos/types';

const DAY_LABELS: Record<number, string> = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday' };
const CURRENT_YEAR = String(new Date().getFullYear());

interface CellEntry { _id: string; track: string; facultyId: string; room?: string; facultyName?: string }

export function MasterGridPage() {
  const [placementYear, setPlacementYear] = useState(CURRENT_YEAR);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [editing, setEditing] = useState<{ batch: string; slot: PeriodSlot; entry?: CellEntry } | null>(null);

  const { data, isLoading } = useMasterGrid({ placementYear });
  const slots = (data?.slots ?? []).filter((s) => !s.isBreak && s.daysApplicable.includes(dayOfWeek)).sort((a, b) => a.orderIndex - b.orderIndex);
  const batches = data?.batches ?? [];
  const conflicts = data?.conflicts ?? [];

  const cellMap = useMemo(() => {
    const map = new Map<string, CellEntry>();
    for (const c of data?.cells ?? []) {
      if (c.entry) map.set(`${c.batch}::${c.dayOfWeek}::${c.slotId}`, c.entry as unknown as CellEntry);
    }
    return map;
  }, [data]);

  return (
    <PageContainer>
      <WorkspaceHeader title="Master Timetable" subtitle="Every batch, side by side — spot gaps and double-bookings at a glance" />

      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Placement Year</label>
          <input
            value={placementYear}
            onChange={(e) => setPlacementYear(e.target.value)}
            className="h-10 w-32 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
          />
        </div>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5, 6].map((d) => (
            <button
              key={d}
              onClick={() => setDayOfWeek(d)}
              className={`h-10 px-3 rounded-xl text-sm font-semibold transition-colors ${
                dayOfWeek === d ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {DAY_LABELS[d].slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="mb-5 flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {conflicts.length} scheduling conflict{conflicts.length > 1 ? 's' : ''} across the institute for {placementYear}.
        </div>
      )}

      {isLoading ? (
        <div className="p-5 space-y-3 animate-pulse">{[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl" />)}</div>
      ) : batches.length === 0 ? (
        <EmptyState icon={Grid3x3} title="Nothing scheduled yet" description={`No training schedule entries exist for ${placementYear} yet.`} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm border-collapse min-w-[640px]">
            <thead>
              <tr>
                <th className="w-28 px-3 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100">Period</th>
                {batches.map((b) => (
                  <th key={b} className="px-3 py-3 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-100">{b}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {slots.map((slot) => (
                <tr key={slot._id}>
                  <td className="px-3 py-3 border-r border-gray-100 align-top">
                    <p className="text-xs font-bold text-gray-900">{slot.name}</p>
                    <p className="text-[11px] text-gray-400">{slot.startTime}–{slot.endTime}</p>
                  </td>
                  {batches.map((b) => {
                    const entry = cellMap.get(`${b}::${dayOfWeek}::${slot._id}`);
                    const conflicted = entry ? conflicts.some((c) => c.entryIds.includes(entry._id)) : false;
                    return (
                      <td
                        key={b}
                        onClick={() => setEditing({ batch: b, slot, entry })}
                        className="px-2 py-2 border-r border-gray-100 last:border-r-0 align-top cursor-pointer"
                      >
                        {!entry ? (
                          <div className="flex items-center justify-center h-14 rounded-xl border-2 border-dashed border-gray-200 hover:border-violet-300 hover:bg-violet-50/50 transition-colors">
                            <span className="text-[11px] text-gray-400 font-medium">+ Add</span>
                          </div>
                        ) : (
                          <div className={`p-2 rounded-xl h-14 flex flex-col justify-center border ${conflicted ? 'bg-red-50 border-red-200' : 'bg-violet-50 border-violet-100'}`}>
                            <p className={`text-xs font-bold leading-tight truncate ${conflicted ? 'text-red-600' : 'text-violet-700'}`}>{entry.track}</p>
                            <p className="text-[11px] text-gray-500 truncate">{entry.facultyName ?? entry.facultyId}</p>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <MasterGridCellEditor
          batch={editing.batch}
          placementYear={placementYear}
          dayOfWeek={dayOfWeek}
          slot={editing.slot}
          entry={editing.entry}
          onClose={() => setEditing(null)}
        />
      )}
    </PageContainer>
  );
}
