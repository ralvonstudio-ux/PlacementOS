import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Settings2, AlertTriangle, Grid3x3 } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { useFacultyList } from '@/features/tpo/hooks/useTpo';
import { usePeriodSlots, useTrainingScheduleList, useConflicts } from '../hooks/useTrainingSchedule';
import { TimetableGrid } from '../components/TimetableGrid';
import { EntryEditModal } from '../components/EntryEditModal';
import type { PeriodSlot, TrainingScheduleEntry } from '@placementos/types';

const CURRENT_YEAR = String(new Date().getFullYear());

export function BatchTimetablePage() {
  const [batch, setBatch] = useState('');
  const [placementYear, setPlacementYear] = useState(CURRENT_YEAR);
  const [cell, setCell] = useState<{ day: number; slot: PeriodSlot; entry?: TrainingScheduleEntry } | null>(null);

  const { data: slots = [], isLoading: slotsLoading } = usePeriodSlots();
  const { data: entries = [], isLoading: entriesLoading } = useTrainingScheduleList(batch ? { batch, placementYear } : { placementYear });
  const { data: faculty = [] } = useFacultyList();
  const { data: conflicts = [] } = useConflicts(placementYear);

  const facultyNames = useMemo(() => new Map(faculty.map((f) => [f._id, f.fullName])), [faculty]);
  const knownBatches = useMemo(() => [...new Set(faculty.flatMap((f) => f.assignedBatches))].sort(), [faculty]);

  const enrichedEntries = useMemo(
    () => entries.map((e) => ({ ...e, facultyName: e.facultyName ?? facultyNames.get(e.facultyId) })),
    [entries, facultyNames]
  );

  return (
    <PageContainer>
      <WorkspaceHeader
        title="Timetable"
        subtitle="Weekly training schedule, batch by batch"
        action={
          <div className="flex items-center gap-2">
            <Link to="/tpo/timetable/master-grid" className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 text-sm font-semibold text-gray-700 transition-colors">
              <Grid3x3 className="w-4 h-4" /> Master Grid
            </Link>
            <Link to="/tpo/timetable/periods" className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 text-sm font-semibold text-gray-700 transition-colors">
              <Settings2 className="w-4 h-4" /> Bell Schedule
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Batch</label>
          <input
            list="batch-options"
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            placeholder="e.g. 2026-CSE"
            className="h-10 w-56 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
          />
          <datalist id="batch-options">
            {knownBatches.map((b) => <option key={b} value={b} />)}
          </datalist>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Placement Year</label>
          <input
            value={placementYear}
            onChange={(e) => setPlacementYear(e.target.value)}
            className="h-10 w-32 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
          />
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="mb-5 flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {conflicts.length} scheduling conflict{conflicts.length > 1 ? 's' : ''} detected for {placementYear} — cells in red below are double-booked.
        </div>
      )}

      {!batch ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400 flex flex-col items-center gap-2">
          <CalendarDays className="w-8 h-8 text-gray-300" />
          Enter a batch above to view or edit its weekly timetable.
        </div>
      ) : slotsLoading || entriesLoading ? (
        <div className="p-5 space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl" />)}
        </div>
      ) : (
        <TimetableGrid
          slots={slots}
          entries={enrichedEntries}
          conflicts={conflicts}
          onCellClick={(day, slot, entry) => setCell({ day, slot, entry })}
        />
      )}

      {cell && (
        <EntryEditModal
          batch={batch}
          placementYear={placementYear}
          dayOfWeek={cell.day}
          slot={cell.slot}
          entry={cell.entry}
          onClose={() => setCell(null)}
        />
      )}
    </PageContainer>
  );
}
