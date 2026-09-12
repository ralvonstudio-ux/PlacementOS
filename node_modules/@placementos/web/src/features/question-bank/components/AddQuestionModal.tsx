import { useState, FormEvent } from 'react';
import { X } from 'lucide-react';
import { useCreateQuestion } from '../hooks/useQuestionBank';
import { extractErrorMessage } from '@/services/api';
import type { QuestionKind, QuestionDifficulty, QuestionBloomsLevel } from '@placementos/types';

const QUESTION_TYPES: QuestionKind[] = ['mcq', 'short', 'long', 'true_false', 'fill_blank', 'very_short', 'numerical', 'case_study'];
const DIFFICULTIES: QuestionDifficulty[] = ['easy', 'medium', 'hard'];
const BLOOMS: QuestionBloomsLevel[] = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];

interface Props {
  batch: string;
  track: string;
  trainingModuleName: string;
  onClose: () => void;
}

export function AddQuestionModal({ batch, track, trainingModuleName, onClose }: Props) {
  const { mutateAsync, isPending } = useCreateQuestion();
  const [questionText, setQuestionText] = useState('');
  const [questionType, setQuestionType] = useState<QuestionKind>('short');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>('medium');
  const [marks, setMarks] = useState(1);
  const [estimatedTimeMinutes, setEstimatedTimeMinutes] = useState(2);
  const [bloomsLevel, setBloomsLevel] = useState<QuestionBloomsLevel>('understand');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await mutateAsync({
        batch,
        track,
        trainingModuleName,
        questionText: questionText.trim(),
        questionType,
        options: questionType === 'mcq' ? options.filter((o) => o.trim()) : undefined,
        correctAnswer: correctAnswer.trim() || undefined,
        difficulty,
        marks,
        estimatedTimeMinutes,
        bloomsLevel,
      });
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <form onSubmit={handleSubmit} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" aria-label="Close">
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-lg font-bold text-gray-900 mb-1">Add Question</h2>
        <p className="text-sm text-gray-500 mb-5">{trainingModuleName}</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Question Text</label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              required
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
              <select value={questionType} onChange={(e) => setQuestionType(e.target.value as QuestionKind)} className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500">
                {QUESTION_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Difficulty</label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as QuestionDifficulty)} className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500">
                {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {questionType === 'mcq' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Options</label>
              <div className="space-y-2">
                {options.map((opt, i) => (
                  <input
                    key={i}
                    type="text"
                    value={opt}
                    onChange={(e) => setOptions((prev) => prev.map((o, idx) => (idx === i ? e.target.value : o)))}
                    placeholder={`Option ${i + 1}`}
                    className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Correct Answer</label>
            <input
              type="text"
              value={correctAnswer}
              onChange={(e) => setCorrectAnswer(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Marks</label>
              <input type="number" min={0} value={marks} onChange={(e) => setMarks(Number(e.target.value))} className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Time (min)</label>
              <input type="number" min={0} value={estimatedTimeMinutes} onChange={(e) => setEstimatedTimeMinutes(Number(e.target.value))} className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Bloom's</label>
              <select value={bloomsLevel} onChange={(e) => setBloomsLevel(e.target.value as QuestionBloomsLevel)} className="w-full h-10 px-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500">
                {BLOOMS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>

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
          <button type="submit" disabled={isPending || !questionText.trim()} className="h-10 px-5 rounded-lg bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50">
            {isPending ? 'Saving…' : 'Add Question'}
          </button>
        </div>
      </form>
    </div>
  );
}
