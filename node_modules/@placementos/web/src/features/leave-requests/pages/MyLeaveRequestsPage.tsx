import { useState } from 'react';
import { Plus, CalendarOff, X as CancelIcon } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useMyLeaveRequests, useCancelLeaveRequest } from '../hooks/useLeaveRequests';
import { LeaveStatusBadge } from '../components/LeaveStatusBadge';
import { ApplyLeaveModal } from '../components/ApplyLeaveModal';

function formatRange(from: string, to: string) {
  return from === to ? from : `${from} → ${to}`;
}

export function MyLeaveRequestsPage() {
  const { data: requests = [], isLoading } = useMyLeaveRequests();
  const { mutateAsync: cancel, isPending: isCancelling } = useCancelLeaveRequest();
  const [showApply, setShowApply] = useState(false);

  return (
    <PageContainer>
      <WorkspaceHeader
        title="Leave Requests"
        subtitle="Apply for leave and track your requests"
        action={
          <button
            onClick={() => setShowApply(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors"
          >
            <Plus className="w-4 h-4" />
            Apply for Leave
          </button>
        }
      />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl" />)}
          </div>
        ) : requests.length === 0 ? (
          <EmptyState
            icon={CalendarOff}
            title="No leave requests yet"
            description="Apply for leave and it will show up here."
            action={{ label: 'Apply for Leave', onClick: () => setShowApply(true) }}
          />
        ) : (
          <div className="divide-y divide-gray-50">
            {requests.map((req) => (
              <div key={req._id} className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{formatRange(req.fromDate, req.toDate)}</p>
                  <p className="text-sm text-gray-500 mt-0.5 truncate">{req.reason}</p>
                  {req.reviewNote && (
                    <p className="text-xs text-gray-400 mt-1">TPO note: {req.reviewNote}</p>
                  )}
                </div>
                <LeaveStatusBadge status={req.status} />
                {req.status === 'pending' && (
                  <button
                    onClick={() => cancel(req._id)}
                    disabled={isCancelling}
                    className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-red-600 transition-colors disabled:opacity-50"
                    title="Cancel request"
                  >
                    <CancelIcon className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showApply && <ApplyLeaveModal onClose={() => setShowApply(false)} />}
    </PageContainer>
  );
}
