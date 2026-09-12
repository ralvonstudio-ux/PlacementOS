import { useParams } from 'react-router-dom';
import { ShieldAlert, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTestReview } from '../hooks/useTests';

export function TestReviewPage() {
  const { id } = useParams<{ id: string }>();
  const { data: review = [], isLoading } = useTestReview(id ?? null);
  const test = review[0]?.test;

  return (
    <PageContainer>
      <WorkspaceHeader title={test ? `Review — ${test.title}` : 'Test Review'} subtitle="Every candidate's attempt, score, and proctoring violation log" />

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : review.length === 0 ? (
        <EmptyState icon={ShieldAlert} title="No attempts yet" description="Once candidates start taking this test, their attempts will show up here." />
      ) : (
        <div className="space-y-3 max-w-4xl">
          {review.map((r) => (
            <div key={r.attempt._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{r.candidateName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Started {new Date(r.attempt.startedAt).toLocaleString()}
                    {r.attempt.submittedAt && ` · Submitted ${new Date(r.attempt.submittedAt).toLocaleString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.attempt.status === 'submitted' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Score: {r.attempt.score ?? '—'}/{test?.totalMarks}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
                      <Clock className="w-3.5 h-3.5" /> In progress
                    </span>
                  )}
                  {r.attempt.autoSubmitted && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 px-2.5 py-1 rounded-full">
                      <ShieldAlert className="w-3.5 h-3.5" /> Auto-submitted
                    </span>
                  )}
                </div>
              </div>

              {r.attempt.violations.length > 0 ? (
                <div className="border-t border-gray-50 pt-3 mt-1">
                  <p className="text-xs font-semibold text-gray-500 mb-2">{r.attempt.violations.length} violation(s) logged</p>
                  <div className="space-y-1">
                    {r.attempt.violations.map((v, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="font-medium">{v.type.replace(/_/g, ' ')}</span>
                        <span className="text-gray-400">{new Date(v.at).toLocaleTimeString()}</span>
                        {v.detail && <span className="text-gray-400">— {v.detail}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400 border-t border-gray-50 pt-3 mt-1">No violations recorded — clean attempt.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
