import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Plus, Trash2, Send, Lock, CheckCircle2, XCircle, Sparkles, KeyRound, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { CandidatePicker } from '@/features/messages/components/CandidatePicker';
import {
  useTestList,
  useDeleteTest,
  useSubmitTestForApproval,
  useReviewTest,
  useAssignments,
  useCreateAssignment,
  useCloseAssignment,
} from '../hooks/useTests';
import { extractErrorMessage } from '@/services/api';
import type { Test, TestStatus, TestAssignmentTargetType } from '@placementos/types';

const STATUS_CLASSES: Record<TestStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  pending_approval: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-600',
};

const STATUS_LABELS: Record<TestStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending approval',
  approved: 'Approved',
  rejected: 'Rejected',
};

const inputCls = 'w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500';

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
  const { mutate: remove } = useDeleteTest();
  const { mutate: submitForApproval, isPending: isSubmitting } = useSubmitTestForApproval();
  const { mutateAsync: review } = useReviewTest();
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);

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
        subtitle={canReview ? 'Create, approve, and assign proctored tests' : 'Create tests and submit them for TPO/admin approval'}
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
              <TestRow
                key={t._id}
                test={t}
                canReview={canReview}
                isSubmitting={isSubmitting}
                reviewingId={reviewingId}
                expanded={expandedId === t._id}
                assigning={assigningId === t._id}
                onToggleExpand={() => setExpandedId((cur) => (cur === t._id ? null : t._id))}
                onToggleAssign={() => setAssigningId((cur) => (cur === t._id ? null : t._id))}
                onSubmitForApproval={() => submitForApproval(t._id)}
                onApprove={() => handleApprove(t._id)}
                onReject={() => handleReject(t._id)}
                onRemove={() => remove(t._id)}
                onNavigate={() => navigate(`${basePath}/tests/${t._id}/review`)}
              />
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}

function TestRow({
  test: t,
  canReview,
  isSubmitting,
  reviewingId,
  expanded,
  assigning,
  onToggleExpand,
  onToggleAssign,
  onSubmitForApproval,
  onApprove,
  onReject,
  onRemove,
  onNavigate,
}: {
  test: Test;
  canReview: boolean;
  isSubmitting: boolean;
  reviewingId: string | null;
  expanded: boolean;
  assigning: boolean;
  onToggleExpand: () => void;
  onToggleAssign: () => void;
  onSubmitForApproval: () => void;
  onApprove: () => void;
  onReject: () => void;
  onRemove: () => void;
  onNavigate: () => void;
}) {
  // Always fetched (not just while expanded) so the "N sent" count on the collapsed row stays
  // accurate right after assigning — react-query already dedupes/caches this per test id.
  const { data: assignments = [] } = useAssignments(t.status === 'approved' ? t._id : '');

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 px-5 py-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            {t.title}
            {t.aiGenerated && <span title="AI-drafted"><Sparkles className="w-3.5 h-3.5 text-violet-500 shrink-0" /></span>}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {t.track ? `${t.track} · ` : ''}{t.questions.length} questions · {t.totalMarks} marks · {t.durationMinutes} min · violation limit {t.violationLimit}
          </p>
          {t.status === 'rejected' && t.reviewNote && <p className="text-xs text-red-600 mt-1">Rejected: {t.reviewNote}</p>}
        </div>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_CLASSES[t.status]}`}>{STATUS_LABELS[t.status]}</span>
        <div className="flex items-center gap-2 shrink-0">
          {(t.status === 'draft' || t.status === 'rejected') && (
            <button
              onClick={onSubmitForApproval}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-xs font-semibold text-white transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" /> Submit for Approval
            </button>
          )}
          {canReview && t.status === 'pending_approval' && (
            <>
              <button onClick={onApprove} disabled={reviewingId === t._id} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition-colors disabled:opacity-50">
                <CheckCircle2 className="w-3.5 h-3.5" /> Approve
              </button>
              <button onClick={onReject} disabled={reviewingId === t._id} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-red-200 hover:bg-red-50 text-xs font-semibold text-red-600 transition-colors disabled:opacity-50">
                <XCircle className="w-3.5 h-3.5" /> Reject
              </button>
            </>
          )}
          {t.status === 'approved' && (
            <button onClick={onToggleAssign} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-green-600 hover:bg-green-700 text-xs font-semibold text-white transition-colors">
              <Send className="w-3.5 h-3.5" /> {assigning ? 'Cancel' : 'Assign'}
            </button>
          )}
          {t.status === 'approved' && (
            <button onClick={onToggleExpand} className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors">
              {assignments.length} sent {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
          <button onClick={onNavigate} className="h-8 px-3 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors">
            Review
          </button>
          {(t.status === 'draft' || t.status === 'rejected') && (
            <button onClick={onRemove} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {assigning && (
        <div className="px-5 pb-4">
          <AssignForm testId={t._id} onDone={onToggleAssign} />
        </div>
      )}

      {expanded && (
        <div className="px-5 pb-4 space-y-2">
          {assignments.length === 0 ? (
            <p className="text-xs text-gray-400">Not assigned to anyone yet.</p>
          ) : (
            assignments.map((a) => <AssignmentRow key={a._id} assignmentId={a._id} target={a.targetType === 'batch' ? a.batch ?? '' : `${a.candidateIds?.length ?? 0} students`} status={a.status} scheduledAt={a.scheduledAt} codeIssued={a.codeIssued} />)
          )}
        </div>
      )}
    </div>
  );
}

function AssignmentRow({ assignmentId, target, status, scheduledAt, codeIssued }: { assignmentId: string; target: string; status: 'active' | 'closed'; scheduledAt?: string; codeIssued: boolean }) {
  const navigate = useNavigate();
  const { mutate: close } = useCloseAssignment();

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 px-4 py-2.5">
      <Users className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      <span className="text-sm text-gray-700 flex-1 min-w-0">{target}</span>
      {scheduledAt && <span className="text-xs text-violet-600">Opens {new Date(scheduledAt).toLocaleString()}</span>}
      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
        {status === 'active' ? 'Active' : 'Closed'}
      </span>
      {status === 'active' && (
        <>
          <button
            onClick={() => navigate(`/messages?assignmentId=${assignmentId}`)}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-xs font-semibold text-white transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5" /> {codeIssued ? 'Resend Code' : 'Send Access Code'}
          </button>
          <button onClick={() => close(assignmentId)} className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors">
            <Lock className="w-3.5 h-3.5" /> Close
          </button>
        </>
      )}
    </div>
  );
}

function AssignForm({ testId, onDone }: { testId: string; onDone: () => void }) {
  const { mutateAsync, isPending } = useCreateAssignment();
  const [targetType, setTargetType] = useState<TestAssignmentTargetType>('batch');
  const [batch, setBatch] = useState('');
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [scheduledAt, setScheduledAt] = useState('');
  const [error, setError] = useState('');

  const canSubmit = targetType === 'batch' ? !!batch.trim() : selectedCandidates.size > 0;

  async function handleSubmit() {
    setError('');
    if (!canSubmit) return;
    try {
      await mutateAsync({
        testId,
        payload: {
          targetType,
          batch: targetType === 'batch' ? batch.trim() : undefined,
          candidateIds: targetType === 'candidates' ? [...selectedCandidates] : undefined,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        },
      });
      onDone();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 space-y-3 max-w-xl">
      <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTargetType('batch')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${targetType === 'batch' ? 'bg-violet-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Whole batch
        </button>
        <button
          onClick={() => setTargetType('candidates')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${targetType === 'candidates' ? 'bg-violet-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Specific students
        </button>
      </div>

      {targetType === 'batch' ? (
        <input value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="Batch (e.g. 2026-CSE)" className={inputCls} />
      ) : (
        <div className="space-y-2">
          <input value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="Batch to pick students from" className={inputCls} />
          {batch.trim() && (
            <div className="bg-white border border-gray-200 rounded-lg p-2">
              <CandidatePicker batch={batch.trim()} selected={selectedCandidates} onChange={setSelectedCandidates} />
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-xs text-gray-500 mb-1">Opens at (optional — leave blank to allow starting as soon as the code is sent)</label>
        <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className={inputCls} />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={isPending || !canSubmit}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-green-600 hover:bg-green-700 text-xs font-semibold text-white transition-colors disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" /> Assign
        </button>
      </div>
    </div>
  );
}
