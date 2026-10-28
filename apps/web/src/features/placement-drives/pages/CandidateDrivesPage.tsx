import { useState } from 'react';
import { Briefcase, MapPin, CalendarClock, IndianRupee, CheckCircle2, XCircle, Clock, Loader2, Trophy, ChevronDown, ChevronUp, Lock, Globe } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useMyDrives, useApplyToDrive, useWithdrawFromDrive } from '../hooks/usePlacementDrives';
import { Badge, APP_STATUS_STYLE, JOB_TYPE_LABEL, ROUND_RESULT_STYLE, ROUND_TYPE_LABEL, eligibilitySummary, formatDate, formatDateTime, isDeadlinePassed, packageLabel } from '../components/driveUi';
import type { DriveForCandidate, DriveRoundResult } from '@placementos/types';

/** The candidate's own journey through the drive's rounds. */
function RoundTimeline({ d }: { d: DriveForCandidate }) {
  if (!d.rounds.length) return null;
  const resultAt = (i: number): DriveRoundResult => d.myApplication?.roundResults.find((r) => r.roundIndex === i)?.result ?? 'pending';
  return (
    <ol className="mt-4 space-y-0">
      {d.rounds.map((r, i) => {
        const result = d.myApplication ? resultAt(i) : 'pending';
        const Icon = result === 'cleared' ? CheckCircle2 : result === 'rejected' || result === 'absent' ? XCircle : Clock;
        const tone = result === 'cleared' ? 'text-green-600' : result === 'rejected' || result === 'absent' ? 'text-red-500' : 'text-gray-300';
        return (
          <li key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <Icon className={`w-5 h-5 shrink-0 ${tone}`} />
              {i < d.rounds.length - 1 && <span className="w-px flex-1 bg-gray-200 my-1" />}
            </div>
            <div className="pb-3 min-w-0">
              <p className="text-sm font-medium text-gray-900">{r.name} <span className="text-xs font-normal text-gray-400">· {ROUND_TYPE_LABEL[r.type]}</span></p>
              <p className="text-xs text-gray-500">
                {r.scheduledAt ? formatDateTime(r.scheduledAt) : 'Date to be announced'}
                {d.myApplication && result !== 'pending' && <span className={`ml-2 font-semibold ${tone}`}>{ROUND_RESULT_STYLE[result].label}</span>}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function DriveCard({ d }: { d: DriveForCandidate }) {
  const [expanded, setExpanded] = useState(!!d.myApplication);
  const [error, setError] = useState('');
  const apply = useApplyToDrive();
  const withdraw = useWithdrawFromDrive();
  const app = d.myApplication && d.myApplication.status !== 'withdrawn' ? d.myApplication : undefined;
  const deadlinePassed = isDeadlinePassed(d);
  const canApply = !app && d.status === 'open' && !deadlinePassed && d.eligible;

  const act = async (fn: () => Promise<unknown>) => {
    setError('');
    try { await fn(); } catch (err) { setError((err as Error).message); }
  };

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 ${app?.status === 'selected' ? 'border-green-200 ring-1 ring-green-100' : 'border-gray-100'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-100 to-pink-100 flex items-center justify-center text-sm font-bold text-violet-700 shrink-0">{d.companyName.slice(0, 2).toUpperCase()}</div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-gray-900 truncate">{d.companyName}</p>
            <p className="text-sm text-gray-500 truncate">{d.roleTitle} · {JOB_TYPE_LABEL[d.jobType]}</p>
          </div>
        </div>
        {app ? (
          <Badge cls={APP_STATUS_STYLE[app.status].cls}>{APP_STATUS_STYLE[app.status].label}</Badge>
        ) : d.status !== 'open' ? (
          <Badge cls="bg-gray-100 text-gray-500">Closed</Badge>
        ) : d.eligible ? (
          <Badge cls="bg-green-50 text-green-700">You're eligible</Badge>
        ) : (
          <Badge cls="bg-red-50 text-red-600">Not eligible</Badge>
        )}
      </div>

      {app?.status === 'selected' && (
        <div className="mt-4 rounded-xl bg-green-50 border border-green-100 px-4 py-3 flex items-center gap-2.5 text-sm text-green-800">
          <Trophy className="w-4 h-4 shrink-0" />
          Congratulations — you've been selected{app.offerCtcLpa ? ` with a ${app.offerCtcLpa} LPA offer` : ''}!
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1"><IndianRupee className="w-3.5 h-3.5" />{packageLabel(d)}</span>
        {d.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{d.location}</span>}
        {d.applicationDeadline && (
          <span className={`inline-flex items-center gap-1 ${deadlinePassed ? 'text-red-500' : ''}`}><CalendarClock className="w-3.5 h-3.5" />{deadlinePassed ? 'Deadline passed' : `Apply by ${formatDateTime(d.applicationDeadline)}`}</span>
        )}
        {d.driveDate && <span className="inline-flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" />Drive on {formatDate(d.driveDate)}</span>}
      </div>
      <p className="mt-2 text-xs text-gray-400">Eligibility: {eligibilitySummary(d)}</p>

      {!app && !d.eligible && d.ineligibleReasons.length > 0 && (
        <ul className="mt-3 rounded-xl bg-red-50/70 border border-red-100 px-3.5 py-2.5 space-y-0.5">
          {d.ineligibleReasons.map((r) => <li key={r} className="text-xs text-red-700">• {r}</li>)}
        </ul>
      )}

      {expanded && (
        <>
          {d.description && <p className="mt-4 text-sm text-gray-600 whitespace-pre-wrap">{d.description}</p>}
          {d.companyWebsite && <p className="mt-2 text-xs text-gray-500 inline-flex items-center gap-1"><Globe className="w-3.5 h-3.5" />{d.companyWebsite}</p>}
          <RoundTimeline d={d} />
        </>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 pt-3 border-t border-gray-50 flex items-center gap-2">
        <button onClick={() => setExpanded((v) => !v)} className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700">
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} {expanded ? 'Less' : 'Details & rounds'}
        </button>
        <div className="ml-auto flex items-center gap-2">
          {app?.status === 'applied' && (
            <button
              onClick={() => { if (window.confirm(`Withdraw your application to ${d.companyName}?`)) act(() => withdraw.mutateAsync(d._id)); }}
              disabled={withdraw.isPending}
              className="h-9 px-3.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Withdraw
            </button>
          )}
          {!app && (
            <button
              onClick={() => act(() => apply.mutateAsync(d._id))}
              disabled={!canApply || apply.isPending}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {apply.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : !canApply ? <Lock className="w-4 h-4" /> : null}
              {d.myApplication?.status === 'withdrawn' && canApply ? 'Apply again' : 'Apply'}
            </button>
          )}
          {app && app.status !== 'applied' && <span className="text-xs text-gray-400">Applied {formatDate(app.appliedAt)}</span>}
        </div>
      </div>
    </div>
  );
}

export function CandidateDrivesPage() {
  const [tab, setTab] = useState<'open' | 'mine' | 'past'>('open');
  const { data: drives = [], isLoading } = useMyDrives();

  const applied = (d: DriveForCandidate) => !!d.myApplication && d.myApplication.status !== 'withdrawn';
  const lists = {
    open: drives.filter((d) => d.status === 'open' && !applied(d)),
    mine: drives.filter(applied),
    past: drives.filter((d) => d.status !== 'open' && !applied(d)),
  };
  const offers = lists.mine.filter((d) => d.myApplication?.status === 'selected').length;

  return (
    <PageContainer>
      <WorkspaceHeader title="Placement Drives" subtitle="Companies hiring from campus — check eligibility, apply, and track every round" />

      <div className="grid grid-cols-3 gap-3 mb-5 max-w-xl">
        {[
          { label: 'Open to apply', value: lists.open.filter((d) => d.eligible && !isDeadlinePassed(d)).length },
          { label: 'Applications', value: lists.mine.length },
          { label: 'Offers', value: offers },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="inline-flex p-1 bg-gray-100 rounded-xl mb-5">
        {([['open', 'Open drives'], ['mine', 'My applications'], ['past', 'Past drives']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`h-9 px-4 rounded-lg text-sm font-semibold ${tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {label} <span className="opacity-60">({lists[key].length})</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-4">{[1, 2].map((i) => <div key={i} className="h-48 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : lists[tab].length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={tab === 'mine' ? "You haven't applied to any drive yet" : tab === 'open' ? 'No open drives right now' : 'No past drives'}
          description={tab === 'open' ? "You'll get a notification as soon as a company you're eligible for opens a drive." : undefined}
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-4 items-start">
          {lists[tab].map((d) => <DriveCard key={d._id} d={d} />)}
        </div>
      )}
    </PageContainer>
  );
}
