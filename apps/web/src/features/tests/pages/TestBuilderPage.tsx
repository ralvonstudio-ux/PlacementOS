import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Sparkles, PencilLine } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { ContentSourceInput } from '@/features/content-extraction/components/ContentSourceInput';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useGenerateTestDraft } from '../hooks/useTests';
import { ManualTestBuilder } from '../components/ManualTestBuilder';
import { extractErrorMessage } from '@/services/api';

const inputCls = 'w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500';

export function TestBuilderPage() {
  const { user } = useAuth();
  const basePath = user?.role === 'faculty' ? '/faculty' : '/tpo';

  const [mode, setMode] = useState<'ai' | 'manual'>('manual');

  return (
    <PageContainer>
      <WorkspaceHeader title="New Test" subtitle="Build a sectioned, proctored assessment — MCQs, coding problems with test cases, or both. It saves as a draft until approved, then you decide who to send it to." />

      <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 mb-6 w-fit">
        <button onClick={() => setMode('manual')} className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${mode === 'manual' ? 'bg-violet-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
          <PencilLine className="w-4 h-4" /> Build Test
        </button>
        <button onClick={() => setMode('ai')} className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${mode === 'ai' ? 'bg-violet-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
          <Sparkles className="w-4 h-4" /> AI Draft
        </button>
      </div>

      {mode === 'ai' ? <AiDraftForm basePath={basePath} /> : <ManualTestBuilder basePath={basePath} />}
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
