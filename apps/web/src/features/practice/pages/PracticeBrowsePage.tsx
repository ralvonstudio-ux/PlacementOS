import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePracticeQuestions, usePracticeCompanies } from '../hooks/usePractice';
import { PracticeQuestionCard } from '../components/PracticeQuestionCard';
import type { PracticeCategory } from '@placementos/types';

const CATEGORY_META: Record<PracticeCategory, { title: string; subtitle: string }> = {
  pi: { title: 'Personal Interview Questions', subtitle: 'Common PI questions with guidance on how to structure your answer' },
  gd: { title: 'Group Discussion Topics', subtitle: 'Topics to prepare talking points for before a GD round' },
  aptitude: { title: 'Aptitude Practice', subtitle: 'Quantitative aptitude questions with instant feedback' },
  reasoning: { title: 'Reasoning Practice', subtitle: 'Logical and analytical reasoning questions with instant feedback' },
  company: { title: 'Company-wise Questions', subtitle: 'Previously asked questions, grouped by company' },
};

export function PracticeBrowsePage() {
  const { category } = useParams<{ category: PracticeCategory }>();
  const meta = category ? CATEGORY_META[category] : undefined;
  const [company, setCompany] = useState<string | undefined>(undefined);

  const { data: companies = [] } = usePracticeCompanies();
  const { data, isLoading } = usePracticeQuestions({ category, companyName: category === 'company' ? company : undefined, limit: 100 });
  const questions = data?.data ?? [];

  return (
    <PageContainer>
      <WorkspaceHeader title={meta?.title ?? 'Practice'} subtitle={meta?.subtitle} />

      {category === 'company' && companies.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <button onClick={() => setCompany(undefined)} className={`h-8 px-3.5 rounded-full text-xs font-medium border transition-colors ${!company ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-violet-300'}`}>
            All
          </button>
          {companies.map((c) => (
            <button key={c} onClick={() => setCompany(c)} className={`h-8 px-3.5 rounded-full text-xs font-medium border transition-colors ${company === c ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-violet-300'}`}>
              {c}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : questions.length === 0 ? (
        <EmptyState icon={BookOpen} title="Nothing here yet" description="Your TPO or faculty haven't added practice material for this section yet." />
      ) : (
        <div className="space-y-3 max-w-3xl">
          {questions.map((q, i) => <PracticeQuestionCard key={q._id} question={q} index={i} />)}
        </div>
      )}
    </PageContainer>
  );
}
