import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { useCreateTest } from '../hooks/useTests';
import { extractErrorMessage } from '@/services/api';
import type { TestQuestionSnapshot, TestQuestionType } from '@placementos/types';

const inputCls = 'w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500';

function emptyQuestion(): TestQuestionSnapshot {
  return { questionText: '', questionType: 'mcq', options: ['', '', '', ''], correctAnswer: '', marks: 1 };
}

export function TestBuilderPage() {
  const navigate = useNavigate();
  const { mutateAsync, isPending } = useCreateTest();

  const [title, setTitle] = useState('');
  const [batch, setBatch] = useState('');
  const [track, setTrack] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [violationLimit, setViolationLimit] = useState(3);
  const [questions, setQuestions] = useState<TestQuestionSnapshot[]>([emptyQuestion()]);
  const [error, setError] = useState('');

  function updateQuestion(i: number, patch: Partial<TestQuestionSnapshot>) {
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }

  const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 0), 0);

  async function handleSubmit() {
    setError('');
    if (!title.trim() || !batch.trim() || questions.length === 0) return;
    try {
      const test = await mutateAsync({
        title: title.trim(),
        batch: batch.trim(),
        track: track.trim() || undefined,
        questions: questions.map((q) => ({ ...q, options: q.questionType === 'mcq' ? q.options?.filter((o) => o.trim()) : undefined })),
        durationMinutes,
        violationLimit,
      });
      navigate(`/tpo/tests/${test._id}/review`);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <PageContainer>
      <WorkspaceHeader title="New Test" subtitle="Build a proctored test — it saves as a draft until you publish it" />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-3xl space-y-4 mb-6">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Test title" className={inputCls} />
        <div className="grid grid-cols-2 gap-3">
          <input value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="Batch" className={inputCls} />
          <input value={track} onChange={(e) => setTrack(e.target.value)} placeholder="Track (optional)" className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Duration (minutes)</label>
            <input type="number" min={1} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Violation limit before auto-submit</label>
            <input type="number" min={1} value={violationLimit} onChange={(e) => setViolationLimit(Number(e.target.value))} className={inputCls} />
          </div>
        </div>
      </div>

      <div className="max-w-3xl space-y-4 mb-6">
        {questions.map((q, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-400">Question {i + 1}</span>
              <div className="flex items-center gap-2">
                <select value={q.questionType} onChange={(e) => updateQuestion(i, { questionType: e.target.value as TestQuestionType })} className="h-8 px-2 rounded-lg border border-gray-200 text-xs">
                  <option value="mcq">MCQ</option>
                  <option value="short_answer">Short Answer</option>
                </select>
                <input type="number" min={0} value={q.marks} onChange={(e) => updateQuestion(i, { marks: Number(e.target.value) })} placeholder="Marks" className="w-16 h-8 px-2 rounded-lg border border-gray-200 text-xs" />
                {questions.length > 1 && (
                  <button onClick={() => setQuestions((prev) => prev.filter((_, idx) => idx !== i))} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                )}
              </div>
            </div>
            <textarea value={q.questionText} onChange={(e) => updateQuestion(i, { questionText: e.target.value })} placeholder="Question text" rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none mb-3 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500" />

            {q.questionType === 'mcq' ? (
              <>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {(q.options ?? ['', '', '', '']).map((opt, oi) => (
                    <input
                      key={oi}
                      value={opt}
                      onChange={(e) => {
                        const next = [...(q.options ?? ['', '', '', ''])];
                        next[oi] = e.target.value;
                        updateQuestion(i, { options: next });
                      }}
                      placeholder={`Option ${oi + 1}`}
                      className="h-9 px-2.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400"
                    />
                  ))}
                </div>
                <input value={q.correctAnswer ?? ''} onChange={(e) => updateQuestion(i, { correctAnswer: e.target.value })} placeholder="Correct answer (must match an option exactly, for auto-grading)" className={inputCls} />
              </>
            ) : (
              <input value={q.correctAnswer ?? ''} onChange={(e) => updateQuestion(i, { correctAnswer: e.target.value })} placeholder="Expected answer for auto-grading (optional — leave blank for manual review)" className={inputCls} />
            )}
          </div>
        ))}

        <button onClick={() => setQuestions((prev) => [...prev, emptyQuestion()])} className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-600 hover:text-violet-700">
          <Plus className="w-4 h-4" /> Add question
        </button>
      </div>

      {error && (
        <div className="max-w-3xl mb-4 rounded-lg bg-red-50 border border-red-100 px-4 py-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="max-w-3xl flex items-center justify-between">
        <p className="text-sm text-gray-500">Total marks: <span className="font-semibold text-gray-900">{totalMarks}</span></p>
        <button
          onClick={handleSubmit}
          disabled={isPending || !title.trim() || !batch.trim()}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save as Draft
        </button>
      </div>
    </PageContainer>
  );
}
