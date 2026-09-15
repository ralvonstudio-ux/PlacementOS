import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileCheck2, Sparkles, Save, Loader2, Library, UploadCloud, Camera, Image as ImageIcon, FileText } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { EmptyState } from '@/components/ui/EmptyState';
import { ContentSourceInput } from '@/features/content-extraction/components/ContentSourceInput';
import { useMyBatchTracks } from '@/features/training-schedule/hooks/useTrainingSchedule';
import { useModules } from '@/features/question-bank/hooks/useQuestionBank';
import {
  useGenerateWorksheet, useGenerateWorksheetFromContent, useSaveWorksheet, useWorksheetList, useUploadWorksheetAttachment,
} from '../hooks/useWorksheets';
import { extractErrorMessage } from '@/services/api';
import type { GeneratedWorksheetType, WorksheetDraft, WorksheetFromContentDraft } from '@placementos/types';

const WORKSHEET_TYPES: { value: GeneratedWorksheetType; label: string }[] = [
  { value: 'practice', label: 'Practice' },
  { value: 'homework', label: 'Homework' },
  { value: 'revision', label: 'Revision' },
  { value: 'hots', label: 'HOTS' },
  { value: 'olympiad', label: 'Advanced' },
  { value: 'remedial', label: 'Remedial' },
];

export function WorksheetsPage() {
  const navigate = useNavigate();
  const { batchTracks } = useMyBatchTracks();
  const [selected, setSelected] = useState<{ batch: string; track: string } | null>(null);
  useEffect(() => {
    if (!selected && batchTracks.length > 0) setSelected(batchTracks[0]);
  }, [batchTracks, selected]);

  const [source, setSource] = useState<'modules' | 'content' | 'photo'>('modules');
  const { data: savedPage } = useWorksheetList(selected ? { batch: selected.batch, track: selected.track, limit: 10 } : {});

  return (
    <PageContainer>
      <WorkspaceHeader title="Worksheets" subtitle="Generate a worksheet from the question bank, or straight from uploaded/pasted content" />

      {batchTracks.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {batchTracks.map((bt) => (
            <button
              key={`${bt.batch}-${bt.track}`}
              onClick={() => setSelected(bt)}
              className={`h-9 px-4 rounded-full text-sm font-medium border transition-colors ${
                selected?.batch === bt.batch && selected?.track === bt.track ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-violet-300'
              }`}
            >
              {bt.batch} · {bt.track}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 mb-6 w-fit">
        <button onClick={() => setSource('modules')} className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${source === 'modules' ? 'bg-violet-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
          <Library className="w-4 h-4" /> From Modules
        </button>
        <button onClick={() => setSource('content')} className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${source === 'content' ? 'bg-violet-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
          <UploadCloud className="w-4 h-4" /> From Content
        </button>
        <button onClick={() => setSource('photo')} className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${source === 'photo' ? 'bg-violet-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
          <Camera className="w-4 h-4" /> From Photo
        </button>
      </div>

      {selected && (
        source === 'modules' ? <FromModulesPanel selected={selected} /> :
        source === 'content' ? <FromContentPanel selected={selected} /> :
        <FromPhotoPanel selected={selected} />
      )}

      <SectionTitle>Saved Worksheets</SectionTitle>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {(savedPage?.data.length ?? 0) === 0 ? (
          <EmptyState icon={FileCheck2} title="No worksheets saved yet" description="Generate one above and save it here." />
        ) : (
          <div className="divide-y divide-gray-50">
            {savedPage!.data.map((w) => (
              <button
                key={w._id}
                onClick={() => navigate(`/faculty/worksheets/${w._id}`)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate flex items-center gap-1.5">
                    {w.title}
                    {w.sourceType === 'content_upload' && <span title="Generated from content"><Sparkles className="w-3.5 h-3.5 text-violet-500 shrink-0" /></span>}
                    {w.sourceType === 'photo_upload' && <span title="Uploaded worksheet">{w.attachmentFileName?.match(/\.pdf$/i) ? <FileText className="w-3.5 h-3.5 text-violet-500 shrink-0" /> : <ImageIcon className="w-3.5 h-3.5 text-violet-500 shrink-0" />}</span>}
                  </p>
                  <p className="text-xs text-gray-500">
                    {w.sourceType === 'photo_upload' ? 'Uploaded worksheet' : `${w.trainingModuleNames.join(', ')} · ${w.questions.length} questions`}
                  </p>
                </div>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 shrink-0">{w.worksheetType}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}

function FromPhotoPanel({ selected }: { selected: { batch: string; track: string } }) {
  const [title, setTitle] = useState('');
  const [worksheetType, setWorksheetType] = useState<GeneratedWorksheetType>('practice');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { mutateAsync: upload, isPending } = useUploadWorksheetAttachment();

  async function handleUpload() {
    if (!file || !title.trim()) return;
    setError('');
    setSuccess(false);
    try {
      await upload({ file, batch: selected.batch, track: selected.track, title: title.trim(), worksheetType });
      setSuccess(true);
      setFile(null);
      setTitle('');
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-8">
      <SectionTitle subtitle="Already have this worksheet on paper? Snap a photo (or upload a PDF) and it's listed exactly as-is — no AI rewriting, just digitized and shared with your students.">
        Upload an Existing Worksheet
      </SectionTitle>

      <div className="space-y-4 max-w-lg">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Worksheet title — e.g. Partnership Problems"
          className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
        />

        <select
          value={worksheetType}
          onChange={(e) => setWorksheetType(e.target.value as GeneratedWorksheetType)}
          className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
        >
          {WORKSHEET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
          capture="environment"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); e.target.value = ''; }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-24 rounded-xl border-2 border-dashed border-gray-300 hover:border-violet-400 hover:text-violet-600 text-sm font-medium text-gray-500 transition-colors flex flex-col items-center justify-center gap-1.5"
        >
          <Camera className="w-5 h-5" />
          {file ? file.name : 'Take a photo or upload a PDF'}
        </button>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        {success && (
          <div className="rounded-lg bg-green-50 border border-green-100 px-3 py-2">
            <p className="text-sm text-green-700">Worksheet uploaded — see it in Saved Worksheets below.</p>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={isPending || !file || !title.trim()}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
          {isPending ? 'Uploading…' : 'Upload & Save'}
        </button>
      </div>
    </div>
  );
}

function FromModulesPanel({ selected }: { selected: { batch: string; track: string } }) {
  const { data: modules = [] } = useModules(selected.batch, selected.track);
  const [moduleIds, setModuleIds] = useState<string[]>([]);
  const [worksheetType, setWorksheetType] = useState<GeneratedWorksheetType>('practice');
  const [questionCount, setQuestionCount] = useState(10);
  const [title, setTitle] = useState('');
  const [draft, setDraft] = useState<WorksheetDraft | null>(null);
  const [error, setError] = useState('');

  const { mutateAsync: generate, isPending: isGenerating } = useGenerateWorksheet();
  const { mutateAsync: save, isPending: isSaving } = useSaveWorksheet();

  function toggleModule(id: string) {
    setModuleIds((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  }

  async function handleGenerate() {
    if (moduleIds.length === 0) return;
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
    if (!draft || !title.trim()) return;
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
    <>
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
    </>
  );
}

function FromContentPanel({ selected }: { selected: { batch: string; track: string } }) {
  const [moduleName, setModuleName] = useState('');
  const [contentText, setContentText] = useState('');
  const [worksheetType, setWorksheetType] = useState<GeneratedWorksheetType>('practice');
  const [questionCount, setQuestionCount] = useState(10);
  const [title, setTitle] = useState('');
  const [draft, setDraft] = useState<WorksheetFromContentDraft | null>(null);
  const [error, setError] = useState('');

  const { mutateAsync: generate, isPending: isGenerating } = useGenerateWorksheetFromContent();
  const { mutateAsync: save, isPending: isSaving } = useSaveWorksheet();

  async function handleGenerate() {
    if (!moduleName.trim() || !contentText.trim()) return;
    setError('');
    setDraft(null);
    try {
      const result = await generate({ batch: selected.batch, track: selected.track, moduleName: moduleName.trim(), contentText: contentText.trim(), worksheetType, questionCount });
      setDraft(result);
      if (!title.trim()) setTitle(moduleName.trim());
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  async function handleSave() {
    if (!draft || !title.trim()) return;
    setError('');
    try {
      await save({
        batch: selected.batch,
        track: selected.track,
        trainingModuleIds: [],
        worksheetType,
        title: title.trim(),
        questions: draft.questions,
        addNewToBank: false,
        sourceType: 'content_upload',
        moduleName: moduleName.trim(),
        sourceContent: contentText.trim(),
        aiReview: draft.aiReview,
      });
      setDraft(null);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-8">
        <SectionTitle subtitle="Every question is authored fresh from what you paste or upload">Generate from Content</SectionTitle>

        <div className="space-y-4">
          <input
            value={moduleName}
            onChange={(e) => setModuleName(e.target.value)}
            placeholder="Topic / module name (e.g. Time & Work)"
            className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
          />

          <ContentSourceInput value={contentText} onChange={setContentText} placeholder="Paste the material this worksheet should be based on…" rows={8} />

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
            disabled={isGenerating || !moduleName.trim() || !contentText.trim()}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isGenerating ? 'Drafting…' : 'Generate'}
          </button>
        </div>
      </div>

      {draft && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-8">
          <SectionTitle subtitle={`${draft.questions.length} question(s)`}>Preview</SectionTitle>

          {draft.aiReview && (
            <div className="flex items-start gap-2 rounded-xl bg-violet-50 border border-violet-100 px-4 py-3 mb-4">
              <Sparkles className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
              <p className="text-xs text-violet-800 leading-relaxed">{draft.aiReview}</p>
            </div>
          )}

          <div className="space-y-3 mb-5">
            {draft.questions.map((q, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl bg-gray-50">
                <span className="text-xs font-semibold text-gray-400 mt-0.5">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{q.questionText}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white text-gray-600">{q.questionType.replace(/_/g, ' ')}</span>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white text-gray-600">{q.difficulty}</span>
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
    </>
  );
}
