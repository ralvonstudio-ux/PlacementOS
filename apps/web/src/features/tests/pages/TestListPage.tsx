import { startTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, PlayCircle, CheckCircle2 } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useMyTests } from '../hooks/useTests';

export function TestListPage() {
  const navigate = useNavigate();
  const { data: tests = [], isLoading } = useMyTests();

  return (
    <PageContainer>
      <WorkspaceHeader title="Tests" subtitle="Proctored assessments assigned to your batch" />

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : tests.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No tests assigned yet" description="Published tests for your batch will show up here." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {tests.map((t) => (
            <div key={t._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-base font-semibold text-gray-900">{t.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{t.questionCount} questions · {t.totalMarks} marks · {t.durationMinutes} min</p>
                </div>
                {t.attemptStatus === 'submitted' && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Submitted
                  </span>
                )}
              </div>

              <p className="text-xs text-amber-600 mt-3">Violation limit: {t.violationLimit} — exceeding it auto-submits your attempt.</p>

              <button
                onClick={() => startTransition(() => navigate(`/candidate/tests/${t._id}/attempt`))}
                disabled={t.attemptStatus === 'submitted'}
                className="mt-4 inline-flex items-center justify-center gap-2 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <PlayCircle className="w-4 h-4" />
                {t.attemptStatus === 'in_progress' ? 'Resume Test' : t.attemptStatus === 'submitted' ? 'Already Submitted' : 'Start Test'}
              </button>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
