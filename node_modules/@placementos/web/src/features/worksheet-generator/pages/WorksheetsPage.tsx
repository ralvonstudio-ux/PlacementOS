import { useState, useEffect } from 'react';
import { FileCheck2, Sparkles, Save, Loader2 } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { EmptyState } from '@/components/ui/EmptyState';
import { useMyBatchTracks } from '@/features/training-schedule/hooks/useTrainingSchedule';
import { useModules } from '@/features/question-bank/hooks/useQuestionBank';
import { useGenerateWorksheet, useSaveWorksheet, useWorksheetList } from '../hooks/useWorksheets';
import { extractErrorMessage } from '@/services/api';
import type { GeneratedWorksheetType, WorksheetDraft } from '@placementos/types';

const WORKSHEET_TYPES: { value: GeneratedWorksheetType; label: string }[] = [
  { value: 'practice', label: 'Practice' },
  { value: 'homework', label: 'Homework' },
  { value: 'revision', label: 'Revision' },
  { value: 'hots', label: 'HOTS' },
  { value: 'olympiad', label: 'Advanced' },
  { value: 'remedial', label: 'Remedial' },
];

export function WorksheetsPage() {
  const { batchTracks } = useMyBatchTracks();
  const [selected, setSelected] = useState<{ batch: string; track: string } | null>(null);
  useEffect(() => {
    if (!selected && batchTracks.length > 0) setSelected(batchTracks[0]);
  }, [batchTracks, selected]);

  const { data: modules = [] } = useModules(selected?.batch ?? '', selected?.track ?? '');
  const [moduleIds, setModuleIds] = useState<string[]>([]);
  const [worksheetType, setWorksheetType] = useState<GeneratedWorksheetType>('practice');
  const [questionCount, setQuestionCount] = useState(10);
  const [title, setTitle] = useState('');
  const [draft, setDraft] = useState<WorksheetDraft | null>(null);
  const [error, setError] = useState('');

  const { mutateAsync: generate, isPending: isGenerating } = useGenerateWorksheet();
  const { mutateAsync: save, isPending: isSaving } = useSaveWorksheet();
  const { data: savedPage } = useWorksheetList(selected ? { batch: selected.batch, track: selected.track, limit: 10 } : {});

  function toggleModule(id: string) {
    setModuleIds((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  }

  async function handleGenerate() {
    if (!selected || moduleIds.length === 0) return;
    setError('');
    setDraft(null);
    try {
      const result = await generate({ batch: selected.batch, track: selected.track, trainingModuleIds: moduleIds, worksheetType, questionCount });
      setDraft(result);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  async function handleSave() {
    if (!selected || !draft || !title.trim()) return;
    setError('');
    try {
      await save({
        batch: selected.batch,
        track: selected.track,
        trainingModuleIds: moduleIds,
        worksheetType,
        title: title.trim(),
        questions: draft.questions,
        addNewToBank: true,
      });
      setDraft(null);
      setTitle('');
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <PageContainer>
      <WorkspaceHeader title="Worksheets" subtitle="Generate a practice worksheet from the question bank" />

      {batchTracks.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {batchTracks.map((bt) => (
            <button
              key={`${bt.batch}-${bt.track}`}
              onClick={() => { setSelected(bt); setModuleIds([]); setDraft(null); }}
              className={`h-9 px-4 rounded-full text-sm font-medium border transition-colors ${
                selected?.batch === bt.batch && selected?.track === bt.track ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-violet-300'
              }`}
            >
              {bt.batch} · {bt.track}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-8">
        <SectionTitle>Generate</SectionTitle>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Training Modules</label>
            {modules.length === 0 ? (
              <p className="text-sm text-gray-400">No training modules yet for this batch/track.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {modules.map((m) => (
                  <button
                    key={m._id}
                    type="button"
                    onClick={() => toggleModule(m._id)}
                    className={`h-8 px-3 rounded-full text-xs font-medium border transition-colors ${
                      moduleIds.includes(m._id) ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-violet-300'
                    }`}
                  >
                    {m.moduleName}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 max-w-sm">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
              <select value={worksheetType} onChange={(e) => setWorksheetType(e.target.value as GeneratedWorksheetType)} className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500">
                {WORKSHEET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Question Count</label>
              <input type="number" min={1} max={50} value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500" />
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={isGenerating || moduleIds.length === 0}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate
          </button>
        </div>
      </div>

      {draft && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-8">
          <SectionTitle subtitle={`${draft.questions.length} question(s)`}>Preview</SectionTitle>

          <div className="space-y-3 mb-5">
            {draft.questions.map((q, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl bg-gray-50">
                <span className="text-xs font-semibold text-gray-400 mt-0.5">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{q.questionText}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white text-gray-600">{q.questionType.replace(/_/g, ' ')}</span>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white text-gray-600">{q.difficulty}</span>
                    {q.isNew && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">AI-authored</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Worksheet title"
              className="flex-1 h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
            />
            <button
              onClick={handleSave}
              disabled={isSaving || !title.trim()}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-green-600 hover:bg-green-700 text-sm font-semibold text-white transition-colors disabled:opacity-50 shrink-0"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Worksheet
            </button>
          </div>
        </div>
      )}

      <SectionTitle>Saved Worksheets</SectionTitle>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {(savedPage?.data.length ?? 0) === 0 ? (
          <EmptyState icon={FileCheck2} title="No worksheets saved yet" description="Generate one above and save it here." />
        ) : (
          <div className="divide-y divide-gray-50">
            {savedPage!.data.map((w) => (
              <div key={w._id} className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{w.title}</p>
                  <p className="text-xs text-gray-500">{w.trainingModuleNames.join(', ')} · {w.questions.length} questions</p>
                </div>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 shrink-0">{w.worksheetType}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
