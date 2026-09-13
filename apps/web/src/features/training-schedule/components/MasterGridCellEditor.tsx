import { useState, FormEvent } from 'react';
import { X, Trash2 } from 'lucide-react';
import { useFacultyList } from '@/features/tpo/hooks/useTpo';
import { useSetMasterGridCell, useDeleteTrainingScheduleEntry } from '../hooks/useTrainingSchedule';
import { extractErrorMessage } from '@/services/api';
import type { PeriodSlot } from '@placementos/types';

interface Props {
  batch: string;
  placementYear: string;
  dayOfWeek: number;
  slot: PeriodSlot;
  entry?: { _id: string; track: string; facultyId: string; room?: string };
  onClose: () => void;
}

export function MasterGridCellEditor({ batch, placementYear, dayOfWeek, slot, entry, onClose }: Props) {
  const { data: faculty = [] } = useFacultyList();
  const [track, setTrack] = useState(entry?.track ?? '');
  const [facultyId, setFacultyId] = useState(entry?.facultyId ?? '');
  const [room, setRoom] = useState(entry?.room ?? '');
  const [error, setError] = useState('');

  const { mutateAsync: setCell, isPending: saving } = useSetMasterGridCell();
  const { mutateAsync: remove, isPending: deleting } = useDeleteTrainingScheduleEntry();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await setCell({
        batch,
        track,
        facultyId,
        dayOfWeek,
        slotId: slot._id,
        placementYear,
        room: room || undefined,
        entryId: entry?._id,
      });
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  async function handleDelete() {
    if (!entry) return;
    try {
      await remove(entry._id);
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  const inputCls = 'w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <form onSubmit={handleSubmit} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"><X className="w-4 h-4" /></button>
        <h2 className="text-lg font-bold text-gray-900 mb-1">{batch}</h2>
        <p className="text-sm text-gray-500 mb-5">{slot.name} ({slot.startTime}–{slot.endTime})</p>
        <div className="space-y-3">
          <input value={track} onChange={(e) => setTrack(e.target.value)} placeholder="Track (subject)" required className={inputCls} />
          <select value={facultyId} onChange={(e) => setFacultyId(e.target.value)} required className={inputCls}>
            <option value="">Select faculty…</option>
            {faculty.map((f) => <option key={f._id} value={f._id}>{f.fullName}</option>)}
          </select>
          <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Room (optional)" className={inputCls} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex items-center gap-3">
            {entry && (
              <button type="button" onClick={handleDelete} disabled={deleting} className="h-10 px-3 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button type="submit" disabled={saving} className="flex-1 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
