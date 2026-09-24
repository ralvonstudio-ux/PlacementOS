import { useMemo, useState } from 'react';
import { MessageSquare, UserCircle2 } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { StarRating } from '@/components/ui/StarRating';
import { useTrainerFeedbackList, useTrainerFeedbackOverview } from '../hooks/useTrainerFeedback';
import type { TrainerFeedbackRatings } from '@placementos/types';

const CRITERIA_LABELS: { key: keyof TrainerFeedbackRatings; label: string }[] = [
  { key: 'subjectKnowledge', label: 'Subject Knowledge' },
  { key: 'teachingQuality', label: 'Teaching Quality' },
  { key: 'communication', label: 'Communication' },
  { key: 'punctuality', label: 'Punctuality' },
];

interface FilterOption { value: string; label: string }

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: FilterOption[] }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 min-w-[9rem] rounded-lg border border-gray-200 text-sm px-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
      >
        <option value="">All</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function TpoTrainerFeedbackPage() {
  const [facultyId, setFacultyId] = useState('');
  const [batch, setBatch] = useState('');
  const [track, setTrack] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data: overview = [] } = useTrainerFeedbackOverview();
  const { data: feedback = [], isLoading } = useTrainerFeedbackList({
    facultyId: facultyId || undefined,
    batch: batch || undefined,
    track: track || undefined,
    from: from || undefined,
    to: to || undefined,
  });

  const batches = useMemo(() => [...new Set(feedback.map((f) => f.batch))].sort(), [feedback]);
  const tracks = useMemo(() => [...new Set(feedback.map((f) => f.track))].sort(), [feedback]);

  const selectedTrainer = overview.find((o) => o.facultyId === facultyId);

  return (
    <PageContainer>
      <WorkspaceHeader
        title="Trainer Feedback"
        subtitle="Student feedback on trainers — filter, review, and see auto-computed overall ratings. No more spreadsheets."
      />

      {overview.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          {overview.map((o) => (
            <button
              key={o.facultyId}
              onClick={() => setFacultyId(facultyId === o.facultyId ? '' : o.facultyId)}
              className={`text-left bg-white rounded-2xl border shadow-sm p-4 transition-colors ${
                facultyId === o.facultyId ? 'border-violet-400 ring-2 ring-violet-500/20' : 'border-gray-100 hover:border-gray-200'
              }`}
            >
              <p className="text-sm font-semibold text-gray-900 truncate">{o.facultyName}</p>
              <p className="text-xs text-gray-400 mb-2">{o.responseCount} response{o.responseCount === 1 ? '' : 's'}</p>
              <div className="flex items-center gap-2">
                <StarRating value={Math.round(o.overallRating)} size="sm" />
                <span className="text-sm font-bold text-gray-900">{o.overallRating.toFixed(2)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedTrainer && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <p className="text-sm font-semibold text-gray-900 mb-3">{selectedTrainer.facultyName} — breakdown</p>
          <div className="grid gap-4 sm:grid-cols-4">
            {CRITERIA_LABELS.map((c) => (
              <div key={c.key}>
                <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                <p className="text-lg font-bold text-gray-900">{selectedTrainer.avgByCriterion[c.key].toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 mb-5">
        <FilterSelect label="Trainer" value={facultyId} onChange={setFacultyId} options={overview.map((o) => ({ value: o.facultyId, label: o.facultyName }))} />
        <FilterSelect label="Batch" value={batch} onChange={setBatch} options={batches.map((b) => ({ value: b, label: b }))} />
        <FilterSelect label="Subject" value={track} onChange={setTrack} options={tracks.map((t) => ({ value: t, label: t }))} />
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-lg border border-gray-200 text-sm px-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-lg border border-gray-200 text-sm px-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500" />
        </div>
        {(facultyId || batch || track || from || to) && (
          <button
            onClick={() => { setFacultyId(''); setBatch(''); setTrack(''); setFrom(''); setTo(''); }}
            className="h-9 px-3 text-xs font-semibold text-gray-500 hover:text-gray-700"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}
          </div>
        ) : feedback.length === 0 ? (
          <EmptyState icon={MessageSquare} title="No feedback found" description="Try adjusting the filters, or check back once students have submitted feedback." />
        ) : (
          <div className="divide-y divide-gray-50">
            {feedback.map((f) => (
              <div key={f._id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{f.facultyName}</p>
                    <p className="text-xs text-gray-500">{f.batch} · {f.track} · {new Date(f.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StarRating value={Math.round(f.overallRating)} size="sm" />
                    <span className="text-sm font-bold text-gray-900">{f.overallRating.toFixed(1)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
                  {CRITERIA_LABELS.map((c) => (
                    <span key={c.key} className="text-[11px] text-gray-500">
                      {c.label}: <span className="font-semibold text-gray-700">{f.ratings[c.key]}/5</span>
                    </span>
                  ))}
                </div>

                {f.comment && <p className="text-sm text-gray-600 italic mb-2">"{f.comment}"</p>}

                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <UserCircle2 className="w-3.5 h-3.5" />
                  {f.isAnonymous ? 'Anonymous student' : f.candidateName ?? 'Unknown student'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
