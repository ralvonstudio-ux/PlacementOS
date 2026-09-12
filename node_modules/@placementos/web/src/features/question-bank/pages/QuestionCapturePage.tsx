import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Camera, FileText, Upload, Loader2, CheckCircle2 } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { useMyBatchTracks } from '@/features/training-schedule/hooks/useTrainingSchedule';
import {
  useExtractFromImage,
  useExtractFromPdf,
  useExtractChapter,
  useReExtractSource,
  useExtractionJob,
  useConfirmExtracted,
} from '../hooks/useQuestionBank';
import { ExtractedDraftCard } from '../components/ExtractedDraftCard';
import { extractErrorMessage } from '@/services/api';
import type { ExtractedQuestionDraft, ModuleCaptureJobResult, QuestionExtractionResult, TextExtractionResult } from '@placementos/types';

type Mode = 'photo' | 'pdf';
type Step = 'form' | 'processing' | 'review' | 'done';

function draftsFromResult(result: QuestionExtractionResult | TextExtractionResult | ModuleCaptureJobResult | undefined): ExtractedQuestionDraft[] {
  if (!result || !('extracted' in result || 'questions' in result)) return [];
  if ('extracted' in result) return result.extracted;
  return result.questions ?? [];
}

export function QuestionCapturePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { batchTracks } = useMyBatchTracks();

  const initialBatch = searchParams.get('batch') ?? batchTracks[0]?.batch ?? '';
  const initialTrack = searchParams.get('track') ?? batchTracks[0]?.track ?? '';
  const [batch, setBatch] = useState(initialBatch);
  const [track, setTrack] = useState(initialTrack);
  const [moduleName, setModuleName] = useState('');
  const [mode, setMode] = useState<Mode>('photo');
  const [files, setFiles] = useState<File[]>([]);
  const [detectImages, setDetectImages] = useState(false);
  const [step, setStep] = useState<Step>('form');
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState<ExtractedQuestionDraft[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<Set<number>>(new Set());
  const [warnings, setWarnings] = useState<string[]>([]);

  const extractImage = useExtractFromImage();
  const extractPdf = useExtractFromPdf();
  const extractChapter = useExtractChapter();
  const reExtract = useReExtractSource();
  const confirmExtracted = useConfirmExtracted();

  const jobQuery = useExtractionJob(step === 'processing' ? jobId : null);

  useEffect(() => {
    if (step !== 'processing' || !jobQuery.data) return;
    if (jobQuery.data.status === 'completed') {
      const extracted = draftsFromResult(jobQuery.data.result);
      setDrafts(extracted);
      setSelectedIdx(new Set(extracted.map((_, i) => i)));
      if (jobQuery.data.result && 'warnings' in jobQuery.data.result && jobQuery.data.result.warnings) {
        setWarnings(jobQuery.data.result.warnings);
      }
      setStep('review');
    } else if (jobQuery.data.status === 'failed') {
      setError(jobQuery.data.error ?? 'Extraction failed — please try again.');
      setStep('form');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobQuery.data, step]);

  async function handleSubmit() {
    if (!batch || !track || !moduleName.trim() || files.length === 0) return;
    setError('');
    try {
      if (mode === 'pdf') {
        const textResult = await extractPdf.mutateAsync({ file: files[0], batch, track, trainingModuleName: moduleName.trim() });
        const { jobId: id } = await reExtract.mutateAsync({ sourceId: textResult.sourceId, options: { count: 20, difficulty: 'mixed', includeImages: false } });
        setJobId(id);
      } else if (files.length === 1) {
        const { jobId: id } = await extractImage.mutateAsync({ file: files[0], batch, track, trainingModuleName: moduleName.trim(), detectImages });
        setJobId(id);
      } else {
        const { jobId: id } = await extractChapter.mutateAsync({ files, batch, track, trainingModuleName: moduleName.trim(), detectImages });
        setJobId(id);
      }
      setStep('processing');
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  function updateDraft(index: number, patch: Partial<ExtractedQuestionDraft>) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function toggleSelected(index: number) {
    setSelectedIdx((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleConfirm() {
    const selected = drafts.filter((_, i) => selectedIdx.has(i));
    if (selected.length === 0) return;
    setError('');
    try {
      await confirmExtracted.mutateAsync({ batch, track, questions: selected });
      setStep('done');
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  const isSubmitting = extractImage.isPending || extractPdf.isPending || extractChapter.isPending || reExtract.isPending;

  return (
    <PageContainer>
      <WorkspaceHeader title="Capture from Photo / PDF" subtitle="Upload material and let AI draft questions from it" />

      {error && (
        <div className="mb-6 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {step === 'form' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-xl space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Batch</label>
              <select value={batch} onChange={(e) => setBatch(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500">
                {[...new Set(batchTracks.map((b) => b.batch))].map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Track</label>
              <select value={track} onChange={(e) => setTrack(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500">
                {batchTracks.filter((b) => b.batch === batch).map((b) => <option key={b.track} value={b.track}>{b.track}</option>)}
                {batchTracks.filter((b) => b.batch === batch).length === 0 && <option value={track}>{track}</option>}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Training Module</label>
            <input
              type="text"
              value={moduleName}
              onChange={(e) => setModuleName(e.target.value)}
              placeholder="e.g. Arrays & Strings, Verbal Ability"
              required
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Source</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setMode('photo'); setFiles([]); }}
                className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border text-sm font-semibold transition-colors ${mode === 'photo' ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-violet-300'}`}
              >
                <Camera className="w-4 h-4" />
                Photo(s)
              </button>
              <button
                type="button"
                onClick={() => { setMode('pdf'); setFiles([]); }}
                className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border text-sm font-semibold transition-colors ${mode === 'pdf' ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-violet-300'}`}
              >
                <FileText className="w-4 h-4" />
                PDF
              </button>
            </div>
          </div>

          <div>
            <label className="flex items-center justify-center gap-2 h-24 rounded-xl border-2 border-dashed border-gray-200 hover:border-violet-300 cursor-pointer transition-colors text-sm text-gray-500">
              <Upload className="w-5 h-5 text-gray-400" />
              {files.length > 0 ? `${files.length} file(s) selected` : mode === 'photo' ? 'Choose one or more photos' : 'Choose a PDF file'}
              <input
                type="file"
                accept={mode === 'photo' ? 'image/*' : 'application/pdf'}
                multiple={mode === 'photo'}
                capture={mode === 'photo' ? 'environment' : undefined}
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                className="hidden"
              />
            </label>
          </div>

          {mode === 'photo' && (
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={detectImages} onChange={(e) => setDetectImages(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
              Detect diagrams/figures for picture-based questions
            </label>
          )}

          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !batch || !track || !moduleName.trim() || files.length === 0}
            className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Extract Questions
          </button>
        </div>
      )}

      {step === 'processing' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 flex flex-col items-center text-center max-w-xl">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin mb-4" />
          <p className="text-sm font-semibold text-gray-900">Reading your upload…</p>
          {jobQuery.data?.totalPages && (
            <p className="text-xs text-gray-500 mt-1">
              Page {jobQuery.data.completedPages ?? 0} of {jobQuery.data.totalPages}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-2">This can take up to a minute for longer uploads.</p>
        </div>
      )}

      {step === 'review' && (
        <div className="max-w-3xl">
          {warnings.length > 0 && (
            <div className="mb-4 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 space-y-1">
              {warnings.map((w, i) => <p key={i} className="text-sm text-amber-700">{w}</p>)}
            </div>
          )}

          {drafts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-sm text-gray-500">
              No questions could be drafted from this upload. Try a clearer photo or a different page.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500">{selectedIdx.size} of {drafts.length} selected</p>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedIdx(new Set(drafts.map((_, i) => i)))} className="text-xs font-medium text-violet-600 hover:text-violet-700">Select all</button>
                  <button onClick={() => setSelectedIdx(new Set())} className="text-xs font-medium text-gray-500 hover:text-gray-700">Clear</button>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {drafts.map((draft, i) => (
                  <ExtractedDraftCard
                    key={i}
                    draft={draft}
                    index={i}
                    selected={selectedIdx.has(i)}
                    onToggle={() => toggleSelected(i)}
                    onChange={(patch) => updateDraft(i, patch)}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between">
                <button onClick={() => setStep('form')} className="h-10 px-4 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                  Start Over
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={confirmExtracted.isPending || selectedIdx.size === 0}
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-green-600 hover:bg-green-700 text-sm font-semibold text-white transition-colors disabled:opacity-50"
                >
                  {confirmExtracted.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Save {selectedIdx.size} Question{selectedIdx.size === 1 ? '' : 's'} to Bank
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 'done' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 flex flex-col items-center text-center max-w-xl">
          <CheckCircle2 className="w-10 h-10 text-green-500 mb-4" />
          <p className="text-base font-semibold text-gray-900">Questions saved to the bank</p>
          <button
            onClick={() => navigate(`/faculty/question-bank?batch=${encodeURIComponent(batch)}&track=${encodeURIComponent(track)}`)}
            className="mt-5 h-10 px-5 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors"
          >
            Back to Question Bank
          </button>
        </div>
      )}
    </PageContainer>
  );
}
