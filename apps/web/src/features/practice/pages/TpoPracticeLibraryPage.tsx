import { useState } from 'react';
import { BookMarked, Plus, Trash2 } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePracticeQuestions, useDeletePracticeQuestion } from '../hooks/usePractice';
import { AddPracticeQuestionModal } from '../components/AddPracticeQuestionModal';
import type { PracticeCategory } from '@placementos/types';

const CATEGORIES: { value: PracticeCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pi', label: 'PI' },
  { value: 'gd', label: 'GD' },
  { value: 'aptitude', label: 'Aptitude' },
  { value: 'reasoning', label: 'Reasoning' },
  { value: 'company', label: 'Company' },
];

export function TpoPracticeLibraryPage() {
  const [category, setCategory] = useState<PracticeCategory | 'all'>('all');
  const [showAdd, setShowAdd] = useState(false);
  const { data, isLoading } = usePracticeQuestions({ category: category === 'all' ? undefined : category, limit: 100 });
  const { mutate: deleteQuestion } = useDeletePracticeQuestion();

  const questions = data?.data ?? [];

  return (
    <PageContainer>
      <WorkspaceHeader
        title="Practice Library"
        subtitle="Manage PI, GD, aptitude, reasoning, and company-specific practice content"
        action={
          <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors">
            <Plus className="w-4 h-4" /> Add Question
          </button>
        }
      />

      <SectionTitle>Filter</SectionTitle>
      <div className="mb-6 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button key={c.value} onClick={() => setCategory(c.value)} className={`h-8 px-3.5 rounded-full text-xs font-medium border transition-colors ${category === c.value ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-violet-300'}`}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3 animate-pulse">{[1, 2, 3, 4].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl" />)}</div>
        ) : questions.length === 0 ? (
          <EmptyState icon={BookMarked} title="No questions yet" description="Add your first practice question." action={{ label: 'Add Question', onClick: () => setShowAdd(true) }} />
        ) : (
          <div className="divide-y divide-gray-50">
            {questions.map((q) => (
              <div key={q._id} className="flex items-start gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{q.questionText}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{q.category}</span>
                    {q.companyName && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">{q.companyName}</span>}
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{q.questionType}</span>
                    {q.difficulty && <span className="text-[11px] text-gray-400">{q.difficulty}</span>}
                  </div>
                </div>
                <button onClick={() => deleteQuestion(q._id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && <AddPracticeQuestionModal onClose={() => setShowAdd(false)} />}
    </PageContainer>
  );
}
