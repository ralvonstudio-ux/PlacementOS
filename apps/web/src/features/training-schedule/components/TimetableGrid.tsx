import { cn } from '@/lib/utils';
import type { PeriodSlot, TrainingScheduleEntry, ConflictInfo } from '@placementos/types';

const DAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface TimetableGridProps {
  slots: PeriodSlot[];
  entries: TrainingScheduleEntry[];
  conflicts?: ConflictInfo[];
  onCellClick?: (dayOfWeek: number, slot: PeriodSlot, entry?: TrainingScheduleEntry) => void;
  readonly?: boolean;
}

function findEntry(entries: TrainingScheduleEntry[], dayOfWeek: number, slotId: string): TrainingScheduleEntry | undefined {
  return entries.find((e) => e.dayOfWeek === dayOfWeek && e.slotId === slotId);
}

function isConflicted(conflicts: ConflictInfo[], dayOfWeek: number, slotId: string, entryId: string): boolean {
  return conflicts.some((c) => c.dayOfWeek === dayOfWeek && c.slotId === slotId && c.entryIds.includes(entryId));
}

function schedulableDays(slots: PeriodSlot[]): number[] {
  const days = new Set<number>();
  for (const slot of slots) slot.daysApplicable.forEach((d) => days.add(d));
  return Array.from(days).sort();
}

export function TimetableGrid({ slots, entries, conflicts = [], onCellClick, readonly = false }: TimetableGridProps) {
  const days = schedulableDays(slots);
  const ordered = [...slots].sort((a, b) => a.orderIndex - b.orderIndex);

  if (ordered.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">
        No period slots set up yet — set up the bell schedule first.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
      <table className="w-full text-sm border-collapse min-w-[640px]">
        <thead>
          <tr>
            <th className="w-28 px-3 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
              Period
            </th>
            {days.map((d) => (
              <th key={d} className="px-3 py-3 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                <span className="hidden sm:inline">{DAY_FULL[d]}</span>
                <span className="sm:hidden">{DAY_NAMES[d]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {ordered.map((slot) => (
            <tr key={slot._id} className={cn(slot.isBreak && 'bg-amber-50/40')}>
              <td className="px-3 py-3 border-r border-gray-100 align-top">
                <p className="text-xs font-bold text-gray-900 leading-tight">{slot.name}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{slot.startTime} – {slot.endTime}</p>
                {slot.isBreak && <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider">Break</span>}
              </td>
              {days.map((day) => {
                if (!slot.daysApplicable.includes(day)) {
                  return <td key={day} className="px-2 py-2 bg-gray-50/60 border-r border-gray-100 last:border-r-0" />;
                }
                if (slot.isBreak) {
                  return (
                    <td key={day} className="px-2 py-2 border-r border-gray-100 last:border-r-0">
                      <div className="flex items-center justify-center h-14 text-xs text-amber-500 font-medium">Break</div>
                    </td>
                  );
                }

                const entry = findEntry(entries, day, String(slot._id));
                const conflict = entry ? isConflicted(conflicts, day, String(slot._id), entry._id) : false;

                return (
                  <td
                    key={day}
                    onClick={!readonly ? () => onCellClick?.(day, slot, entry) : undefined}
                    className={cn('px-2 py-2 border-r border-gray-100 last:border-r-0 align-top', !readonly && 'cursor-pointer')}
                  >
                    {!entry ? (
                      <div
                        className={cn(
                          'flex items-center justify-center h-14 rounded-xl border-2 border-dashed transition-colors',
                          readonly ? 'border-gray-100' : 'border-gray-200 hover:border-violet-300 hover:bg-violet-50/50'
                        )}
                      >
                        <span className="text-[11px] text-gray-400 font-medium">{readonly ? 'Free' : '+ Add'}</span>
                      </div>
                    ) : (
                      <div
                        className={cn(
                          'p-2 rounded-xl h-14 flex flex-col justify-center border',
                          conflict ? 'bg-red-50 border-red-200' : 'bg-violet-50 border-violet-100'
                        )}
                      >
                        <p className={cn('text-xs font-bold leading-tight truncate', conflict ? 'text-red-600' : 'text-violet-700')}>{entry.track}</p>
                        <p className="text-[11px] text-gray-500 truncate">{entry.facultyName ?? entry.facultyId}</p>
                        {entry.room && <p className="text-[10px] text-gray-400 truncate">{entry.room}</p>}
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
  );
}
