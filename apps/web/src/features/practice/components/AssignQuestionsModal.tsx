import { useState } from 'react';
import { X } from 'lucide-react';
import { useAssignPracticeQuestions } from '../hooks/usePractice';
import { AudiencePicker, audienceError, AudienceValue } from './AudiencePicker';
import { extractErrorMessage } from '@/services/api';

/** Bulk "give these questions to…" — replaces the audience of every selected question. */
export function AssignQuestionsModal({ questionIds, onClose, onDone }: { questionIds: string[]; onClose: () => void; onDone: () => void }) {
  const [audience, setAudience] = useState<AudienceValue>({ audience: 'all', batches: [], candidateIds: [] });
  const [error, setError] = useState('');
  const { mutateAsync, isPending } = useAssignPracticeQuestions();

  async function handleSubmit() {
    const problem = audienceError(audience);
    if (problem) { setError(problem); return; }
    setError('');
    try {
      await mutateAsync({ questionIds, audience: audience.audience, batches: audience.batches, candidateIds: audience.candidateIds });
      onDone();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"><X className="w-4 h-4" /></button>
        <h2 className="text-lg font-bold text-gray-900">Assign {questionIds.length} question{questionIds.length === 1 ? '' : 's'}</h2>
        <p className="text-sm text-gray-500 mt-1 mb-5">Choose who can see them. This replaces any earlier assignment, and students see the change straight away.</p>

        <AudiencePicker value={audience} onChange={setAudience} />

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <button type="button" onClick={handleSubmit} disabled={isPending} className="w-full h-10 mt-5 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50">
          {isPending ? 'Assigning…' : 'Assign'}
        </button>
      </div>
    </div>
  );
}
