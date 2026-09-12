import { useState } from 'react';
import { CheckCircle2, XCircle, ClipboardCheck } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePendingLeaveRequests, useApproveLeaveRequest, useRejectLeaveRequest } from '../hooks/useLeaveRequests';

function formatRange(from: string, to: string) {
  return from === to ? from : `${from} → ${to}`;
}

export function TpoLeaveApprovalsPage() {
  const { data: requests = [], isLoading } = usePendingLeaveRequests();
  const { mutateAsync: approve, isPending: isApproving } = useApproveLeaveRequest();
  const { mutateAsync: reject, isPending: isRejecting } = useRejectLeaveRequest();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  async function handleReject(id: string) {
    await reject({ id, payload: { reviewNote: reviewNote.trim() || undefined } });
    setRejectingId(null);
    setReviewNote('');
  }

  return (
    <PageContainer>
      <WorkspaceHeader title="Leave Approvals" subtitle="Review and act on pending faculty leave requests" />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}
          </div>
        ) : requests.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="All caught up" description="No leave requests are waiting on your review." />
        ) : (
          <div className="divide-y divide-gray-50">
            {requests.map((req) => (
              <div key={req._id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{req.facultyName ?? 'Unknown faculty'}</p>
                    <p className="text-sm text-gray-600 mt-0.5">{formatRange(req.fromDate, req.toDate)}</p>
                    <p className="text-sm text-gray-500 mt-1">{req.reason}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => approve(req._id)}
                      disabled={isApproving || isRejecting}
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-green-600 hover:bg-green-700 text-xs font-semibold text-white transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approve
                    </button>
                    <button
                      onClick={() => setRejectingId(rejectingId === req._id ? null : req._id)}
                      disabled={isApproving || isRejecting}
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject
                    </button>
                  </div>
                </div>

                {rejectingId === req._id && (
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="text"
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      placeholder="Reason for rejection (optional)"
                      className="flex-1 h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
                    />
                    <button
                      onClick={() => handleReject(req._id)}
                      disabled={isRejecting}
                      className="h-9 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-semibold text-white transition-colors disabled:opacity-50"
                    >
                      Confirm Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
