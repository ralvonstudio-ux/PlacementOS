import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Save, Loader2, Sparkles, PencilLine, Eye, EyeOff } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { ContentSourceInput } from '@/features/content-extraction/components/ContentSourceInput';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useCreateTest, useGenerateTestDraft } from '../hooks/useTests';
import { extractErrorMessage } from '@/services/api';
import type { CodingLanguage, TestCase, TestQuestionSnapshot, TestQuestionType } from '@placementos/types';

const inputCls = 'w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500';

const ALL_LANGUAGES: { value: CodingLanguage; label: string }[] = [
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
];

function emptyQuestion(): TestQuestionSnapshot {
  return { questionText: '', questionType: 'mcq', options: ['', '', '', ''], correctAnswer: '', marks: 1 };
}

function emptyTestCase(): TestCase {
  return { input: '', expectedOutput: '', hidden: false };
}

export function TestBuilderPage() {
  const { user } = useAuth();
  const basePath = user?.role === 'faculty' ? '/faculty' : '/tpo';

  const [mode, setMode] = useState<'ai' | 'manual'>('ai');

  return (
    <PageContainer>
      <WorkspaceHeader title="New Test" subtitle="AI-draft a test from your content, or build one by hand — either way it saves as a draft until approved, then you decide who to send it to" />

      <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 mb-6 w-fit">
        <button onClick={() => setMode('ai')} className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${mode === 'ai' ? 'bg-violet-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
          <Sparkles className="w-4 h-4" /> AI Draft
        </button>
        <button onClick={() => setMode('manual')} className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${mode === 'manual' ? 'bg-violet-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
          <PencilLine className="w-4 h-4" /> Build Manually
        </button>
      </div>

      {mode === 'ai' ? <AiDraftForm basePath={basePath} /> : <ManualBuilderForm basePath={basePath} />}
    </PageContainer>
  );
}

function AiDraftForm({ basePath }: { basePath: string }) {
  const navigate = useNavigate();
  const { mutateAsync, isPending } = useGenerateTestDraft();

  const [title, setTitle] = useState('');
  const [track, setTrack] = useState('');
  const [contentName, setContentName] = useState('');
  const [topic, setTopic] = useState('');
  const [sourceContent, setSourceContent] = useState('');
  const [mcqCount, setMcqCount] = useState(8);
  const [shortAnswerCount, setShortAnswerCount] = useState(2);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [violationLimit, setViolationLimit] = useState(3);
  const [error, setError] = useState('');

  const canSubmit = title.trim() && contentName.trim() && topic.trim() && sourceContent.trim() && (mcqCount + shortAnswerCount) > 0;

  async function handleSubmit() {
    setError('');
    if (!canSubmit) return;
    try {
      await mutateAsync({
        title: title.trim(),
        track: track.trim() || undefined,
        contentName: contentName.trim(),
        topic: topic.trim(),
        sourceContent: sourceContent.trim(),
        mcqCount,
        shortAnswerCount,
        durationMinutes,
        violationLimit,
      });
      navigate(`${basePath}/tests`);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-3xl space-y-4">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Test title" className={inputCls} />
      <input value={track} onChange={(e) => setTrack(e.target.value)} placeholder="Track (optional)" className={inputCls} />
      <div className="grid grid-cols-2 gap-3">
        <input value={contentName} onChange={(e) => setContentName(e.target.value)} placeholder="Content name (e.g. Chapter 4 notes)" className={inputCls} />
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic" className={inputCls} />
      </div>

      <ContentSourceInput value={sourceContent} onChange={setSourceContent} label="Content" placeholder="Paste the material this test should be based on…" rows={8} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">MCQ questions</label>
          <input type="number" min={0} max={100} value={mcqCount} onChange={(e) => setMcqCount(Number(e.target.value))} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Short-answer questions</label>
          <input type="number" min={0} max={100} value={shortAnswerCount} onChange={(e) => setShortAnswerCount(Number(e.target.value))} className={inputCls} />
        </div>
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

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={isPending || !canSubmit}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {isPending ? 'Drafting…' : 'Generate & Save Draft'}
        </button>
      </div>
    </div>
  );
}

function ManualBuilderForm({ basePath }: { basePath: string }) {
  const navigate = useNavigate();
  const { mutateAsync, isPending } = useCreateTest();

  const [title, setTitle] = useState('');
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
    if (!title.trim() || questions.length === 0) return;
    try {
      await mutateAsync({
        title: title.trim(),
        track: track.trim() || undefined,
        questions: questions.map((q) => ({ ...q, options: q.questionType === 'mcq' ? q.options?.filter((o) => o.trim()) : undefined })),
        durationMinutes,
        violationLimit,
      });
      navigate(`${basePath}/tests`);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-3xl space-y-4 mb-6">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Test title" className={inputCls} />
        <input value={track} onChange={(e) => setTrack(e.target.value)} placeholder="Track (optional)" className={inputCls} />
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
                <select
                  value={q.questionType}
                  onChange={(e) => {
                    const questionType = e.target.value as TestQuestionType;
                    updateQuestion(i, questionType === 'coding'
                      ? { questionType, allowedLanguages: ['python'], starterCode: {}, testCases: [emptyTestCase()] }
                      : { questionType });
                  }}
                  className="h-8 px-2 rounded-lg border border-gray-200 text-xs"
                >
                  <option value="mcq">MCQ</option>
                  <option value="short_answer">Short Answer</option>
                  <option value="coding">Coding</option>
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
            ) : q.questionType === 'coding' ? (
              <CodingQuestionFields question={q} onChange={(patch) => updateQuestion(i, patch)} />
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
          disabled={isPending || !title.trim()}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save as Draft
        </button>
      </div>
    </>
  );
}

function CodingQuestionFields({ question, onChange }: { question: TestQuestionSnapshot; onChange: (patch: Partial<TestQuestionSnapshot>) => void }) {
  const allowedLanguages = question.allowedLanguages ?? [];
  const starterCode = question.starterCode ?? {};
  const testCases = question.testCases ?? [];

  function toggleLanguage(lang: CodingLanguage) {
    const next = allowedLanguages.includes(lang) ? allowedLanguages.filter((l) => l !== lang) : [...allowedLanguages, lang];
    onChange({ allowedLanguages: next });
  }

  function updateTestCase(i: number, patch: Partial<TestCase>) {
    onChange({ testCases: testCases.map((tc, idx) => (idx === i ? { ...tc, ...patch } : tc)) });
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-gray-500 mb-1.5">Allowed languages</label>
        <div className="flex flex-wrap gap-2">
          {ALL_LANGUAGES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => toggleLanguage(value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${allowedLanguages.includes(value) ? 'bg-violet-600 border-violet-600 text-white' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {allowedLanguages.length > 0 && (
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">Starter code (optional, per language)</label>
          <div className="space-y-2">
            {allowedLanguages.map((lang) => (
              <div key={lang}>
                <span className="text-[11px] font-semibold text-gray-400 uppercase">{lang}</span>
                <textarea
                  value={starterCode[lang] ?? ''}
                  onChange={(e) => onChange({ starterCode: { ...starterCode, [lang]: e.target.value } })}
                  rows={3}
                  placeholder={`Starter code shown to candidates for ${lang}…`}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-violet-400"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs text-gray-500">Test cases</label>
          <button type="button" onClick={() => onChange({ testCases: [...testCases, emptyTestCase()] })} className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700">
            <Plus className="w-3 h-3" /> Add test case
          </button>
        </div>
        <div className="space-y-2">
          {testCases.map((tc, i) => (
            <div key={i} className="rounded-lg border border-gray-200 p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[11px] text-gray-400">Input (stdin)</span>
                  <textarea value={tc.input} onChange={(e) => updateTestCase(i, { input: e.target.value })} rows={2} placeholder="(optional)" className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-violet-400" />
                </div>
                <div>
                  <span className="text-[11px] text-gray-400">Expected output</span>
                  <textarea value={tc.expectedOutput} onChange={(e) => updateTestCase(i, { expectedOutput: e.target.value })} rows={2} placeholder="Expected stdout" className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-violet-400" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => updateTestCase(i, { hidden: !tc.hidden })}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
                  title={tc.hidden ? 'Hidden — only used for scoring, never shown to the candidate' : 'Visible — shown to the candidate as a sample, and used for Run'}
                >
                  {tc.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {tc.hidden ? 'Hidden (scoring only)' : 'Visible (sample)'}
                </button>
                {testCases.length > 1 && (
                  <button type="button" onClick={() => onChange({ testCases: testCases.filter((_, idx) => idx !== i) })} className="p-1 text-gray-400 hover:text-red-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
