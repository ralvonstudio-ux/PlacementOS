import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import type { AcademicPlanSession, AcademicPlanSessionStatus } from '@placementos/types';
import { useEditAcademicPlanSession, useDeleteAcademicPlanSession } from '../hooks/useAcademicPlan';

interface Props {
  planId: string;
  session: AcademicPlanSession;
  onClose: () => void;
}

const STATUS_OPTIONS: { value: AcademicPlanSessionStatus; label: string; activeClass: string }[] = [
  { value: 'planned', label: 'Planned', activeClass: 'bg-gray-700 text-white' },
  { value: 'completed', label: 'Completed', activeClass: 'bg-green-600 text-white' },
  { value: 'skipped', label: 'Skipped', activeClass: 'bg-amber-500 text-white' },
];

export function EditSessionModal({ planId, session, onClose }: Props) {
  const [title, setTitle] = useState(session.title);
  const [description, setDescription] = useState(session.description ?? '');
  const [date, setDate] = useState(session.date);
  const [status, setStatus] = useState<AcademicPlanSessionStatus>(session.status);
  const { mutateAsync: editSession, isPending } = useEditAcademicPlanSession();
  const { mutateAsync: deleteSession, isPending: isDeleting } = useDeleteAcademicPlanSession();

  async function handleSave() {
    await editSession({ planId, payload: { lectureNumber: session.lectureNumber, title, description, date, status } });
    onClose();
  }

  async function handleDelete() {
    await deleteSession({ planId, lectureNumber: session.lectureNumber });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Lecture {session.lectureNumber} · Week {session.week}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full h-10 px-3 mb-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
        />

        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 resize-none"
        />

        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full h-10 px-3 mb-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
        />

        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Status</label>
        <div className="flex gap-2 mb-5">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatus(opt.value)}
              className={`flex-1 h-9 rounded-lg text-xs font-semibold transition-colors ${
                status === opt.value ? opt.activeClass : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            aria-label="Delete session"
            className="h-10 w-10 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || !title.trim()}
            className="flex-1 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50"
          >
            {isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
