import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Plus, Trash2, Send, Lock } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTestList, usePublishTest, useCloseTest, useDeleteTest } from '../hooks/useTests';

const STATUS_CLASSES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  published: 'bg-green-100 text-green-700',
  closed: 'bg-red-100 text-red-600',
};

export function TpoTestsPage() {
  const navigate = useNavigate();
  const { data: tests = [], isLoading } = useTestList();
  const { mutate: publish } = usePublishTest();
  const { mutate: close } = useCloseTest();
  const { mutate: remove } = useDeleteTest();

  return (
    <PageContainer>
      <WorkspaceHeader
        title="Tests"
        subtitle="Create, publish, and review proctored assessments"
        action={
          <button onClick={() => navigate('/tpo/tests/new')} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors">
            <Plus className="w-4 h-4" /> New Test
          </button>
        }
      />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3 animate-pulse">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}</div>
        ) : tests.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No tests yet" description="Create your first proctored test." action={{ label: 'New Test', onClick: () => navigate('/tpo/tests/new') }} />
        ) : (
          <div className="divide-y divide-gray-50">
            {tests.map((t) => (
              <div key={t._id} className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{t.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t.batch}{t.track ? ` · ${t.track}` : ''} · {t.questions.length} questions · {t.totalMarks} marks · {t.durationMinutes} min · violation limit {t.violationLimit}</p>
                </div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_CLASSES[t.status]}`}>{t.status}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {t.status === 'draft' && (
                    <button onClick={() => publish(t._id)} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-green-600 hover:bg-green-700 text-xs font-semibold text-white transition-colors">
                      <Send className="w-3.5 h-3.5" /> Publish
                    </button>
                  )}
                  {t.status === 'published' && (
                    <button onClick={() => close(t._id)} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors">
                      <Lock className="w-3.5 h-3.5" /> Close
                    </button>
                  )}
                  <button onClick={() => navigate(`/tpo/tests/${t._id}/review`)} className="h-8 px-3 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors">
                    Review
                  </button>
                  {t.status === 'draft' && (
                    <button onClick={() => remove(t._id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
