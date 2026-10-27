import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Plus, Users, Trophy, Building2, CalendarClock, MapPin, Search, IndianRupee, GraduationCap, BarChart3 } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePlacementDrives, usePlacementStats } from '../hooks/usePlacementDrives';
import { DriveEditorModal } from '../components/DriveEditorModal';
import { Badge, DRIVE_STATUS_STYLE, JOB_TYPE_LABEL, eligibilitySummary, formatDateTime, packageLabel } from '../components/driveUi';
import type { DriveStatus, PlacementDrive, PlacementStats } from '@placementos/types';

const FILTERS: { value: DriveStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'draft', label: 'Drafts' },
  { value: 'closed', label: 'Closed' },
  { value: 'completed', label: 'Completed' },
];

function StatCard({ icon: Icon, label, value, sub, tone }: { icon: typeof Users; label: string; value: ReactNode; sub?: string; tone: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3.5">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tone}`}><Icon className="w-5 h-5" /></div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-gray-400 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function StatsRow({ stats }: { stats?: PlacementStats }) {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      <StatCard icon={GraduationCap} label="Placement rate" value={stats ? `${stats.placementRate}%` : '—'} sub={stats ? `${stats.placedStudents} of ${stats.totalStudents} students placed` : undefined} tone="bg-violet-50 text-violet-600" />
      <StatCard icon={Trophy} label="Offers" value={stats?.totalOffers ?? '—'} sub={stats?.internshipOffers ? `+ ${stats.internshipOffers} internship offer(s)` : 'Full-time & PPO'} tone="bg-green-50 text-green-600" />
      <StatCard icon={IndianRupee} label="Highest / Avg CTC" value={stats ? `${stats.highestCtcLpa} / ${stats.averageCtcLpa}` : '—'} sub={stats ? `LPA · median ${stats.medianCtcLpa}` : undefined} tone="bg-amber-50 text-amber-600" />
      <StatCard icon={Briefcase} label="Active drives" value={stats?.activeDrives ?? '—'} sub={stats ? `${stats.totalDrives} published in total` : undefined} tone="bg-sky-50 text-sky-600" />
    </div>
  );
}

function DriveCard({ d, onOpen }: { d: PlacementDrive; onOpen: () => void }) {
  const status = DRIVE_STATUS_STYLE[d.status];
  return (
    <button onClick={onOpen} className="text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-violet-200 hover:shadow-md transition-all flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-100 to-pink-100 flex items-center justify-center text-sm font-bold text-violet-700 shrink-0">
            {d.companyName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-gray-900 truncate">{d.companyName}</p>
            <p className="text-sm text-gray-500 truncate">{d.roleTitle} · {JOB_TYPE_LABEL[d.jobType]}</p>
          </div>
        </div>
        <Badge cls={status.cls}>{status.label}</Badge>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1"><IndianRupee className="w-3.5 h-3.5" />{packageLabel(d)}</span>
        {d.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{d.location}</span>}
        {d.applicationDeadline && <span className="inline-flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" />Apply by {formatDateTime(d.applicationDeadline)}</span>}
      </div>
      <p className="mt-2 text-xs text-gray-400 line-clamp-1">{eligibilitySummary(d)}</p>

      <div className="mt-4 pt-3 border-t border-gray-50 flex items-center gap-5 text-sm">
        <span><span className="font-semibold text-gray-900">{d.applicantCount}</span> <span className="text-gray-500">applied</span></span>
        <span><span className="font-semibold text-green-700">{d.selectedCount}</span> <span className="text-gray-500">selected</span></span>
        <span className="text-gray-500">{d.rounds.length} round{d.rounds.length === 1 ? '' : 's'}</span>
      </div>
    </button>
  );
}

function PlacementReport({ stats, year, setYear }: { stats?: PlacementStats; year: string; setYear: (y: string) => void }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-600">Passing year</label>
        <input value={year} onChange={(e) => setYear(e.target.value)} placeholder="All years" className="h-9 w-32 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
      </div>
      <StatsRow stats={stats} />
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Department-wise placement</h3>
          {!stats?.byDepartment.length ? <p className="text-sm text-gray-400">No students yet.</p> : (
            <div className="space-y-3.5">
              {stats.byDepartment.map((d) => (
                <div key={d.department}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-gray-800">{d.department}</span>
                    <span className="text-gray-500 tabular-nums">{d.placed}/{d.total} · <span className="font-semibold text-gray-900">{d.rate}%</span></span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500" style={{ width: `${d.rate}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Company-wise offers</h3>
          {!stats?.byCompany.length ? <p className="text-sm text-gray-400">No offers recorded yet.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-400"><th className="pb-2 font-medium">Company</th><th className="pb-2 font-medium">Type</th><th className="pb-2 font-medium text-right">CTC</th><th className="pb-2 font-medium text-right">Offers</th></tr></thead>
              <tbody className="divide-y divide-gray-50">
                {stats.byCompany.map((c) => (
                  <tr key={`${c.companyName}-${c.roleTitle}`}>
                    <td className="py-2"><p className="font-medium text-gray-900">{c.companyName}</p><p className="text-xs text-gray-400">{c.roleTitle}</p></td>
                    <td className="py-2 text-gray-500">{JOB_TYPE_LABEL[c.jobType]}</td>
                    <td className="py-2 text-right text-gray-700">{c.ctcLpa ? `${c.ctcLpa} LPA` : '—'}</td>
                    <td className="py-2 text-right font-semibold text-green-700">{c.offers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export function TpoPlacementDrivesPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'drives' | 'report'>('drives');
  const [filter, setFilter] = useState<DriveStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [year, setYear] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const { data: drives = [], isLoading } = usePlacementDrives();
  const { data: stats } = usePlacementStats(tab === 'report' ? year.trim() || undefined : undefined);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return drives.filter((d) => (filter === 'all' || d.status === filter) && (!q || `${d.companyName} ${d.roleTitle}`.toLowerCase().includes(q)));
  }, [drives, filter, search]);

  return (
    <PageContainer>
      <WorkspaceHeader
        title="Placement Drives"
        subtitle="Companies, eligibility, applications and round-by-round selections"
        action={
          <button onClick={() => setShowEditor(true)} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white">
            <Plus className="w-4 h-4" /> New Drive
          </button>
        }
      />

      <div className="inline-flex p-1 bg-gray-100 rounded-xl mb-5">
        {([['drives', 'Drives', Building2], ['report', 'Placement Report', BarChart3]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)} className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-semibold transition-colors ${tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'report' ? (
        <PlacementReport stats={stats} year={year} setYear={setYear} />
      ) : (
        <>
          <StatsRow stats={stats} />
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
            <div className="flex gap-1.5 overflow-x-auto">
              {FILTERS.map((f) => (
                <button key={f.value} onClick={() => setFilter(f.value)} className={`shrink-0 h-8 px-3 rounded-lg text-xs font-semibold ${filter === f.value ? 'bg-violet-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {f.label} <span className="opacity-70">({f.value === 'all' ? drives.length : drives.filter((d) => d.status === f.value).length})</span>
                </button>
              ))}
            </div>
            <div className="relative sm:ml-auto sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search company or role" className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
            </div>
          </div>

          {isLoading ? (
            <div className="grid md:grid-cols-2 gap-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-44 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
          ) : visible.length === 0 ? (
            <EmptyState icon={Briefcase} title={drives.length ? 'No drives match' : 'No placement drives yet'} description={drives.length ? 'Try a different filter.' : 'Add the first company visiting campus — set eligibility and rounds, then open it to students.'} action={drives.length ? undefined : { label: 'New Drive', onClick: () => setShowEditor(true) }} />
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {visible.map((d) => <DriveCard key={d._id} d={d} onOpen={() => navigate(d._id)} />)}
            </div>
          )}
        </>
      )}

      {showEditor && <DriveEditorModal onClose={() => setShowEditor(false)} onSaved={(id) => navigate(id)} />}
    </PageContainer>
  );
}
