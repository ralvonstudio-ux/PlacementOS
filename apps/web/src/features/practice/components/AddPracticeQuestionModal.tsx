import { useState, FormEvent } from 'react';
import { X } from 'lucide-react';
import { useCreatePracticeQuestion } from '../hooks/usePractice';
import { extractErrorMessage } from '@/services/api';
import type { PracticeCategory, PracticeQuestionType, PracticeDifficulty } from '@placementos/types';

const CATEGORIES: { value: PracticeCategory; label: string }[] = [
  { value: 'pi', label: 'Personal Interview' },
  { value: 'gd', label: 'Group Discussion' },
  { value: 'aptitude', label: 'Aptitude' },
  { value: 'reasoning', label: 'Reasoning' },
  { value: 'company', label: 'Company-specific' },
];

export function AddPracticeQuestionModal({ onClose }: { onClose: () => void }) {
  const [category, setCategory] = useState<PracticeCategory>('aptitude');
  const [companyName, setCompanyName] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [questionType, setQuestionType] = useState<PracticeQuestionType>('mcq');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [explanation, setExplanation] = useState('');
  const [guidanceText, setGuidanceText] = useState('');
  const [difficulty, setDifficulty] = useState<PracticeDifficulty>('medium');
  const [error, setError] = useState('');
  const { mutateAsync, isPending } = useCreatePracticeQuestion();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await mutateAsync({
        category,
        companyName: category === 'company' ? companyName.trim() : undefined,
        questionText: questionText.trim(),
        questionType,
        options: questionType === 'mcq' ? options.filter((o) => o.trim()) : undefined,
        correctAnswer: correctAnswer.trim() || undefined,
        explanation: explanation.trim() || undefined,
        guidancePoints: questionType === 'open_ended' ? guidanceText.split('\n').map((s) => s.trim()).filter(Boolean) : undefined,
        difficulty,
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
      <form onSubmit={handleSubmit} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"><X className="w-4 h-4" /></button>
        <h2 className="text-lg font-bold text-gray-900 mb-5">Add Practice Question</h2>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <select value={category} onChange={(e) => setCategory(e.target.value as PracticeCategory)} className={inputCls}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select value={questionType} onChange={(e) => setQuestionType(e.target.value as PracticeQuestionType)} className={inputCls}>
              <option value="mcq">MCQ (instant feedback)</option>
              <option value="open_ended">Open-ended (guidance only)</option>
            </select>
          </div>

          {category === 'company' && (
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company name (e.g. TCS, Infosys)" required className={inputCls} />
          )}

          <textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="Question / topic" required rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500" />

          {questionType === 'mcq' ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                {options.map((opt, i) => (
                  <input key={i} value={opt} onChange={(e) => setOptions((p) => p.map((o, idx) => idx === i ? e.target.value : o))} placeholder={`Option ${i + 1}`} className={inputCls} />
                ))}
              </div>
              <input value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} placeholder="Correct answer (must match one option exactly)" className={inputCls} />
              <input value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Explanation (optional)" className={inputCls} />
            </>
          ) : (
            <textarea value={guidanceText} onChange={(e) => setGuidanceText(e.target.value)} placeholder={'Guidance points, one per line'} rows={4} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500" />
          )}

          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as PracticeDifficulty)} className={inputCls}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={isPending} className="w-full h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50">
            {isPending ? 'Adding…' : 'Add Question'}
          </button>
        </div>
      </form>
    </div>
  );
}
