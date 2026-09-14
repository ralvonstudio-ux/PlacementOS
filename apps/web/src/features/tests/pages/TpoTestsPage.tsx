import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Plus, Trash2, Send, Lock, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTestList, usePublishTest, useCloseTest, useDeleteTest, useSubmitTestForApproval, useReviewTest } from '../hooks/useTests';
import type { TestStatus } from '@placementos/types';

const STATUS_CLASSES: Record<TestStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  pending_approval: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-600',
  published: 'bg-green-100 text-green-700',
  closed: 'bg-gray-200 text-gray-500',
};

const STATUS_LABELS: Record<TestStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending approval',
  approved: 'Approved',
  rejected: 'Rejected',
  published: 'Published',
  closed: 'Closed',
};

/** Shared by both `/faculty/tests` and `/tpo/tests` — the server already scopes the
 *  list to "my tests" for faculty and "everything" for tpo/admin (who need to see
 *  every pending submission to approve it), so this component only needs to vary
 *  which action buttons it shows per role. */
export function TpoTestsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canReview = user?.role === 'admin' || user?.role === 'tpo';
  const basePath = user?.role === 'faculty' ? '/faculty' : '/tpo';

  const { data: tests = [], isLoading } = useTestList();
  const { mutate: publish } = usePublishTest();
  const { mutate: close } = useCloseTest();
  const { mutate: remove } = useDeleteTest();
  const { mutate: submitForApproval, isPending: isSubmitting } = useSubmitTestForApproval();
  const { mutateAsync: review } = useReviewTest();
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  async function handleReject(id: string) {
    const reviewNote = window.prompt('Reason for rejecting this test (shown to the faculty member):') ?? undefined;
    setReviewingId(id);
    try {
      await review({ id, payload: { decision: 'rejected', reviewNote } });
    } finally {
      setReviewingId(null);
    }
  }

  async function handleApprove(id: string) {
    setReviewingId(id);
    try {
      await review({ id, payload: { decision: 'approved' } });
    } finally {
      setReviewingId(null);
    }
  }

  return (
    <PageContainer>
      <WorkspaceHeader
        title="Tests"
        subtitle={canReview ? 'Create, review, and publish proctored assessments' : 'Create tests and submit them for TPO/admin approval'}
        action={
          <button onClick={() => navigate(`${basePath}/tests/new`)} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors">
            <Plus className="w-4 h-4" /> New Test
          </button>
        }
      />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3 animate-pulse">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}</div>
        ) : tests.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No tests yet" description="Create your first proctored test." action={{ label: 'New Test', onClick: () => navigate(`${basePath}/tests/new`) }} />
        ) : (
          <div className="divide-y divide-gray-50">
            {tests.map((t) => (
              <div key={t._id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                    {t.title}
                    {t.aiGenerated && <span title="AI-drafted"><Sparkles className="w-3.5 h-3.5 text-violet-500 shrink-0" /></span>}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{t.batch}{t.track ? ` · ${t.track}` : ''} · {t.questions.length} questions · {t.totalMarks} marks · {t.durationMinutes} min · violation limit {t.violationLimit}</p>
                  {t.scheduledAt && <p className="text-xs text-violet-600 mt-0.5">Opens {new Date(t.scheduledAt).toLocaleString()}</p>}
                  {t.status === 'rejected' && t.reviewNote && (
                    <p className="text-xs text-red-600 mt-1">Rejected: {t.reviewNote}</p>
                  )}
                </div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_CLASSES[t.status]}`}>{STATUS_LABELS[t.status]}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {(t.status === 'draft' || t.status === 'rejected') && (
                    <button
                      onClick={() => submitForApproval(t._id)}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-xs font-semibold text-white transition-colors disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" /> Submit for Approval
                    </button>
                  )}
                  {canReview && t.status === 'pending_approval' && (
                    <>
                      <button
                        onClick={() => handleApprove(t._id)}
                        disabled={reviewingId === t._id}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition-colors disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => handleReject(t._id)}
                        disabled={reviewingId === t._id}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-red-200 hover:bg-red-50 text-xs font-semibold text-red-600 transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </>
                  )}
                  {t.status === 'approved' && (
                    <button onClick={() => publish(t._id)} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-green-600 hover:bg-green-700 text-xs font-semibold text-white transition-colors">
                      <Send className="w-3.5 h-3.5" /> Publish
                    </button>
                  )}
                  {t.status === 'published' && (
                    <button onClick={() => close(t._id)} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors">
                      <Lock className="w-3.5 h-3.5" /> Close
                    </button>
                  )}
                  <button onClick={() => navigate(`${basePath}/tests/${t._id}/review`)} className="h-8 px-3 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors">
                    Review
                  </button>
                  {(t.status === 'draft' || t.status === 'rejected') && (
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
