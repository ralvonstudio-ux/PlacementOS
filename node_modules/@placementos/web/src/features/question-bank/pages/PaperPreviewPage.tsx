import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft, Loader2 } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { usePaper } from '../hooks/useQuestionBank';
import { CroppedFigure } from '../components/CroppedFigure';

export function PaperPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: paper, isLoading } = usePaper(id ?? null);
  const [showAnswerKey, setShowAnswerKey] = useState(false);

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
        </div>
      </PageContainer>
    );
  }

  if (!paper) return null;

  let counter = 0;

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6 print:hidden">
        <button onClick={() => navigate('/faculty/question-bank/papers')} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Papers
        </button>
        <div className="flex items-center gap-2">
          {paper.config.includeAnswerKey && (
            <button onClick={() => setShowAnswerKey((v) => !v)} className="h-9 px-3 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
              {showAnswerKey ? 'Hide' : 'Show'} Answer Key
            </button>
          )}
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-violet-600 hover:bg-violet-700 text-xs font-semibold text-white transition-colors">
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
        </div>
      </div>

      {(paper.validation.warnings.length > 0 || paper.validation.suggestions.length > 0) && (
        <div className="mb-6 space-y-2 print:hidden">
          {paper.validation.warnings.map((w, i) => (
            <div key={`w-${i}`} className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-sm text-amber-700">{w}</div>
          ))}
          {paper.validation.suggestions.map((s, i) => (
            <div key={`s-${i}`} className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-sm text-blue-700">{s}</div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-3xl mx-auto print:shadow-none print:border-none">
        <div className="text-center border-b border-gray-100 pb-5 mb-6">
          <h1 className="text-xl font-bold text-gray-900">{paper.config.examType}</h1>
          <p className="text-sm text-gray-500 mt-1">{paper.config.batch} · {paper.config.track}</p>
          <div className="flex items-center justify-center gap-4 mt-2 text-xs text-gray-400">
            <span>Total Marks: {paper.totalMarksAssembled}</span>
            {paper.config.durationMinutes && <span>Duration: {paper.config.durationMinutes} min</span>}
          </div>
        </div>

        {paper.sections.map((section, sIdx) => (
          <div key={sIdx} className="mb-8">
            {section.name && <h2 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">{section.name}</h2>}
            <div className="space-y-5">
              {section.questions.map((q) => {
                counter += 1;
                const resolvedImage = q.imageRef ? paper.resolvedImages?.[`${q.imageRef.sourceId}:${q.imageRef.figureId}`] : undefined;
                return (
                  <div key={q._id} className="flex gap-3">
                    <span className="text-sm font-semibold text-gray-400 shrink-0 w-6">{counter}.</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-gray-900">{q.questionText}</p>
                        <span className="text-xs text-gray-400 shrink-0">[{q.marks}]</span>
                      </div>
                      {resolvedImage && (
                        <div className="mt-2">
                          <CroppedFigure image={resolvedImage} />
                        </div>
                      )}
                      {q.questionType === 'mcq' && q.options && (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                          {q.options.map((opt, oi) => (
                            <p key={oi} className="text-sm text-gray-700">({String.fromCharCode(97 + oi)}) {opt}</p>
                          ))}
                        </div>
                      )}
                      {showAnswerKey && q.correctAnswer && (
                        <p className="text-xs text-green-700 font-medium mt-1.5">Answer: {q.correctAnswer}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
