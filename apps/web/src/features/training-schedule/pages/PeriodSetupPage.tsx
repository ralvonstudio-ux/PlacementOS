import { useState, FormEvent } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Clock } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  usePeriodSlots,
  useCreatePeriodSlot,
  useUpdatePeriodSlot,
  useDeletePeriodSlot,
  useReorderPeriodSlots,
} from '../hooks/useTrainingSchedule';
import { extractErrorMessage } from '@/services/api';

const DAY_LABELS: Record<number, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
const ALL_DAYS = [1, 2, 3, 4, 5, 6];

export function PeriodSetupPage() {
  const { data: slots = [], isLoading } = usePeriodSlots();
  const { mutateAsync: createSlot, isPending: creating } = useCreatePeriodSlot();
  const { mutate: updateSlot } = useUpdatePeriodSlot();
  const { mutate: deleteSlot } = useDeletePeriodSlot();
  const { mutate: reorder } = useReorderPeriodSlots();

  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isBreak, setIsBreak] = useState(false);
  const [error, setError] = useState('');

  const ordered = [...slots].sort((a, b) => a.orderIndex - b.orderIndex);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await createSlot({ name, startTime, endTime, isBreak, daysApplicable: ALL_DAYS });
      setName('');
      setStartTime('');
      setEndTime('');
      setIsBreak(false);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    [next[index], next[target]] = [next[target], next[index]];
    reorder(next.map((s) => s._id));
  }

  function toggleDay(slotId: string, currentDays: number[], day: number) {
    const daysApplicable = currentDays.includes(day) ? currentDays.filter((d) => d !== day) : [...currentDays, day].sort();
    updateSlot({ id: slotId, payload: { daysApplicable } });
  }

  const inputCls = 'h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500';

  return (
    <PageContainer>
      <WorkspaceHeader title="Bell Schedule" subtitle="Define the period slots every batch's timetable is built from" />

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <p className="text-sm font-semibold text-gray-700 mb-3">Add a period</p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Period 1" required className={`${inputCls} w-36`} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Start</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">End</label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required className={inputCls} />
          </div>
          <label className="flex items-center gap-2 h-10 text-sm text-gray-600">
            <input type="checkbox" checked={isBreak} onChange={(e) => setIsBreak(e.target.checked)} className="rounded border-gray-300" />
            Break
          </label>
          <button type="submit" disabled={creating} className="h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50 inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add Period
          </button>
        </div>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </form>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl" />)}
          </div>
        ) : ordered.length === 0 ? (
          <EmptyState icon={Clock} title="No periods yet" description="Add your first period slot above to start building the timetable." />
        ) : (
          <div className="divide-y divide-gray-50">
            {ordered.map((slot, idx) => (
              <div key={slot._id} className="flex items-center gap-4 px-5 py-4">
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button onClick={() => move(idx, -1)} disabled={idx === 0} className="p-1 rounded text-gray-400 hover:text-gray-700 disabled:opacity-20"><ArrowUp className="w-3.5 h-3.5" /></button>
                  <button onClick={() => move(idx, 1)} disabled={idx === ordered.length - 1} className="p-1 rounded text-gray-400 hover:text-gray-700 disabled:opacity-20"><ArrowDown className="w-3.5 h-3.5" /></button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{slot.name} {slot.isBreak && <span className="text-[10px] font-semibold text-amber-500 uppercase ml-1.5">Break</span>}</p>
                  <p className="text-xs text-gray-500">{slot.startTime} – {slot.endTime}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {ALL_DAYS.map((d) => (
                    <button
                      key={d}
                      onClick={() => toggleDay(slot._id, slot.daysApplicable, d)}
                      className={`text-[10px] font-semibold w-7 h-7 rounded-lg transition-colors ${
                        slot.daysApplicable.includes(d) ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      {DAY_LABELS[d]}
                    </button>
                  ))}
                </div>
                <button onClick={() => deleteSlot(slot._id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
