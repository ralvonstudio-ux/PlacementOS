import { useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import {
  Activity, Download, Search, Loader2, Wifi, WifiOff, ShieldAlert, ChevronDown, ChevronRight, Globe, MonitorSmartphone, Unlock, Ban, AlertTriangle,
} from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { BackLink } from '@/components/workspace/BackLink';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { downloadCsv } from '@/lib/csv';
import { useTestMonitor, useAllowNewDevice, useForceSubmitAttempt } from '../hooks/useTests';
import type { TestAttemptEventType, TestMonitorRow, TestViolationType } from '@placementos/types';

type StatusFilter = 'all' | TestMonitorRow['status'] | 'live' | 'flagged';

const STATUS_STYLE: Record<TestMonitorRow['status'], { label: string; cls: string }> = {
  not_started: { label: 'Not started', cls: 'bg-gray-100 text-gray-600' },
  in_progress: { label: 'In progress', cls: 'bg-sky-50 text-sky-700' },
  submitted: { label: 'Submitted', cls: 'bg-green-50 text-green-700' },
  auto_submitted: { label: 'Ended by system', cls: 'bg-red-50 text-red-700' },
};

const EVENT_LABEL: Record<TestAttemptEventType, string> = {
  started: 'Started test',
  resumed: 'Resumed',
  session_takeover: 'New session took over',
  session_blocked: 'Login attempt blocked',
  ip_changed: 'IP address changed',
  violation: 'Violation',
  code_submitted: 'Code submitted',
  submitted: 'Submitted',
  auto_submitted: 'Ended by system',
  force_submitted: 'Ended by staff',
  new_device_allowed: 'New device allowed',
};

const EVENT_TONE: Partial<Record<TestAttemptEventType, string>> = {
  violation: 'text-red-600',
  session_blocked: 'text-red-600',
  auto_submitted: 'text-red-700 font-semibold',
  force_submitted: 'text-red-700 font-semibold',
  ip_changed: 'text-amber-600',
  session_takeover: 'text-amber-600',
  submitted: 'text-green-700 font-semibold',
};

const VIOLATION_SHORT: Record<TestViolationType, string> = {
  tab_switch: 'Tab switch',
  window_blur: 'Focus lost',
  fullscreen_exit: 'Fullscreen exit',
  copy_paste: 'Copy/paste',
  right_click: 'Right-click',
  devtools: 'DevTools/panel',
  no_face: 'Camera lost',
  screen_share_stopped: 'Screen share stopped',
  extension_detected: 'Extension',
  multiple_screens: 'Second screen',
};

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString() : '—');
const fmtTime = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString() : '—');

/** A row needs a second look: system-ended, any violation, more than one IP, or a blocked login. */
const isFlagged = (r: TestMonitorRow) => r.status === 'auto_submitted' || r.violationCount > 0 || r.ipChanges > 0 || r.newDeviceBlocked;

export function TestMonitorPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const basePath = user?.role === 'faculty' ? '/faculty' : '/tpo';
  const { data, isLoading, error, dataUpdatedAt } = useTestMonitor(id);
  const allowNewDevice = useAllowNewDevice();
  const forceSubmit = useForceSubmitAttempt();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState('');

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const counts = useMemo(
    () => ({
      assigned: rows.length,
      live: rows.filter((r) => r.online).length,
      inProgress: rows.filter((r) => r.status === 'in_progress').length,
      submitted: rows.filter((r) => r.status === 'submitted').length,
      ended: rows.filter((r) => r.status === 'auto_submitted').length,
      notStarted: rows.filter((r) => r.status === 'not_started').length,
      flagged: rows.filter(isFlagged).length,
    }),
    [rows]
  );

  const visible = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (q && ![r.candidateName, r.rollNumber, r.email, r.batch, ...r.ipAddresses].some((v) => v?.toLowerCase().includes(q))) return false;
    if (filter === 'all') return true;
    if (filter === 'live') return r.online;
    if (filter === 'flagged') return isFlagged(r);
    return r.status === filter;
  });

  const rowKey = (r: TestMonitorRow) => r.attemptId ?? `c:${r.candidateId}`;
  const toggle = (key: string) => setOpen((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  async function act(kind: 'allow' | 'end', r: TestMonitorRow) {
    if (!r.attemptId) return;
    const msg = kind === 'allow'
      ? `Allow ${r.candidateName} to resume this test from a new device/network?`
      : `End ${r.candidateName}'s test now? Their answers so far will be submitted and scored.`;
    if (!window.confirm(msg)) return;
    setActionError('');
    try {
      if (kind === 'allow') await allowNewDevice.mutateAsync(r.attemptId);
      else await forceSubmit.mutateAsync(r.attemptId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  }

  function exportSummary() {
    if (!data) return;
    downloadCsv(
      `${data.title} — results & proctoring.csv`,
      ['Candidate', 'Roll no', 'Email', 'Batch', 'Status', 'Score', 'Out of', 'Answered', 'Questions', 'Started', 'Submitted', 'End reason', 'IP addresses', 'IP changes', 'Sessions', 'Resumes', 'OS', 'Browser', 'Violations', 'Fullscreen exits', 'Tab switches', 'Violation breakdown', 'Blocked new device'],
      rows.map((r) => [
        r.candidateName, r.rollNumber ?? '', r.email ?? '', r.batch ?? '', STATUS_STYLE[r.status].label,
        r.score ?? '', r.totalMarks, r.answeredCount, r.questionCount, fmt(r.startedAt), fmt(r.submittedAt), r.terminationReason ?? '',
        r.ipAddresses.join(' | '), r.ipChanges, r.sessionCount, r.resumeCount, r.os ?? '', r.browser ?? '',
        r.violationCount, r.fullscreenExits, r.tabSwitches,
        Object.entries(r.violationsByType).map(([k, v]) => `${VIOLATION_SHORT[k as TestViolationType] ?? k}: ${v}`).join(' | '),
        r.newDeviceBlocked ? 'Yes' : 'No',
      ])
    );
  }

  function exportLog() {
    if (!data) return;
    downloadCsv(
      `${data.title} — full activity log.csv`,
      ['Candidate', 'Roll no', 'Time', 'Event', 'Detail', 'IP', 'Device'],
      rows.flatMap((r) => r.timeline.map((e) => [r.candidateName, r.rollNumber ?? '', fmt(e.at), EVENT_LABEL[e.type] ?? e.type, e.detail ?? '', e.ip ?? '', e.device ?? '']))
    );
  }

  return (
    <PageContainer>
      <BackLink to={`${basePath}/tests`} label="Tests" />
      <WorkspaceHeader
        title={data ? `Live Monitor — ${data.title}` : 'Live Monitor'}
        subtitle={data ? `${data.questionCount} questions per candidate${data.poolSize > data.questionCount ? ` (pool of ${data.poolSize})` : ''} · ${data.totalMarks} marks · ${data.durationMinutes} min · ${data.violationLimit} violations · ${data.allowedFullscreenExits} fullscreen exit(s) allowed` : 'Every candidate, every IP, every event'}
      />

      {isLoading && <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>}
      {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-5">
            {([
              ['Assigned', counts.assigned, 'all'],
              ['Live now', counts.live, 'live'],
              ['In progress', counts.inProgress, 'in_progress'],
              ['Submitted', counts.submitted, 'submitted'],
              ['Ended by system', counts.ended, 'auto_submitted'],
              ['Not started', counts.notStarted, 'not_started'],
              ['Flagged', counts.flagged, 'flagged'],
            ] as const).map(([label, value, key]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`text-left rounded-xl border px-3 py-2.5 bg-white transition-colors ${filter === key ? 'border-violet-400 ring-2 ring-violet-100' : 'border-gray-100 hover:border-gray-200'}`}
              >
                <p className={`text-xl font-bold tabular-nums ${key === 'flagged' || key === 'auto_submitted' ? (value ? 'text-red-600' : 'text-gray-900') : key === 'live' ? 'text-green-600' : 'text-gray-900'}`}>{value}</p>
                <p className="text-[11px] text-gray-500">{label}</p>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, roll no, email, batch or IP" className="w-full h-10 pl-9 pr-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
            </div>
            <span className="text-xs text-gray-400 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Auto-refreshing · updated {fmtTime(new Date(dataUpdatedAt).toISOString())}</span>
            <button onClick={exportSummary} className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50">
              <Download className="w-4 h-4" /> Results CSV
            </button>
            <button onClick={exportLog} className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50">
              <Download className="w-4 h-4" /> Full log CSV
            </button>
          </div>

          {actionError && <p className="mb-3 text-sm text-red-600">{actionError}</p>}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[980px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="px-4 py-3 w-8" />
                  <th className="px-2 py-3">Candidate</th>
                  <th className="px-2 py-3">Status</th>
                  <th className="px-2 py-3">Score</th>
                  <th className="px-2 py-3">Progress</th>
                  <th className="px-2 py-3">IP / device</th>
                  <th className="px-2 py-3">Violations</th>
                  <th className="px-2 py-3">Started</th>
                  <th className="px-2 py-3 text-right pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">No candidates match.</td></tr>
                )}
                {visible.map((r) => {
                  const key = rowKey(r);
                  const isOpen = open.has(key);
                  return (
                    <RowGroup key={key}>
                      <tr className={`border-b border-gray-50 ${isFlagged(r) ? 'bg-red-50/30' : ''}`}>
                        <td className="px-4 py-3 align-top">
                          {r.attemptId && (
                            <button onClick={() => toggle(key)} className="text-gray-400 hover:text-gray-700" title="Activity log">
                              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          )}
                        </td>
                        <td className="px-2 py-3 align-top">
                          <p className="font-semibold text-gray-900">{r.candidateName}</p>
                          <p className="text-[11px] text-gray-400">{[r.rollNumber, r.batch].filter(Boolean).join(' · ')}</p>
                        </td>
                        <td className="px-2 py-3 align-top">
                          <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md ${STATUS_STYLE[r.status].cls}`}>{STATUS_STYLE[r.status].label}</span>
                          {r.status === 'in_progress' && (
                            <p className={`mt-1 text-[11px] flex items-center gap-1 ${r.online ? 'text-green-600' : 'text-gray-400'}`}>
                              {r.online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                              {r.online ? 'Live' : `Offline · last seen ${fmtTime(r.lastSeenAt)}`}
                            </p>
                          )}
                          {r.terminationReason && <p className="mt-1 text-[11px] text-red-600 max-w-[200px]">{r.terminationReason}</p>}
                          {r.newDeviceBlocked && <p className="mt-1 text-[11px] font-semibold text-amber-700">Waiting: new device blocked</p>}
                        </td>
                        <td className="px-2 py-3 align-top tabular-nums">{r.score !== undefined ? <span className="font-semibold">{r.score}<span className="text-gray-400 font-normal">/{r.totalMarks}</span></span> : '—'}</td>
                        <td className="px-2 py-3 align-top text-xs text-gray-600 tabular-nums">{r.status === 'not_started' ? '—' : `${r.answeredCount}/${r.questionCount} answered`}</td>
                        <td className="px-2 py-3 align-top text-xs">
                          {r.ipAddresses.length === 0 ? '—' : (
                            <>
                              <p className="flex items-center gap-1 font-mono text-gray-800"><Globe className="w-3 h-3 text-gray-400" />{r.currentIp}</p>
                              {r.ipChanges > 0 && <p className="text-amber-700 font-semibold">{r.ipAddresses.length} IPs used</p>}
                              <p className="flex items-center gap-1 text-gray-400"><MonitorSmartphone className="w-3 h-3" />{[r.os, r.browser].filter(Boolean).join(' · ') || 'Unknown device'}</p>
                              {r.sessionCount > 1 && <p className="text-amber-700">{r.sessionCount} sessions · {r.resumeCount} resumes</p>}
                            </>
                          )}
                        </td>
                        <td className="px-2 py-3 align-top text-xs">
                          {r.violationCount === 0 ? <span className="text-gray-400">None</span> : (
                            <>
                              <p className="font-semibold text-red-600 flex items-center gap-1"><ShieldAlert className="w-3 h-3" />{r.violationCount} total</p>
                              <p className="text-gray-500">
                                {Object.entries(r.violationsByType).map(([k, v]) => `${VIOLATION_SHORT[k as TestViolationType] ?? k} ×${v}`).join(', ')}
                              </p>
                            </>
                          )}
                        </td>
                        <td className="px-2 py-3 align-top text-xs text-gray-500">{fmt(r.startedAt)}</td>
                        <td className="px-2 py-3 pr-4 align-top text-right">
                          <div className="flex flex-col items-end gap-1.5">
                            {r.newDeviceBlocked && (
                              <button onClick={() => act('allow', r)} disabled={allowNewDevice.isPending} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-800 hover:bg-amber-100">
                                <Unlock className="w-3 h-3" /> Allow new device
                              </button>
                            )}
                            {r.status === 'in_progress' && (
                              <button onClick={() => act('end', r)} disabled={forceSubmit.isPending} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-red-50 border border-red-200 text-[11px] font-semibold text-red-700 hover:bg-red-100">
                                <Ban className="w-3 h-3" /> End test
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-gray-50/60 border-b border-gray-100">
                          <td />
                          <td colSpan={8} className="px-2 py-4">
                            <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-4">
                              <div className="text-xs space-y-1.5">
                                <p className="font-semibold text-gray-900 mb-1">Attempt details</p>
                                <p><span className="text-gray-400">Email:</span> {r.email ?? '—'}</p>
                                <p><span className="text-gray-400">Sent via:</span> {r.assignmentLabel ?? '—'}</p>
                                <p><span className="text-gray-400">Started:</span> {fmt(r.startedAt)}</p>
                                <p><span className="text-gray-400">Submitted:</span> {fmt(r.submittedAt)}</p>
                                <p><span className="text-gray-400">All IPs:</span> <span className="font-mono">{r.ipAddresses.join(', ') || '—'}</span></p>
                                <p><span className="text-gray-400">Sessions / resumes:</span> {r.sessionCount} / {r.resumeCount}</p>
                                <p><span className="text-gray-400">Fullscreen exits:</span> {r.fullscreenExits} · <span className="text-gray-400">Tab switches:</span> {r.tabSwitches}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-gray-900 mb-2">Activity log ({r.timeline.length})</p>
                                <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-100 bg-white">
                                  <table className="w-full text-xs">
                                    <tbody>
                                      {r.timeline.map((e, i) => (
                                        <tr key={i} className="border-b border-gray-50 last:border-0">
                                          <td className="px-3 py-1.5 text-gray-400 whitespace-nowrap tabular-nums">{fmtTime(e.at)}</td>
                                          <td className={`px-2 py-1.5 whitespace-nowrap ${EVENT_TONE[e.type] ?? 'text-gray-700'}`}>{EVENT_LABEL[e.type] ?? e.type}</td>
                                          <td className="px-2 py-1.5 text-gray-600">{e.detail ?? ''}</td>
                                          <td className="px-2 py-1.5 font-mono text-gray-400 whitespace-nowrap">{e.ip ?? ''}</td>
                                          <td className="px-3 py-1.5 text-gray-400 whitespace-nowrap">{e.device ?? ''}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </RowGroup>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-[11px] text-gray-400 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            "Live" means the candidate's window checked in within the last 45 seconds. A resume from a new network is held until you allow it here.
          </p>
        </>
      )}
    </PageContainer>
  );
}

function RowGroup({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
