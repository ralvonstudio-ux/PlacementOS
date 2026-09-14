import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Sparkles, Loader2, Plus, Pencil, CheckCircle2, Circle, MinusCircle, RotateCcw, Trash2, Layers, CalendarDays,
} from 'lucide-react';
import { useMyBatchTracks } from '@/features/training-schedule/hooks/useTrainingSchedule';
import { ContentSourceInput } from '@/features/content-extraction/components/ContentSourceInput';
import { extractErrorMessage } from '@/services/api';
import {
  useAcademicPlan, useGenerateAcademicPlan, useAddAcademicPlanSession, useDeleteAcademicPlan,
} from '../hooks/useAcademicPlan';
import { EditSessionModal } from '../components/EditSessionModal';
import type { AcademicPlanSession } from '@placementos/types';

function todayStr(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function formatShort(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

const STATUS_ICON: Record<AcademicPlanSession['status'], JSX.Element> = {
  planned: <Circle className="w-4 h-4 text-gray-300" />,
  completed: <CheckCircle2 className="w-4 h-4 text-green-600" />,
  skipped: <MinusCircle className="w-4 h-4 text-amber-500" />,
};

export function AcademicPlanPage() {
  const navigate = useNavigate();
  const { batchTracks } = useMyBatchTracks();
  const [selected, setSelected] = useState<{ batch: string; track: string } | null>(null);
  useEffect(() => {
    if (!selected && batchTracks.length > 0) setSelected(batchTracks[0]);
  }, [batchTracks, selected]);

  const { data: plan, isLoading } = useAcademicPlan(selected?.batch ?? '', selected?.track ?? '');
  const { mutateAsync: generate, isPending: isGenerating } = useGenerateAcademicPlan();
  const { mutateAsync: addSession, isPending: isAdding } = useAddAcademicPlanSession();
  const { mutateAsync: removePlan } = useDeleteAcademicPlan();

  const [view, setView] = useState<'week' | 'month'>('week');
  const [editing, setEditing] = useState<AcademicPlanSession | null>(null);
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [error, setError] = useState('');

  // Generate-form state
  const [title, setTitle] = useState('');
  const [syllabusText, setSyllabusText] = useState('');
  const [totalLectures, setTotalLectures] = useState(20);
  const [totalWeeks, setTotalWeeks] = useState(6);
  const [startDate, setStartDate] = useState(todayStr());

  function openRegenerateForm() {
    if (plan) {
      setTitle(plan.title);
      setSyllabusText(plan.syllabusText);
      setTotalLectures(plan.totalLectures);
      setTotalWeeks(plan.totalWeeks);
      setStartDate(plan.startDate);
    }
    setShowRegenerate(true);
  }

  async function handleGenerate() {
    if (!selected || !syllabusText.trim()) return;
    setError('');
    try {
      await generate({
        batch: selected.batch,
        track: selected.track,
        title: title.trim() || undefined,
        syllabusText: syllabusText.trim(),
        totalLectures,
        totalWeeks,
        startDate,
      });
      setShowRegenerate(false);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  async function handleAddSession(week: number, date: string) {
    if (!plan) return;
    const title = window.prompt('Title for this session');
    if (!title?.trim()) return;
    await addSession({ planId: plan._id, payload: { title: title.trim(), week, date } });
  }

  async function handleDeletePlan() {
    if (!plan) return;
    if (!window.confirm('Delete this training plan? This cannot be undone.')) return;
    await removePlan(plan._id);
  }

  const grouped = useMemo(() => {
    if (!plan) return [];
    if (view === 'week') {
      const byWeek = new Map<number, AcademicPlanSession[]>();
      for (const s of plan.sessions) {
        if (!byWeek.has(s.week)) byWeek.set(s.week, []);
        byWeek.get(s.week)!.push(s);
      }
      return [...byWeek.entries()]
        .sort(([a], [b]) => a - b)
        .map(([week, sessions]) => ({
          key: `Week ${week}`,
          sessions: sessions.sort((a, b) => a.date.localeCompare(b.date)),
        }));
    }
    const byMonth = new Map<string, AcademicPlanSession[]>();
    for (const s of plan.sessions) {
      const monthKey = s.date.slice(0, 7);
      if (!byMonth.has(monthKey)) byMonth.set(monthKey, []);
      byMonth.get(monthKey)!.push(s);
    }
    return [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, sessions]) => ({
        key: new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
        sessions: sessions.sort((a, b) => a.date.localeCompare(b.date)),
      }));
  }, [plan, view]);

  return (
    <div className="min-h-screen bg-[#F5F5F7] p-3 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate('/faculty')} className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 transition-colors shrink-0" aria-label="Back">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">Training Plan</h1>
          <p className="text-xs text-gray-400">Put in the syllabus — get a week-by-week plan, editable anytime</p>
        </div>
      </div>

      {batchTracks.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {batchTracks.map((bt) => (
            <button
              key={`${bt.batch}-${bt.track}`}
              onClick={() => setSelected(bt)}
              className={`h-9 px-4 rounded-full text-sm font-medium border transition-colors ${
                selected?.batch === bt.batch && selected?.track === bt.track ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-violet-300'
              }`}
            >
              {bt.batch} · {bt.track}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : !plan || showRegenerate ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-violet-600" />
            <h2 className="text-sm font-bold text-gray-900">{plan ? 'Regenerate Plan' : 'Create Training Plan'}</h2>
          </div>

          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Title (optional)</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={selected ? `${selected.track} — Training Plan` : 'Training Plan'}
            className="w-full h-10 px-3 mb-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
          />

          <div className="mb-4">
            <ContentSourceInput value={syllabusText} onChange={setSyllabusText} label="Syllabus" placeholder="Paste the syllabus / unit list here…" rows={8} />
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Lectures</label>
              <input type="number" min={1} max={300} value={totalLectures} onChange={(e) => setTotalLectures(Number(e.target.value))} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Weeks</label>
              <input type="number" min={1} max={52} value={totalWeeks} onChange={(e) => setTotalWeeks(Number(e.target.value))} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Start date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500" />
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 mb-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            {plan && (
              <button type="button" onClick={() => setShowRegenerate(false)} className="h-10 px-4 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !selected || !syllabusText.trim()}
              className="flex-1 inline-flex items-center justify-center gap-2 h-10 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isGenerating ? 'Planning…' : plan ? 'Regenerate Plan' : 'Generate Plan'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{plan.title}</p>
              <p className="text-xs text-gray-400">{plan.totalLectures} lectures · {plan.totalWeeks} weeks · from {formatShort(plan.startDate)}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={openRegenerateForm} aria-label="Regenerate" className="w-9 h-9 rounded-xl border border-gray-200 text-gray-500 hover:text-violet-600 hover:bg-violet-50 flex items-center justify-center transition-colors">
                <RotateCcw className="w-4 h-4" />
              </button>
              <button onClick={handleDeletePlan} aria-label="Delete plan" className="w-9 h-9 rounded-xl border border-gray-200 text-gray-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 mb-4 w-fit">
            <button onClick={() => setView('week')} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${view === 'week' ? 'bg-violet-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
              <Layers className="w-3.5 h-3.5" /> Weekly
            </button>
            <button onClick={() => setView('month')} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${view === 'month' ? 'bg-violet-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
              <CalendarDays className="w-3.5 h-3.5" /> Monthly
            </button>
          </div>

          <div className="space-y-5">
            {grouped.map((group) => (
              <div key={group.key}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{group.key}</p>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                  {group.sessions.map((s) => (
                    <button
                      key={s.lectureNumber}
                      onClick={() => setEditing(s)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50/60 transition-colors"
                    >
                      {STATUS_ICON[s.status]}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${s.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                          {s.lectureNumber}. {s.title}
                        </p>
                        {s.description && <p className="text-xs text-gray-400 truncate">{s.description}</p>}
                      </div>
                      <span className="text-[11px] font-medium text-gray-400 shrink-0">{formatShort(s.date)}</span>
                      <Pencil className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                    </button>
                  ))}
                  <button
                    onClick={() => handleAddSession(Number(group.key.replace('Week ', '')) || group.sessions[0]?.week || 1, group.sessions[group.sessions.length - 1]?.date ?? plan.startDate)}
                    disabled={isAdding}
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-violet-600 hover:bg-violet-50 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add session
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {editing && plan && <EditSessionModal planId={plan._id} session={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
