import { useState, FormEvent } from 'react';
import { X } from 'lucide-react';
import { useUpdateFaculty } from '../hooks/useAdminFaculty';
import { extractErrorMessage } from '@/services/api';
import type { Faculty } from '@placementos/types';

interface Props {
  faculty: Faculty;
  onClose: () => void;
}

/** Comma-separated list -> trimmed, de-duplicated string array. */
function parseList(raw: string): string[] {
  return Array.from(new Set(raw.split(',').map((s) => s.trim()).filter(Boolean)));
}

export function AssignFacultyModal({ faculty, onClose }: Props) {
  const [batches, setBatches] = useState(faculty.assignedBatches.join(', '));
  const [tracks, setTracks] = useState(faculty.tracks.join(', '));
  const [error, setError] = useState('');
  const { mutateAsync, isPending } = useUpdateFaculty();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await mutateAsync({
        id: faculty._id,
        payload: { assignedBatches: parseList(batches), tracks: parseList(tracks) },
      });
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
        <h2 className="text-lg font-bold text-gray-900 mb-1">Assign Batches &amp; Tracks</h2>
        <p className="text-sm text-gray-500 mb-5">For {faculty.fullName} — the classes and subjects this trainer handles</p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Batches (classes)</label>
            <input value={batches} onChange={(e) => setBatches(e.target.value)} placeholder="e.g. 2026-CSE-A, 2026-CSE-B" className={inputCls} />
            <p className="text-xs text-gray-400 mt-1">Comma-separated batch codes</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tracks (subjects)</label>
            <input value={tracks} onChange={(e) => setTracks(e.target.value)} placeholder="e.g. DSA, Aptitude" className={inputCls} />
            <p className="text-xs text-gray-400 mt-1">Comma-separated track names</p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={isPending} className="w-full h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50">
            {isPending ? 'Saving…' : 'Save Assignment'}
          </button>
        </div>
      </form>
    </div>
  );
}
