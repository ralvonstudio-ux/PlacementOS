import { useState, FormEvent } from 'react';
import { X } from 'lucide-react';
import { useCreatePracticeQuestion, useUpdatePracticeQuestion } from '../hooks/usePractice';
import { AudiencePicker, audienceError, AudienceValue } from './AudiencePicker';
import { extractErrorMessage } from '@/services/api';
import type { PracticeCategory, PracticeQuestion, PracticeQuestionType, PracticeDifficulty } from '@placementos/types';

const CATEGORIES: { value: PracticeCategory; label: string }[] = [
  { value: 'gd', label: 'Group Discussion' },
  { value: 'pi', label: 'Personal Interview' },
  { value: 'aptitude', label: 'Aptitude' },
  { value: 'reasoning', label: 'Reasoning' },
  { value: 'company', label: 'Company-specific' },
];

const OPTION_SLOTS = 4;

/** Add a practice question, or edit one when `question` is passed. */
export function AddPracticeQuestionModal({ onClose, question }: { onClose: () => void; question?: PracticeQuestion }) {
  const editing = !!question;
  const [category, setCategory] = useState<PracticeCategory>(question?.category ?? 'aptitude');
  const [companyName, setCompanyName] = useState(question?.companyName ?? '');
  const [questionText, setQuestionText] = useState(question?.questionText ?? '');
  const [questionType, setQuestionType] = useState<PracticeQuestionType>(question?.questionType ?? 'mcq');
  const [options, setOptions] = useState<string[]>(() => {
    const existing = question?.options ?? [];
    return [...existing, ...Array(Math.max(0, OPTION_SLOTS - existing.length)).fill('')];
  });
  const [correctAnswer, setCorrectAnswer] = useState(question?.correctAnswer ?? '');
  const [explanation, setExplanation] = useState(question?.explanation ?? '');
  const [guidanceText, setGuidanceText] = useState((question?.guidancePoints ?? []).join('\n'));
  const [difficulty, setDifficulty] = useState<PracticeDifficulty>(question?.difficulty ?? 'medium');
  const [audience, setAudience] = useState<AudienceValue>({
    audience: question?.audience ?? 'all',
    batches: question?.batches ?? [],
    candidateIds: question?.candidateIds ?? [],
  });
  const [error, setError] = useState('');
  const create = useCreatePracticeQuestion();
  const update = useUpdatePracticeQuestion();
  const isPending = create.isPending || update.isPending;

  const filledOptions = options.map((o) => o.trim()).filter(Boolean);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const audienceProblem = audienceError(audience);
    if (audienceProblem) { setError(audienceProblem); return; }
    if (questionType === 'mcq' && !filledOptions.includes(correctAnswer.trim())) {
      setError('Pick which option is the correct answer.');
      return;
    }

    const payload = {
      category,
      companyName: category === 'company' ? companyName.trim() : undefined,
      questionText: questionText.trim(),
      questionType,
      options: questionType === 'mcq' ? filledOptions : undefined,
      correctAnswer: questionType === 'mcq' ? correctAnswer.trim() : undefined,
      explanation: explanation.trim(),
      guidancePoints: questionType === 'open_ended' ? guidanceText.split('\n').map((s) => s.trim()).filter(Boolean) : undefined,
      difficulty,
      audience: audience.audience,
      batches: audience.batches,
      candidateIds: audience.candidateIds,
    };

    try {
      if (question) await update.mutateAsync({ id: question._id, payload });
      else await create.mutateAsync(payload);
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  const inputCls = 'w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500';
  const areaCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500';
  const labelCls = 'block text-xs font-semibold text-gray-500 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <form onSubmit={handleSubmit} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"><X className="w-4 h-4" /></button>
        <h2 className="text-lg font-bold text-gray-900 mb-5">{editing ? 'Edit Practice Question' : 'Add Practice Question'}</h2>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <select value={category} onChange={(e) => setCategory(e.target.value as PracticeCategory)} className={inputCls}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select value={questionType} onChange={(e) => setQuestionType(e.target.value as PracticeQuestionType)} className={inputCls}>
              <option value="mcq">MCQ (instant feedback)</option>
              <option value="open_ended">Open-ended (model answer)</option>
            </select>
          </div>

          {category === 'company' && (
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company name (e.g. TCS, Infosys)" required className={inputCls} />
          )}

          <textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="Question / topic" required rows={2} className={areaCls} />

          {questionType === 'mcq' ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                {options.map((opt, i) => (
                  <input key={i} value={opt} onChange={(e) => setOptions((p) => p.map((o, idx) => idx === i ? e.target.value : o))} placeholder={`Option ${i + 1}`} className={inputCls} />
                ))}
              </div>
              <div>
                <label className={labelCls}>Correct answer</label>
                <select value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} className={inputCls}>
                  <option value="">Select the correct option…</option>
                  {filledOptions.map((o, i) => <option key={i} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Solution / explanation</label>
                <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Step-by-step solution students see after answering" rows={3} className={areaCls} />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className={labelCls}>Key points (one per line)</label>
                <textarea value={guidanceText} onChange={(e) => setGuidanceText(e.target.value)} placeholder="Structure, arguments and tips" rows={4} className={areaCls} />
              </div>
              <div>
                <label className={labelCls}>Model answer / solution</label>
                <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="A sample answer students can learn from" rows={4} className={areaCls} />
              </div>
            </>
          )}

          <div>
            <label className={labelCls}>Difficulty</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as PracticeDifficulty)} className={inputCls}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>Who can see this?</label>
            <AudiencePicker value={audience} onChange={setAudience} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={isPending} className="w-full h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50">
            {isPending ? 'Saving…' : editing ? 'Save Changes' : 'Add Question'}
          </button>
        </div>
      </form>
    </div>
  );
}
