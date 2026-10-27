import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Briefcase, Pencil, Trash2, Send, Lock, CheckCheck, RotateCcw, Download, Search, IndianRupee, MapPin, CalendarClock,
  CalendarDays, Globe, Users, UserCheck, Trophy, UserX, ChevronRight, Loader2, X,
} from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  usePlacementDrive, useSetDriveStatus, useRecordRoundResult, useSetApplicationStatus, useDeleteDrive,
} from '../hooks/usePlacementDrives';
import { DriveEditorModal } from '../components/DriveEditorModal';
import {
  Badge, APP_STATUS_STYLE, DRIVE_STATUS_STYLE, JOB_TYPE_LABEL, ROUND_RESULT_STYLE, ROUND_TYPE_LABEL,
  eligibilitySummary, formatDate, formatDateTime, packageLabel,
} from '../components/driveUi';
import type { DriveApplication, DriveApplicationStatus, DriveRoundResult, DriveStatus, PlacementDrive } from '@placementos/types';

const STATUS_ACTIONS: Record<DriveStatus, { to: DriveStatus; label: string; icon: typeof Send; primary?: boolean; confirm?: string }[]> = {
  draft: [{ to: 'open', label: 'Open for applications', icon: Send, primary: true, confirm: 'Open this drive? Every eligible student is notified right away.' }],
  open: [{ to: 'closed', label: 'Close applications', icon: Lock, primary: true }],
  closed: [
    { to: 'open', label: 'Reopen', icon: RotateCcw },
    { to: 'completed', label: 'Mark completed', icon: CheckCheck, primary: true },
  ],
  completed: [{ to: 'closed', label: 'Reopen results', icon: RotateCcw }],
};

const resultFor = (a: DriveApplication, roundIndex: number): DriveRoundResult =>
  a.roundResults.find((r) => r.roundIndex === roundIndex)?.result ?? 'pending';

function exportCsv(drive: PlacementDrive, apps: DriveApplication[]) {
  const head = ['Name', 'Roll Number', 'Department', 'Batch', 'Email', 'CGPA', 'Backlogs', ...drive.rounds.map((r) => r.name), 'Status', 'Offer (LPA)', 'Applied At'];
  const rows = apps.map((a) => [
    a.candidateName, a.rollNumber, a.department, a.batch, a.email ?? '', a.cgpa ?? '', a.activeBacklogs ?? '',
    ...drive.rounds.map((_, i) => ROUND_RESULT_STYLE[resultFor(a, i)].label),
    APP_STATUS_STYLE[a.status].label, a.offerCtcLpa ?? '', formatDateTime(a.appliedAt),
  ]);
  const csv = [head, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${drive.companyName}-${drive.roleTitle}-applicants.csv`.replace(/\s+/g, '_');
  link.click();
  URL.revokeObjectURL(url);
}

function InfoItem({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 min-w-0">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-800 break-words">{value}</p>
      </div>
    </div>
  );
}

/** Applied → each round's survivors → selected, so the TPO sees where candidates drop off. */
function Funnel({ drive, apps }: { drive: PlacementDrive; apps: DriveApplication[] }) {
  const active = apps.filter((a) => a.status !== 'withdrawn');
  const steps = [
    { label: 'Applied', count: active.length },
    ...drive.rounds.map((r, i) => ({ label: r.name, count: active.filter((a) => resultFor(a, i) === 'cleared').length, sub: ROUND_TYPE_LABEL[r.type], at: r.scheduledAt })),
    { label: 'Selected', count: active.filter((a) => a.status === 'selected').length },
  ];
  const max = Math.max(1, steps[0].count);
  return (
    <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-2 shrink-0">
          <div className="w-40 rounded-xl border border-gray-100 bg-white p-3">
            <p className="text-xs font-semibold text-gray-700 truncate" title={s.label}>{i > 0 && i < steps.length - 1 ? `R${i} · ` : ''}{s.label}</p>
            {'sub' in s && <p className="text-[11px] text-gray-400 truncate">{s.at ? formatDateTime(s.at) : s.sub}</p>}
            <p className="text-2xl font-bold text-gray-900 mt-1">{s.count}</p>
            <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className={`h-full rounded-full ${i === steps.length - 1 ? 'bg-green-500' : 'bg-violet-500'}`} style={{ width: `${(s.count / max) * 100}%` }} />
            </div>
          </div>
          {i < steps.length - 1 && <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />}
        </div>
      ))}
    </div>
  );
}

function BulkBar({ drive, count, busy, onRound, onStatus, onClear }: {
  drive: PlacementDrive; count: number; busy: boolean;
  onRound: (roundIndex: number, result: DriveRoundResult) => void;
  onStatus: (status: Exclude<DriveApplicationStatus, 'withdrawn'>, offer?: number) => void;
  onClear: () => void;
}) {
  const [roundIndex, setRoundIndex] = useState(0);
  const [offer, setOffer] = useState(drive.ctcLpa?.toString() ?? '');
  const btn = 'h-8 px-3 rounded-lg text-xs font-semibold disabled:opacity-50';
  return (
    <div className="sticky top-2 z-20 mb-3 rounded-2xl border border-violet-200 bg-violet-50/95 backdrop-blur px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2.5 shadow-sm">
      <span className="text-sm font-semibold text-violet-900">{count} selected</span>
      {drive.rounds.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <select value={roundIndex} onChange={(e) => setRoundIndex(Number(e.target.value))} className="h-8 px-2 rounded-lg border border-violet-200 bg-white text-xs">
            {drive.rounds.map((r, i) => <option key={i} value={i}>R{i + 1} · {r.name}</option>)}
          </select>
          <button disabled={busy} onClick={() => onRound(roundIndex, 'cleared')} className={`${btn} bg-green-600 text-white hover:bg-green-700`}>Cleared</button>
          <button disabled={busy} onClick={() => onRound(roundIndex, 'rejected')} className={`${btn} bg-red-600 text-white hover:bg-red-700`}>Rejected</button>
          <button disabled={busy} onClick={() => onRound(roundIndex, 'absent')} className={`${btn} bg-white border border-gray-200 text-gray-600 hover:bg-gray-50`}>Absent</button>
          <button disabled={busy} onClick={() => onRound(roundIndex, 'pending')} className={`${btn} bg-white border border-gray-200 text-gray-500 hover:bg-gray-50`}>Reset</button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="relative">
          <input type="number" step="0.01" min="0" value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="CTC" className="h-8 w-20 pl-2 pr-8 rounded-lg border border-violet-200 bg-white text-xs" />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">LPA</span>
        </div>
        <button disabled={busy} onClick={() => onStatus('selected', offer ? Number(offer) : undefined)} className={`${btn} bg-violet-600 text-white hover:bg-violet-700`}>
          <Trophy className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />Mark selected
        </button>
        <button disabled={busy} onClick={() => onStatus('rejected')} className={`${btn} bg-white border border-red-200 text-red-600 hover:bg-red-50`}>Not selected</button>
        <button disabled={busy} onClick={() => onStatus('shortlisted')} className={`${btn} bg-white border border-gray-200 text-gray-600 hover:bg-gray-50`}>Back to in process</button>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {busy && <Loader2 className="w-4 h-4 animate-spin text-violet-600" />}
        <button onClick={onClear} className="p-1.5 rounded-lg text-violet-700 hover:bg-violet-100" title="Clear selection"><X className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

export function TpoDriveDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = usePlacementDrive(id);
  const setStatus = useSetDriveStatus();
  const recordRound = useRecordRoundResult();
  const setAppStatus = useSetApplicationStatus();
  const deleteDrive = useDeleteDrive();

  const [editing, setEditing] = useState(false);
  const [filter, setFilter] = useState<DriveApplicationStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const apps = data?.applications ?? [];
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return apps.filter(
      (a) => (filter === 'all' ? a.status !== 'withdrawn' : a.status === filter) && (!q || `${a.candidateName} ${a.rollNumber} ${a.department}`.toLowerCase().includes(q))
    );
  }, [apps, filter, search]);

  if (isLoading) return <PageContainer><div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)}</div></PageContainer>;
  if (!data) return <PageContainer><EmptyState icon={Briefcase} title="Drive not found" description="It may have been deleted." /></PageContainer>;

  const { drive, eligibleNotApplied } = data;
  const busy = recordRound.isPending || setAppStatus.isPending;
  const allVisibleSelected = visible.length > 0 && visible.every((a) => selected.has(a._id));
  const count = (s: DriveApplicationStatus) => apps.filter((a) => a.status === s).length;

  const run = async (fn: () => Promise<unknown>) => {
    setError('');
    try {
      await fn();
      setSelected(new Set());
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const toggle = (appId: string) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(appId)) next.delete(appId); else next.add(appId);
    return next;
  });

  return (
    <PageContainer>
      <WorkspaceHeader
        title={`${drive.companyName} — ${drive.roleTitle}`}
        subtitle={`${JOB_TYPE_LABEL[drive.jobType]} · ${packageLabel(drive)}`}
        backTo="/tpo/placements"
        backLabel="Placement Drives"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_ACTIONS[drive.status].map((a) => (
              <button
                key={a.to}
                disabled={setStatus.isPending}
                onClick={() => { if (!a.confirm || window.confirm(a.confirm)) run(() => setStatus.mutateAsync({ id: drive._id, status: a.to })); }}
                className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-sm font-semibold disabled:opacity-50 ${a.primary ? 'bg-violet-600 text-white hover:bg-violet-700' : 'border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
              >
                <a.icon className="w-4 h-4" /> {a.label}
              </button>
            ))}
            <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"><Pencil className="w-4 h-4" /> Edit</button>
            <button
              onClick={() => { if (window.confirm(`Delete the ${drive.companyName} drive and all ${drive.applicantCount} application(s)? This can't be undone.`)) deleteDrive.mutate(drive._id, { onSuccess: () => navigate('/tpo/placements') }); }}
              className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-red-600 hover:bg-red-50"
              title="Delete drive"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        }
      />

      {error && <div className="mb-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">{error}</div>}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-5 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Badge cls={DRIVE_STATUS_STYLE[drive.status].cls}>{DRIVE_STATUS_STYLE[drive.status].label}</Badge>
            {drive.status === 'draft' && <span className="text-xs text-gray-400">Students can't see this drive until you open it.</span>}
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <InfoItem icon={IndianRupee} label="Package" value={packageLabel(drive)} />
            <InfoItem icon={MapPin} label="Location" value={drive.location || '—'} />
            <InfoItem icon={CalendarClock} label="Apply by" value={formatDateTime(drive.applicationDeadline)} />
            <InfoItem icon={CalendarDays} label="Drive date" value={formatDate(drive.driveDate)} />
            <div className="sm:col-span-2"><InfoItem icon={UserCheck} label="Eligibility" value={eligibilitySummary(drive)} /></div>
            {drive.companyWebsite && <div className="sm:col-span-2"><InfoItem icon={Globe} label="Website" value={drive.companyWebsite} /></div>}
          </div>
          {drive.description && <p className="mt-4 pt-4 border-t border-gray-50 text-sm text-gray-600 whitespace-pre-wrap">{drive.description}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3 content-start">
          {[
            { icon: Users, label: 'Applied', value: drive.applicantCount, tone: 'text-blue-600 bg-blue-50' },
            { icon: UserCheck, label: 'Eligible, not applied', value: eligibleNotApplied, tone: 'text-amber-600 bg-amber-50' },
            { icon: Trophy, label: 'Selected', value: count('selected'), tone: 'text-green-600 bg-green-50' },
            { icon: UserX, label: 'Not selected', value: count('rejected'), tone: 'text-red-600 bg-red-50' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${s.tone}`}><s.icon className="w-4 h-4" /></div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Selection funnel</h2>
        <Funnel drive={drive} apps={apps} />
      </section>

      <section>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Applicants</h2>
          <div className="flex gap-1.5 overflow-x-auto">
            {(['all', 'applied', 'shortlisted', 'selected', 'rejected', 'withdrawn'] as const).map((s) => (
              <button key={s} onClick={() => { setFilter(s); setSelected(new Set()); }} className={`shrink-0 h-7 px-2.5 rounded-lg text-xs font-semibold ${filter === s ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {s === 'all' ? 'All active' : APP_STATUS_STYLE[s].label} ({s === 'all' ? apps.filter((a) => a.status !== 'withdrawn').length : count(s)})
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="h-8 w-44 pl-8 pr-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
            </div>
            <button onClick={() => exportCsv(drive, visible)} disabled={!visible.length} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
        </div>

        {selected.size > 0 && (
          <BulkBar
            drive={drive}
            count={selected.size}
            busy={busy}
            onClear={() => setSelected(new Set())}
            onRound={(roundIndex, result) => run(() => recordRound.mutateAsync({ id: drive._id, payload: { applicationIds: [...selected], roundIndex, result } }))}
            onStatus={(status, offerCtcLpa) => run(() => setAppStatus.mutateAsync({ id: drive._id, payload: { applicationIds: [...selected], status, offerCtcLpa } }))}
          />
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {visible.length === 0 ? (
            <EmptyState
              icon={Users}
              title={apps.length ? 'No applicants match' : 'No applications yet'}
              description={drive.status === 'draft' ? 'Open the drive so eligible students can apply.' : apps.length ? 'Try a different filter.' : `${eligibleNotApplied} eligible student(s) haven't applied yet.`}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <input type="checkbox" checked={allVisibleSelected} onChange={() => setSelected(allVisibleSelected ? new Set() : new Set(visible.filter((a) => a.status !== 'withdrawn').map((a) => a._id)))} className="accent-violet-600" />
                    </th>
                    <th className="px-3 py-3 font-semibold">Student</th>
                    <th className="px-3 py-3 font-semibold">Dept · Batch</th>
                    <th className="px-3 py-3 font-semibold text-right">CGPA</th>
                    <th className="px-3 py-3 font-semibold text-right">Backlogs</th>
                    {drive.rounds.map((r, i) => <th key={i} className="px-3 py-3 font-semibold whitespace-nowrap" title={r.name}>R{i + 1} · {r.name.length > 14 ? `${r.name.slice(0, 13)}…` : r.name}</th>)}
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 font-semibold text-right">Offer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {visible.map((a) => (
                    <tr key={a._id} className={selected.has(a._id) ? 'bg-violet-50/50' : 'hover:bg-gray-50/60'}>
                      <td className="px-4 py-3">
                        <input type="checkbox" disabled={a.status === 'withdrawn'} checked={selected.has(a._id)} onChange={() => toggle(a._id)} className="accent-violet-600" />
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium text-gray-900 whitespace-nowrap">{a.candidateName}</p>
                        <p className="text-xs text-gray-400">{a.rollNumber}</p>
                      </td>
                      <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{a.department}<span className="text-gray-400"> · {a.batch}</span></td>
                      <td className="px-3 py-3 text-right tabular-nums">{a.cgpa ?? '—'}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{a.activeBacklogs ?? '—'}</td>
                      {drive.rounds.map((_, i) => {
                        const r = ROUND_RESULT_STYLE[resultFor(a, i)];
                        return <td key={i} className="px-3 py-3"><span className={`inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-md border ${r.cls}`}>{r.label}</span></td>;
                      })}
                      <td className="px-3 py-3"><Badge cls={APP_STATUS_STYLE[a.status].cls}>{APP_STATUS_STYLE[a.status].label}</Badge></td>
                      <td className="px-3 py-3 text-right font-semibold text-green-700 whitespace-nowrap">{a.offerCtcLpa ? `${a.offerCtcLpa} LPA` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-gray-400">Tick students, then record a round's result or mark them selected. Students are notified of every result, and selected students are marked as placed.</p>
      </section>

      {editing && <DriveEditorModal drive={drive} onClose={() => setEditing(false)} />}
    </PageContainer>
  );
}
