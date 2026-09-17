import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { KeyRound, MessageSquare, Send, Loader2, CheckCircle2, Inbox, CheckCheck, X, AlertTriangle, Users, GraduationCap } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useAllAssignments, useSendAccessCode } from '@/features/tests/hooks/useTests';
import {
  useMyNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useSendStaffMessage,
  useBroadcasts,
  useBroadcastRecipients,
} from '@/features/notifications/hooks/useNotifications';
import { extractErrorMessage } from '@/services/api';
import { candidatesApi } from '@/features/candidates/api/candidates.api';
import { CandidatePicker } from '../components/CandidatePicker';
import { FacultyPicker } from '../components/FacultyPicker';
import type { NotificationType } from '@placementos/types';

const NOTIFICATION_ICON: Record<NotificationType, typeof KeyRound> = {
  test_access_code: KeyRound,
  staff_message: MessageSquare,
};

const AUDIENCE_OPTIONS: { value: 'students' | 'faculty' | 'both'; label: string; icon: typeof GraduationCap }[] = [
  { value: 'students', label: 'Students', icon: GraduationCap },
  { value: 'faculty', label: 'Faculty', icon: Users },
  { value: 'both', label: 'Both', icon: Send },
];

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const tabCls = (active: boolean) =>
  `inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold transition-colors ${
    active ? 'bg-violet-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
  }`;

/** Modal listing every recipient of one broadcast and whether/when they've acknowledged it —
 *  opened by clicking a broadcast's "x/y acknowledged" count. */
function BroadcastRecipientsModal({ broadcastId, onClose }: { broadcastId: string; onClose: () => void }) {
  const { data: recipients = [], isLoading } = useBroadcastRecipients(broadcastId);
  const acknowledgedCount = recipients.filter((r) => r.acknowledgedAt).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Acknowledgement status</h2>
            <p className="text-xs text-gray-500 mt-0.5">{acknowledgedCount}/{recipients.length} acknowledged</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
          {isLoading ? (
            <div className="p-5 space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-9 bg-gray-100 rounded-lg animate-pulse" />)}</div>
          ) : recipients.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No recipients found.</p>
          ) : (
            recipients.map((r) => (
              <div key={`${r.recipientRole}-${r.recipientId}`} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{r.name}</p>
                  <p className="text-xs text-gray-400 capitalize">{r.recipientRole}</p>
                </div>
                {r.acknowledgedAt ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-2 py-1 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledged
                  </span>
                ) : (
                  <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-full">Pending</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/** List of past "Send Message" broadcasts with a live acknowledgement count — clicking the
 *  count opens the full per-recipient breakdown. */
function BroadcastHistory({ onOpenRecipients }: { onOpenRecipients: (broadcastId: string) => void }) {
  const { data: broadcasts = [], isLoading } = useBroadcasts();
  const messageBroadcasts = broadcasts.filter((b) => b.recipientCount > 0);

  if (isLoading) {
    return <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>;
  }
  if (messageBroadcasts.length === 0) {
    return <p className="text-sm text-gray-400 py-6 text-center">No messages sent yet.</p>;
  }

  return (
    <div className="space-y-2">
      {messageBroadcasts.map((b) => (
        <div key={b.broadcastId} className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-900 truncate">{b.title}</p>
                {b.priority === 'high' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full shrink-0">
                    <AlertTriangle className="w-3 h-3" /> High
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{b.body}</p>
              <p className="text-[11px] text-gray-400 mt-1.5">
                {b.audience.map((a) => (a === 'candidate' ? 'Students' : 'Faculty')).join(' + ')} · {timeAgo(b.createdAt)}
              </p>
            </div>
            <button
              onClick={() => onOpenRecipients(b.broadcastId)}
              className="shrink-0 text-xs font-semibold text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              {b.acknowledgedCount}/{b.recipientCount} acknowledged
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** TPO/admin/faculty compose view: two flows, both one-way (staff → recipients) —
 *  send a test's access code to a chosen roster, or a free-form announcement to
 *  students, faculty, or both, at normal or high priority. */
function StaffMessagesView() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<'code' | 'message'>('code');

  // ── Send Access Code ──────────────────────────────────────────────────────
  const { data: assignments = [] } = useAllAssignments();
  const [assignmentId, setAssignmentId] = useState('');

  // Arriving from an assignment's "Send Access Code" shortcut (?assignmentId=...) preselects it
  // once the active-assignments list has loaded enough to contain it.
  useEffect(() => {
    const fromQuery = searchParams.get('assignmentId');
    if (fromQuery && !assignmentId && assignments.some((a) => a._id === fromQuery)) setAssignmentId(fromQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, assignments]);
  const selectedAssignment = assignments.find((a) => a._id === assignmentId);
  const [codeRecipients, setCodeRecipients] = useState<Set<string>>(new Set());
  const { mutateAsync: sendAccessCode, isPending: isSendingCode } = useSendAccessCode();
  const [codeResult, setCodeResult] = useState('');
  const [codeError, setCodeError] = useState('');

  // A "specific students" assignment already has its exact target list — no picker needed,
  // sending goes straight to everyone in it. A "batch" assignment still needs the roster picker
  // below so staff can choose who within the batch actually gets the code.
  const fixedRecipients = selectedAssignment?.targetType === 'candidates' ? selectedAssignment.candidateIds ?? [] : null;

  async function handleSendCode() {
    if (!selectedAssignment) return;
    const candidateIds = fixedRecipients ?? [...codeRecipients];
    if (candidateIds.length === 0) return;
    setCodeError('');
    setCodeResult('');
    try {
      const { sentCount } = await sendAccessCode({ id: selectedAssignment._id, payload: { candidateIds } });
      setCodeResult(`Access code sent to ${sentCount} candidate(s). Anyone sent a new code before will need this one instead.`);
      setCodeRecipients(new Set());
    } catch (err) {
      setCodeError(extractErrorMessage(err));
    }
  }

  // ── Send Message ──────────────────────────────────────────────────────────
  const [audience, setAudience] = useState<'students' | 'faculty' | 'both'>('students');
  const [priority, setPriority] = useState<'normal' | 'high'>('normal');
  const { data: batches = [] } = useQuery({ queryKey: ['messages', 'batches'], queryFn: candidatesApi.listBatches });
  const [batch, setBatch] = useState('');
  const [msgRecipients, setMsgRecipients] = useState<Set<string>>(new Set());
  const [facultyRecipients, setFacultyRecipients] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const { mutateAsync: sendMessage, isPending: isSendingMessage } = useSendStaffMessage();
  const [msgResult, setMsgResult] = useState('');
  const [msgError, setMsgError] = useState('');
  const [openBroadcastId, setOpenBroadcastId] = useState<string | null>(null);

  const includesStudents = audience === 'students' || audience === 'both';
  const includesFaculty = audience === 'faculty' || audience === 'both';
  const totalRecipients = (includesStudents ? msgRecipients.size : 0) + (includesFaculty ? facultyRecipients.size : 0);

  async function handleSendMessage() {
    if (!title.trim() || !body.trim() || totalRecipients === 0) return;
    setMsgError('');
    setMsgResult('');
    try {
      const { sentCount } = await sendMessage({
        candidateIds: includesStudents ? [...msgRecipients] : [],
        facultyIds: includesFaculty ? [...facultyRecipients] : [],
        title: title.trim(),
        body: body.trim(),
        priority,
      });
      setMsgResult(`Message sent to ${sentCount} recipient(s).`);
      setTitle('');
      setBody('');
      setMsgRecipients(new Set());
      setFacultyRecipients(new Set());
    } catch (err) {
      setMsgError(extractErrorMessage(err));
    }
  }

  const inputCls = 'w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500';

  return (
    <PageContainer narrow>
      <WorkspaceHeader title="Messages" subtitle="Send test access codes or announcements directly to chosen candidates and faculty" />

      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('code')} className={tabCls(tab === 'code')}><KeyRound className="w-4 h-4" /> Send Access Code</button>
        <button onClick={() => setTab('message')} className={tabCls(tab === 'message')}><MessageSquare className="w-4 h-4" /> Send Message</button>
      </div>

      {tab === 'code' ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <p className="text-xs text-gray-500 -mt-1">
            Sending (re)generates the test's access code and delivers it only to the candidates you pick below —
            no one else can see or retrieve it. A candidate can't start the test until this has been sent to them.
          </p>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Assignment</label>
            <select value={assignmentId} onChange={(e) => { setAssignmentId(e.target.value); setCodeRecipients(new Set()); }} className={inputCls}>
              <option value="">Select an active assignment…</option>
              {assignments.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.testTitle} — {a.targetType === 'batch' ? a.batch : `${a.candidateIds?.length ?? 0} students`}{a.track ? ` / ${a.track}` : ''}
                </option>
              ))}
            </select>
            {assignments.length === 0 && <p className="text-xs text-amber-600 mt-1.5">No active assignments yet — assign an approved test to a batch or students first.</p>}
          </div>

          {selectedAssignment && (fixedRecipients ? (
            <p className="text-sm text-gray-600 border border-gray-100 rounded-xl p-3">
              This assignment targets {fixedRecipients.length} specific student(s) — sending goes to all of them.
            </p>
          ) : (
            <div className="border border-gray-100 rounded-xl p-3">
              <CandidatePicker batch={selectedAssignment.batch ?? ''} selected={codeRecipients} onChange={setCodeRecipients} />
            </div>
          ))}

          {codeError && <p className="text-sm text-red-600">{codeError}</p>}
          {codeResult && (
            <p className="text-sm text-green-700 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> {codeResult}</p>
          )}

          <button
            onClick={handleSendCode}
            disabled={!selectedAssignment || (fixedRecipients ? fixedRecipients.length === 0 : codeRecipients.size === 0) || isSendingCode}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50"
          >
            {isSendingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Access Code{!fixedRecipients && codeRecipients.size > 0 ? ` (${codeRecipients.size})` : ''}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Send to</label>
              <div className="flex gap-2">
                {AUDIENCE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const active = audience === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setAudience(opt.value)}
                      className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-semibold border transition-colors ${
                        active ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" /> {opt.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">Choose whether this reaches students, faculty, or both.</p>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Priority</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPriority('normal')}
                  className={`h-9 px-3.5 rounded-lg text-sm font-semibold border transition-colors ${
                    priority === 'normal' ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => setPriority('high')}
                  className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-semibold border transition-colors ${
                    priority === 'high' ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-red-200 text-red-600 hover:bg-red-50'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" /> High
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                {priority === 'high'
                  ? "High priority blurs the recipient's screen and plays a sound until they acknowledge it."
                  : 'Normal priority just appears in their inbox and the notification bell.'}
              </p>
            </div>

            {includesStudents && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Batch / Class</label>
                <select value={batch} onChange={(e) => { setBatch(e.target.value); setMsgRecipients(new Set()); }} className={inputCls}>
                  <option value="">Select a batch…</option>
                  {batches.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                {batches.length === 0 && <p className="text-xs text-amber-600 mt-1.5">No batches found yet — add candidates first.</p>}
                {batch && (
                  <div className="border border-gray-100 rounded-xl p-3 mt-2">
                    <CandidatePicker batch={batch} selected={msgRecipients} onChange={setMsgRecipients} />
                  </div>
                )}
              </div>
            )}

            {includesFaculty && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Faculty</label>
                <div className="border border-gray-100 rounded-xl p-3">
                  <FacultyPicker selected={facultyRecipients} onChange={setFacultyRecipients} />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-500 mb-1">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Message title" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Message</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Write your message…" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500" />
            </div>

            {msgError && <p className="text-sm text-red-600">{msgError}</p>}
            {msgResult && (
              <p className="text-sm text-green-700 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> {msgResult}</p>
            )}

            <button
              onClick={handleSendMessage}
              disabled={!title.trim() || !body.trim() || totalRecipients === 0 || isSendingMessage}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50"
            >
              {isSendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send Message{totalRecipients > 0 ? ` (${totalRecipients})` : ''}
            </button>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent messages</h3>
            <BroadcastHistory onOpenRecipients={setOpenBroadcastId} />
          </div>

          {openBroadcastId && (
            <BroadcastRecipientsModal broadcastId={openBroadcastId} onClose={() => setOpenBroadcastId(null)} />
          )}
        </div>
      )}
    </PageContainer>
  );
}

/** Candidate/faculty-facing read-only view — the full-page counterpart to the notification bell. */
function CandidateMessagesView() {
  const { data } = useMyNotifications();
  const { mutate: markRead } = useMarkNotificationRead();
  const { mutate: markAllRead } = useMarkAllNotificationsRead();
  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <PageContainer narrow>
      <WorkspaceHeader
        title="Messages"
        subtitle="Access codes and announcements from your TPO/faculty"
        action={unreadCount > 0 ? (
          <button onClick={() => markAllRead()} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors">
            <CheckCheck className="w-3.5 h-3.5" /> Mark all read
          </button>
        ) : undefined}
      />

      {notifications.length === 0 ? (
        <EmptyState icon={Inbox} title="No messages yet" description="Access codes and announcements will show up here." />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden">
          {notifications.map((n) => {
            const Icon = NOTIFICATION_ICON[n.type] ?? MessageSquare;
            return (
              <button
                key={n._id}
                onClick={() => { if (!n.readAt) markRead(n._id); }}
                className={`w-full text-left px-5 py-4 transition-colors hover:bg-gray-50 ${!n.readAt ? 'bg-violet-50/40' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <Icon className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                      {n.priority === 'high' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full shrink-0">
                          <AlertTriangle className="w-3 h-3" /> High
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5 break-words">{n.body}</p>
                    <p className="text-xs text-gray-400 mt-1.5">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.readAt && <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0 mt-1.5" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}

export function MessagesPage() {
  const { user } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'tpo' || user?.role === 'faculty';
  return isStaff ? <StaffMessagesView /> : <CandidateMessagesView />;
}
