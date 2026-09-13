import { useState } from 'react';
import { X } from 'lucide-react';
import type { Candidate } from '@placementos/types';
import { useUpdateFacultyNote } from '@/features/candidates/hooks/useCandidates';

interface Props {
  candidate: Candidate;
  onClose: () => void;
}

/** Faculty-only editor for a per-student note, opened from the pencil icon on the
 *  batch roster. The note lives only here — it never surfaces on the attendance
 *  marking screen, which shows just the student's name (and roll number). */
export function StudentNoteModal({ candidate, onClose }: Props) {
  const [note, setNote] = useState(candidate.facultyNote ?? '');
  const { mutateAsync: saveNote, isPending } = useUpdateFacultyNote();

  async function handleSave() {
    await saveNote({ id: candidate._id, facultyNote: note });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">{candidate.fullName}</p>
            <p className="text-xs text-gray-400">{candidate.rollNumber}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          Note about this student
        </label>
        <textarea
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder="Visible only to faculty — e.g. attendance concerns, follow-ups, context for other teachers…"
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 resize-none"
        />
        <p className="text-[11px] text-gray-300 mt-1 text-right">{note.length}/2000</p>

        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="flex-1 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50"
          >
            {isPending ? 'Saving…' : 'Save Note'}
          </button>
        </div>
      </div>
    </div>
  );
}
