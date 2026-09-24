import { useState, FormEvent } from 'react';
import { X } from 'lucide-react';
import { StarRating } from '@/components/ui/StarRating';
import { useSubmitTrainerFeedback } from '../hooks/useTrainerFeedback';
import { extractErrorMessage } from '@/services/api';
import type { TrainerFeedbackEligibleTrainer, TrainerFeedbackRatings } from '@placementos/types';

interface Props {
  trainer: TrainerFeedbackEligibleTrainer;
  onClose: () => void;
  onSuccess?: () => void;
}

const CRITERIA: { key: keyof TrainerFeedbackRatings; label: string; hint: string }[] = [
  { key: 'subjectKnowledge', label: 'Subject Knowledge', hint: 'Command over the topics taught' },
  { key: 'teachingQuality', label: 'Teaching Quality', hint: 'Clarity and how well concepts landed' },
  { key: 'communication', label: 'Communication', hint: 'How approachable and clear they were' },
  { key: 'punctuality', label: 'Punctuality', hint: 'Started/ended sessions on time' },
];

export function SubmitFeedbackModal({ trainer, onClose, onSuccess }: Props) {
  const [ratings, setRatings] = useState<Partial<TrainerFeedbackRatings>>({});
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [error, setError] = useState('');
  const { mutateAsync, isPending } = useSubmitTrainerFeedback();

  const allRated = CRITERIA.every((c) => ratings[c.key]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!allRated) return;
    try {
      await mutateAsync({
        facultyId: trainer.facultyId,
        track: trainer.track,
        isAnonymous,
        ratings: ratings as TrainerFeedbackRatings,
        comment: comment.trim() || undefined,
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <form onSubmit={handleSubmit} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} type="button" className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" aria-label="Close">
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-lg font-bold text-gray-900">Rate {trainer.facultyName}</h2>
        <p className="text-sm text-gray-500 mt-0.5 mb-5">{trainer.track}</p>

        <div className="space-y-4">
          {CRITERIA.map((c) => (
            <div key={c.key} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-700">{c.label}</p>
                <p className="text-xs text-gray-400">{c.hint}</p>
              </div>
              <StarRating value={ratings[c.key] ?? 0} onChange={(v) => setRatings((r) => ({ ...r, [c.key]: v }))} />
            </div>
          ))}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Comments (optional)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Anything you'd like to add"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
            />
          </div>

          <label className="flex items-start gap-2.5 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500/30"
            />
            <span className="text-xs text-gray-600 leading-relaxed">
              <span className="font-medium text-gray-700">Submit anonymously.</span> Your name won't be shown to the trainer or
              the Principal — only your response and comments will be visible. Uncheck this if you're fine sharing your identity.
            </span>
          </label>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending || !allRated}
            className="h-10 px-5 rounded-lg bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50"
          >
            {isPending ? 'Submitting…' : 'Submit Feedback'}
          </button>
        </div>
      </form>
    </div>
  );
}
