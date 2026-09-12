import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles, Plus, Trash2, Loader2 } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { useMyBatchTracks } from '@/features/training-schedule/hooks/useTrainingSchedule';
import { useModules, useGeneratePaper } from '../hooks/useQuestionBank';
import { extractErrorMessage } from '@/services/api';
import type { QuestionKind, PaperMarksBreakdownEntry } from '@placementos/types';

const QUESTION_TYPES: QuestionKind[] = ['mcq', 'short', 'long', 'true_false', 'fill_blank', 'very_short', 'numerical', 'case_study', 'hots'];

export function PaperGeneratorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { batchTracks } = useMyBatchTracks();

  const [batch, setBatch] = useState(searchParams.get('batch') ?? batchTracks[0]?.batch ?? '');
  const [track, setTrack] = useState(searchParams.get('track') ?? batchTracks[0]?.track ?? '');
  useEffect(() => {
    if (!searchParams.get('batch') && batchTracks[0]) {
      setBatch(batchTracks[0].batch);
      setTrack(batchTracks[0].track);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchTracks]);

  const { data: modules = [] } = useModules(batch, track);
  const [moduleIds, setModuleIds] = useState<string[]>([]);
  const [examType, setExamType] = useState('');
  const [breakdown, setBreakdown] = useState<PaperMarksBreakdownEntry[]>([{ marks: 1, count: 5 }]);
  const [difficultyMix, setDifficultyMix] = useState({ easy: 0, medium: 0, hard: 0 });
  const [questionTypes, setQuestionTypes] = useState<QuestionKind[]>([]);
  const [durationMinutes, setDurationMinutes] = useState<number | ''>('');
  const [includeAnswerKey, setIncludeAnswerKey] = useState(true);
  const [error, setError] = useState('');

  const { mutateAsync: generate, isPending } = useGeneratePaper();

  const totalMarks = breakdown.reduce((sum, b) => sum + b.marks * b.count, 0);

  function toggleModule(id: string) {
    setModuleIds((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  }

  function toggleType(t: QuestionKind) {
    setQuestionTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  function updateBreakdownRow(i: number, patch: Partial<PaperMarksBreakdownEntry>) {
    setBreakdown((prev) => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  async function handleGenerate() {
    if (!batch || !track || !examType.trim() || moduleIds.length === 0 || totalMarks === 0) return;
    setError('');
    try {
      const paper = await generate({
        batch,
        track,
        examType: examType.trim(),
        trainingModuleIds: moduleIds,
        totalMarks,
        difficultyMix,
        marksBreakdown: breakdown,
        questionTypes,
        durationMinutes: durationMinutes === '' ? undefined : durationMinutes,
        includeAnswerKey,
      });
      navigate(`/faculty/question-bank/papers/${paper._id}`);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <PageContainer>
      <WorkspaceHeader title="Generate Question Paper" subtitle="Assemble a paper from the bank, with AI filling any gaps" />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-2xl space-y-6">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Batch</label>
            <select value={batch} onChange={(e) => { setBatch(e.target.value); setModuleIds([]); }} className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500">
              {[...new Set(batchTracks.map((b) => b.batch))].map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Track</label>
            <select value={track} onChange={(e) => { setTrack(e.target.value); setModuleIds([]); }} className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500">
              {batchTracks.filter((b) => b.batch === batch).map((b) => <option key={b.track} value={b.track}>{b.track}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Exam Type / Title</label>
          <input type="text" value={examType} onChange={(e) => setExamType(e.target.value)} placeholder="e.g. Mock Test 1, Weekly Assessment" className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Training Modules</label>
          {modules.length === 0 ? (
            <p className="text-sm text-gray-400">No training modules yet for this batch/track.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {modules.map((m) => (
                <button key={m._id} type="button" onClick={() => toggleModule(m._id)} className={`h-8 px-3 rounded-full text-xs font-medium border transition-colors ${moduleIds.includes(m._id) ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-violet-300'}`}>
                  {m.moduleName}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Marks Breakdown</label>
            <button type="button" onClick={() => setBreakdown((prev) => [...prev, { marks: 1, count: 1 }])} className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700">
              <Plus className="w-3.5 h-3.5" />
              Add row
            </button>
          </div>
          <div className="space-y-2">
            {breakdown.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="number" min={0} value={row.count} onChange={(e) => updateBreakdownRow(i, { count: Number(e.target.value) })} placeholder="Count" className="h-9 w-24 px-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400" />
                <span className="text-xs text-gray-500">question(s) worth</span>
                <input type="number" min={0} value={row.marks} onChange={(e) => updateBreakdownRow(i, { marks: Number(e.target.value) })} placeholder="Marks" className="h-9 w-24 px-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400" />
                <span className="text-xs text-gray-500">mark(s) each</span>
                {breakdown.length > 1 && (
                  <button type="button" onClick={() => setBreakdown((prev) => prev.filter((_, idx) => idx !== i))} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors ml-auto">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">Total marks: <span className="font-semibold text-gray-600">{totalMarks}</span></p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty Mix (optional)</label>
          <div className="grid grid-cols-3 gap-2 max-w-xs">
            {(['easy', 'medium', 'hard'] as const).map((level) => (
              <div key={level}>
                <label className="block text-xs text-gray-500 mb-1 capitalize">{level}</label>
                <input type="number" min={0} value={difficultyMix[level]} onChange={(e) => setDifficultyMix((prev) => ({ ...prev, [level]: Number(e.target.value) }))} className="w-full h-9 px-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400" />
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Question Types (optional filter)</label>
          <div className="flex flex-wrap gap-2">
            {QUESTION_TYPES.map((t) => (
              <button key={t} type="button" onClick={() => toggleType(t)} className={`h-8 px-3 rounded-full text-xs font-medium border transition-colors ${questionTypes.includes(t) ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-violet-300'}`}>
                {t.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Duration (minutes, optional)</label>
            <input type="number" min={1} value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value === '' ? '' : Number(e.target.value))} className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 h-10">
            <input type="checkbox" checked={includeAnswerKey} onChange={(e) => setIncludeAnswerKey(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
            Include answer key
          </label>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={isPending || !batch || !track || !examType.trim() || moduleIds.length === 0 || totalMarks === 0}
          className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Generate Paper
        </button>
      </div>
    </PageContainer>
  );
}
