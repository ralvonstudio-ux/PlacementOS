import { useState, FormEvent } from 'react';
import { X, Trash2 } from 'lucide-react';
import { useFacultyList } from '@/features/tpo/hooks/useTpo';
import { useCreateTrainingScheduleEntry, useUpdateTrainingScheduleEntry, useDeleteTrainingScheduleEntry } from '../hooks/useTrainingSchedule';
import { extractErrorMessage } from '@/services/api';
import type { PeriodSlot, TrainingScheduleEntry } from '@placementos/types';

interface Props {
  batch: string;
  placementYear: string;
  dayOfWeek: number;
  slot: PeriodSlot;
  entry?: TrainingScheduleEntry;
  onClose: () => void;
}

export function EntryEditModal({ batch, placementYear, dayOfWeek, slot, entry, onClose }: Props) {
  const { data: faculty = [] } = useFacultyList();
  const [track, setTrack] = useState(entry?.track ?? '');
  const [facultyId, setFacultyId] = useState(entry?.facultyId ?? '');
  const [room, setRoom] = useState(entry?.room ?? '');
  const [error, setError] = useState('');

  const { mutateAsync: create, isPending: creating } = useCreateTrainingScheduleEntry();
  const { mutateAsync: update, isPending: updating } = useUpdateTrainingScheduleEntry();
  const { mutateAsync: remove, isPending: deleting } = useDeleteTrainingScheduleEntry();
  const isPending = creating || updating || deleting;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        batch,
        track,
        facultyId,
        dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        room: room || undefined,
        placementYear,
        slotId: slot._id,
      };
      if (entry) {
        await update({ id: entry._id, payload });
      } else {
        await create(payload);
      }
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  async function handleDelete() {
    if (!entry) return;
    setError('');
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
      <form onSubmit={handleSubmit} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"><X className="w-4 h-4" /></button>
        <h2 className="text-lg font-bold text-gray-900 mb-1">{entry ? 'Edit Session' : 'Add Session'}</h2>
        <p className="text-sm text-gray-500 mb-5">{batch} · {slot.name} ({slot.startTime}–{slot.endTime})</p>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Track (subject)</label>
            <input value={track} onChange={(e) => setTrack(e.target.value)} placeholder="e.g. DSA, Aptitude" required className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Faculty (trainer)</label>
            <select value={facultyId} onChange={(e) => setFacultyId(e.target.value)} required className={inputCls}>
              <option value="">Select faculty…</option>
              {faculty.map((f) => (
                <option key={f._id} value={f._id}>{f.fullName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Room (optional)</label>
            <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Lab 1" className={inputCls} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex items-center gap-3 pt-1">
            {entry && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="h-10 px-4 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </button>
            )}
            <button type="submit" disabled={isPending} className="flex-1 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50">
              {isPending ? 'Saving…' : entry ? 'Save Changes' : 'Add Session'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
