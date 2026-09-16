import { useState } from 'react';
import { ArrowLeft, Download, FileCheck2, FileText, Image as ImageIcon } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useMyWorksheets, useMyWorksheet } from '../hooks/useWorksheets';
import { WorksheetPrintView } from '../components/WorksheetPrintView';

export function CandidateWorksheetsPage() {
  const { data: worksheets = [], isLoading } = useMyWorksheets();
  const [activeId, setActiveId] = useState<string | null>(null);

  if (activeId) return <CandidateWorksheetDetail id={activeId} onBack={() => setActiveId(null)} />;

  return (
    <PageContainer>
      <WorkspaceHeader title="Worksheets" subtitle="Shared by your faculty — open to review, or download as a PDF" />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : worksheets.length === 0 ? (
        <EmptyState icon={FileCheck2} title="No worksheets yet" description="Worksheets your faculty saves for your batch will appear here." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {worksheets.map((w) => (
            <button
              key={w._id}
              onClick={() => setActiveId(w._id)}
              className="text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                {w.title}
                {w.sourceType === 'photo_upload' && (w.attachmentFileName?.match(/\.pdf$/i) ? <FileText className="w-3.5 h-3.5 text-violet-500 shrink-0" /> : <ImageIcon className="w-3.5 h-3.5 text-violet-500 shrink-0" />)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {w.track} · {w.sourceType === 'photo_upload' ? 'Uploaded worksheet' : `${w.questions.length} question(s)`}
              </p>
            </button>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

function CandidateWorksheetDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { data: worksheet, isLoading } = useMyWorksheet(id);

  if (isLoading || !worksheet) {
    return (
      <PageContainer>
        <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
      </PageContainer>
    );
  }

  const isAttachment = worksheet.sourceType === 'photo_upload';
  const isImage = worksheet.attachmentUrl?.startsWith('data:image') || !!worksheet.attachmentUrl?.match(/\.(jpe?g|png|webp|gif)($|\?)/i);

  return (
    <>
      <div className="print:hidden">
        <PageContainer>
          <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to worksheets
          </button>
          <WorkspaceHeader
            title={worksheet.title}
            subtitle={`${worksheet.batch} · ${worksheet.track} · ${worksheet.worksheetType}`}
            action={
              isAttachment ? (
                <a
                  href={worksheet.attachmentUrl}
                  download={worksheet.attachmentFileName}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors"
                >
                  <Download className="w-4 h-4" /> Download
                </a>
              ) : (
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors"
                >
                  <Download className="w-4 h-4" /> Download PDF
                </button>
              )
            }
          />

          {isAttachment ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              {isImage ? (
                <img src={worksheet.attachmentUrl} alt={worksheet.title} className="w-full rounded-xl border border-gray-100" />
              ) : (
                <iframe src={worksheet.attachmentUrl} title={worksheet.title} className="w-full h-[80vh] rounded-xl border border-gray-100" />
              )}
            </div>
          ) : (
            <div className="space-y-3 max-w-3xl">
              {worksheet.questions.map((q, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                  <span className="text-xs font-semibold text-gray-400 mt-0.5">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">{q.questionText}</p>
                    {q.options && q.options.length > 0 && (
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-xs text-gray-500">
                        {q.options.map((opt, oi) => <span key={oi}>({String.fromCharCode(97 + oi)}) {opt}</span>)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </PageContainer>
      </div>

      {!isAttachment && (
        <div className="hidden print:block">
          <WorksheetPrintView
            title={worksheet.title}
            batch={worksheet.batch}
            track={worksheet.track}
            worksheetType={worksheet.worksheetType}
            questions={worksheet.questions}
          />
        </div>
      )}
    </>
  );
}
