import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Save, Loader2, Download, Plus, Trash2, FileText, Image as ImageIcon } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { useWorksheet, useUpdateWorksheet } from '../hooks/useWorksheets';
import { WorksheetPrintView } from '../components/WorksheetPrintView';
import { extractErrorMessage } from '@/services/api';
import type { BankWorksheetQuestion } from '@placementos/types';

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

export function WorksheetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: worksheet, isLoading } = useWorksheet(id ?? '');
  const { mutateAsync: update, isPending: isSaving } = useUpdateWorksheet(id ?? '');

  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<BankWorksheetQuestion[]>([]);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!worksheet) return;
    setTitle(worksheet.title);
    setQuestions(worksheet.questions);
  }, [worksheet]);

  function updateQuestion(i: number, patch: Partial<BankWorksheetQuestion>) {
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }

  function updateOption(qi: number, oi: number, value: string) {
    setQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== qi) return q;
        const options = [...(q.options ?? [])];
        options[oi] = value;
        return { ...q, options };
      })
    );
  }

  function addOption(qi: number) {
    setQuestions((prev) => prev.map((q, idx) => (idx === qi ? { ...q, options: [...(q.options ?? []), ''] } : q)));
  }

  function removeOption(qi: number, oi: number) {
    setQuestions((prev) =>
      prev.map((q, idx) => (idx === qi ? { ...q, options: (q.options ?? []).filter((_, o) => o !== oi) } : q))
    );
  }

  async function handleSave() {
    setStatus(null);
    try {
      await update({
        title: title.trim(),
        questions: questions.map((q) => ({
          questionText: q.questionText,
          options: q.options,
          difficulty: q.difficulty,
          estimatedTimeMinutes: q.estimatedTimeMinutes,
        })),
      });
      setStatus({ type: 'success', message: 'Worksheet saved.' });
    } catch (err) {
      setStatus({ type: 'error', message: extractErrorMessage(err) });
    }
  }

  if (isLoading || !worksheet) {
    return (
      <PageContainer>
        <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
      </PageContainer>
    );
  }

  const isAttachment = worksheet.sourceType === 'photo_upload';
  const isImage = worksheet.attachmentUrl?.match(/^data:image|\.(jpe?g|png|webp|gif)($|\?)/i) || worksheet.attachmentUrl?.startsWith('data:image');

  return (
    <>
      {/* Normal editing view — hidden entirely when printing. */}
      <div className="print:hidden">
        <PageContainer>
          <WorkspaceHeader
            title={isAttachment ? worksheet.title : 'Edit Worksheet'}
            subtitle={`${worksheet.batch} · ${worksheet.track} · ${worksheet.worksheetType}`}
            backTo="/faculty/worksheets"
            backLabel="Worksheets"
            action={
              !isAttachment && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 text-sm font-semibold text-gray-700 transition-colors"
                  >
                    <Download className="w-4 h-4" /> Download PDF
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving || !title.trim()}
                    className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save
                  </button>
                </div>
              )
            }
          />

          {status && (
            <div className={`mb-5 rounded-xl px-4 py-3 border ${status.type === 'success' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-600'}`}>
              <p className="text-sm">{status.message}</p>
            </div>
          )}

          {isAttachment ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                {isImage ? <ImageIcon className="w-4 h-4 text-violet-500" /> : <FileText className="w-4 h-4 text-violet-500" />}
                <p className="text-sm font-medium text-gray-700">{worksheet.attachmentFileName ?? 'Uploaded worksheet'}</p>
                <a
                  href={worksheet.attachmentUrl}
                  download={worksheet.attachmentFileName}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-violet-600 hover:bg-violet-700 text-xs font-semibold text-white transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </a>
              </div>
              {isImage ? (
                <img src={worksheet.attachmentUrl} alt={worksheet.title} className="w-full rounded-xl border border-gray-100" />
              ) : (
                <iframe src={worksheet.attachmentUrl} title={worksheet.title} className="w-full h-[80vh] rounded-xl border border-gray-100" />
              )}
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
                />
              </div>

              <div className="space-y-3">
                {questions.map((q, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-xs font-bold text-gray-400 mt-2.5 shrink-0">{i + 1}.</span>
                      <div className="flex-1 min-w-0 space-y-2">
                        <textarea
                          value={q.questionText}
                          onChange={(e) => updateQuestion(i, { questionText: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
                        />

                        {q.options && (
                          <div className="space-y-1.5 pl-1">
                            {q.options.map((opt, oi) => (
                              <div key={oi} className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 w-5 shrink-0">({String.fromCharCode(97 + oi)})</span>
                                <input
                                  value={opt}
                                  onChange={(e) => updateOption(i, oi, e.target.value)}
                                  className="flex-1 h-8 px-2.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
                                />
                                <button onClick={() => removeOption(i, oi)} className="p-1 text-gray-300 hover:text-red-600 transition-colors" aria-label="Remove option">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => addOption(i)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:text-violet-700 pl-7"
                            >
                              <Plus className="w-3 h-3" /> Add option
                            </button>
                          </div>
                        )}

                        <div className="flex items-center gap-3 pt-1">
                          <select
                            value={q.difficulty}
                            onChange={(e) => updateQuestion(i, { difficulty: e.target.value as BankWorksheetQuestion['difficulty'] })}
                            className="h-8 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
                          >
                            {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                          </select>
                          <input
                            type="number"
                            min={0}
                            value={q.estimatedTimeMinutes}
                            onChange={(e) => updateQuestion(i, { estimatedTimeMinutes: Number(e.target.value) })}
                            className="w-20 h-8 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
                          />
                          <span className="text-[11px] text-gray-400">minutes</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </PageContainer>
      </div>

      {/* Print-only output — the reference worksheet layout. Invisible on screen, shown only
          when the browser's print/"Save as PDF" dialog is triggered from the button above. */}
      {!isAttachment && (
        <div className="hidden print:block">
          <WorksheetPrintView
            title={title || worksheet.title}
            batch={worksheet.batch}
            track={worksheet.track}
            worksheetType={worksheet.worksheetType}
            questions={questions}
          />
        </div>
      )}
    </>
  );
}
