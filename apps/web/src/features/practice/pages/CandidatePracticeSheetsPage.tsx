import { useState } from 'react';
import { ArrowLeft, BookMarked } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useMyPracticeSheets, useMySheetQuestions } from '../hooks/usePractice';
import { PracticeQuestionCard } from '../components/PracticeQuestionCard';

export function CandidatePracticeSheetsPage() {
  const { data: sheets = [], isLoading } = useMyPracticeSheets();
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const activeSheet = sheets.find((s) => s._id === activeSheetId);
  const { data: questions = [], isLoading: loadingQuestions } = useMySheetQuestions(activeSheetId);

  if (activeSheet) {
    return (
      <PageContainer>
        <button onClick={() => setActiveSheetId(null)} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to sheets
        </button>
        <WorkspaceHeader title={activeSheet.title} subtitle={`${activeSheet.batch} · ${questions.length} question(s)`} />
        {loadingQuestions ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
        ) : (
          <div className="space-y-3 max-w-3xl">
            {questions.map((q, i) => <PracticeQuestionCard key={q._id} question={q} index={i} />)}
          </div>
        )}
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <WorkspaceHeader title="Practice Sheets" subtitle="Curated sheets published by your TPO or faculty" />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : sheets.length === 0 ? (
        <EmptyState icon={BookMarked} title="No practice sheets yet" description="Sheets published for your batch will appear here." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sheets.map((s) => (
            <button key={s._id} onClick={() => setActiveSheetId(s._id)} className="text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <p className="text-sm font-semibold text-gray-900">{s.title}</p>
              <p className="text-xs text-gray-500 mt-1">{s.category} · {s.questionIds.length} question(s)</p>
            </button>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
