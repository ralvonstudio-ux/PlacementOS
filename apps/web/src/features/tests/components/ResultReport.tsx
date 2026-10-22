import { useMemo, useState, type ReactNode } from 'react';
import {
  Globe, AppWindow, MonitorSmartphone, Compass, Clock, CalendarDays, CalendarCheck, PlayCircle, ShieldAlert,
  TrendingUp, TrendingDown, CheckCircle2, XCircle, MinusCircle, EyeOff, CircleDashed, ClipboardCheck,
  Target, Trophy, ListChecks, Timer, ChevronLeft, ChevronRight, Printer,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import type { TestResultAnalysis, TestResultAnalysisQuestion, TestSectionPerformance, TestTopicAnalysisRow } from '@placementos/types';

// ── Formatting ───────────────────────────────────────────────────────────────

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

/** "Aug 14, 2026 | 02:00 PM" */
function formatStamp(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${date} | ${time}`;
}

const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);

// ── Building blocks ──────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-slate-100 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ${className}`}>{children}</div>;
}

/** Section card with the soft indigo, wave-patterned title band. */
function Panel({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div
        className="flex items-center justify-between gap-3 px-6 py-4 bg-indigo-50/70 border-b border-indigo-100/60"
        style={{
          backgroundImage:
            'radial-gradient(circle at 0 100%, transparent 14px, rgba(99,102,241,0.06) 15px, transparent 16px), radial-gradient(circle at 100% 0, transparent 14px, rgba(99,102,241,0.06) 15px, transparent 16px)',
          backgroundSize: '32px 32px',
        }}
      >
        <h2 className="text-[15px] font-bold text-slate-900">{title}</h2>
        {right}
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </Card>
  );
}

function MetaItem({ icon: Icon, label, value, title }: { icon: typeof Globe; label: string; value: string; title?: string }) {
  return (
    <div className="flex items-start gap-2 min-w-0 text-sm">
      <Icon className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
      <span className="text-slate-500 shrink-0">{label}:</span>
      <span className="text-indigo-600 font-medium break-words min-w-0" title={title ?? value}>{value}</span>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, sub, tone }: { icon: typeof Globe; label: string; value: string; sub?: string; tone: string }) {
  return (
    <Card className="p-4 flex items-center gap-3.5">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-lg font-bold text-slate-900 leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
      </div>
    </Card>
  );
}

function ScoreRing({ score, total }: { score: number; total: number }) {
  const p = pct(score, total);
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = p >= 70 ? '#16a34a' : p >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative w-36 h-36 shrink-0">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#eef2ff" strokeWidth="12" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * p) / 100} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-2xl font-extrabold text-slate-900">{score}<span className="text-sm font-semibold text-slate-400">/{total}</span></p>
        <p className="text-xs font-semibold" style={{ color }}>{p}%</p>
      </div>
    </div>
  );
}

const TH = 'px-4 py-3.5 text-left text-sm font-semibold text-slate-800 whitespace-nowrap';
const TD = 'px-4 py-4 text-sm text-slate-700 whitespace-nowrap';

function Table({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100">
      <table className="min-w-full">
        <thead className="bg-indigo-50/80"><tr>{head}</tr></thead>
        <tbody className="divide-y divide-slate-100 bg-slate-50/30">{children}</tbody>
      </table>
    </div>
  );
}

// ── Summary tables ───────────────────────────────────────────────────────────

function PerformanceTable({ sections, totalRow }: { sections: TestSectionPerformance[]; totalRow: TestSectionPerformance }) {
  const rows = [...sections.map((s, i) => ({ s, n: String(i + 1) })), { s: { ...totalRow, section: 'Total' }, n: '' }];
  return (
    <Table
      head={['S.No', 'Section Name', 'Total Marks', 'My Score', 'Topper Score', 'Average Score', 'Least Score'].map((h) => <th key={h} className={TH}>{h}</th>)}
    >
      {rows.map(({ s, n }) => {
        const total = n === '';
        return (
          <tr key={s.section} className={total ? 'bg-indigo-50/50 font-semibold' : 'hover:bg-white'}>
            <td className={TD}>{n || '—'}</td>
            <td className={`${TD} whitespace-normal min-w-[200px] ${total ? 'text-slate-900' : ''}`}>{s.section}</td>
            <td className={TD}>{s.totalMarks}</td>
            <td className={TD}>
              <span className="font-semibold text-slate-900">{s.myScore}</span>
              <MiniBar value={s.myScore} max={s.totalMarks} />
            </td>
            <td className={`${TD} text-emerald-700`}>{s.topperScore.toFixed(2)}</td>
            <td className={TD}>{s.averageScore.toFixed(2)}</td>
            <td className={`${TD} text-slate-500`}>{s.leastScore.toFixed(2)}</td>
          </tr>
        );
      })}
    </Table>
  );
}

function MiniBar({ value, max }: { value: number; max: number }) {
  return (
    <div className="mt-1.5 h-1.5 w-20 rounded-full bg-slate-100 overflow-hidden">
      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, pct(value, max))}%` }} />
    </div>
  );
}

function QuestionStatusTable({ sections, totalRow }: { sections: TestSectionPerformance[]; totalRow: TestSectionPerformance }) {
  const rows = [...sections.map((s, i) => ({ s, n: String(i + 1) })), { s: { ...totalRow, section: 'Total' }, n: '' }];
  return (
    <Table
      head={['S.No', 'Section Name', 'Total', 'Attempted', 'Correct', 'Wrong', 'Partial', 'Skipped', 'Not Viewed'].map((h) => <th key={h} className={TH}>{h}</th>)}
    >
      {rows.map(({ s, n }) => (
        <tr key={s.section} className={n === '' ? 'bg-indigo-50/50 font-semibold' : 'hover:bg-white'}>
          <td className={TD}>{n || '—'}</td>
          <td className={`${TD} whitespace-normal min-w-[200px]`}>{s.section}</td>
          <td className={TD}>{s.totalQuestions}</td>
          <td className={TD}>{s.attempted}</td>
          <td className={`${TD} text-emerald-700`}>{s.correct}</td>
          <td className={`${TD} text-red-600`}>{s.wrong}</td>
          <td className={`${TD} text-amber-600`}>{s.partial}</td>
          <td className={`${TD} text-slate-500`}>{s.skipped}</td>
          <td className={`${TD} text-slate-400`}>{s.notViewed}</td>
        </tr>
      ))}
    </Table>
  );
}

/** My score vs the batch's average and topper, per section. */
function SectionComparison({ sections }: { sections: TestSectionPerformance[] }) {
  const legend = [
    { label: 'My Score', cls: 'bg-indigo-500' },
    { label: 'Average', cls: 'bg-sky-300' },
    { label: 'Topper', cls: 'bg-emerald-400' },
  ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
        {legend.map((l) => <span key={l.label} className="inline-flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-sm ${l.cls}`} />{l.label}</span>)}
      </div>
      {sections.map((s) => (
        <div key={s.section}>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="font-medium text-slate-800">{s.section}</span>
            <span className="text-slate-500 tabular-nums">{s.myScore} / {s.totalMarks}</span>
          </div>
          <div className="space-y-1">
            {[
              { v: s.myScore, cls: 'bg-indigo-500' },
              { v: s.averageScore, cls: 'bg-sky-300' },
              { v: s.topperScore, cls: 'bg-emerald-400' },
            ].map((b, i) => (
              <div key={i} className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full rounded-full ${b.cls}`} style={{ width: `${Math.min(100, pct(b.v, s.totalMarks))}%` }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TopicTable({ rows }: { rows: TestTopicAnalysisRow[] }) {
  if (!rows.length) return <p className="text-sm text-slate-400">No topic data.</p>;
  return (
    <Table
      head={['S.No', 'Topic', 'Sub Topic', 'Accuracy', 'Correct', 'Partial', 'Wrong', 'Skipped', 'Not Viewed', 'Total'].map((h) => <th key={h} className={TH}>{h}</th>)}
    >
      {rows.map((r, i) => (
        <tr key={`${r.topic}-${r.subTopic}-${i}`} className="hover:bg-white">
          <td className={TD}>{i + 1}</td>
          <td className={`${TD} font-medium text-slate-900`}>{r.topic}</td>
          <td className={TD}>{r.subTopic}</td>
          <td className={TD}>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${r.accuracy >= 70 ? 'bg-emerald-50 text-emerald-700' : r.accuracy >= 40 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'}`}>{r.accuracy}%</span>
          </td>
          <td className={`${TD} text-emerald-700`}>{r.correct}</td>
          <td className={`${TD} text-amber-600`}>{r.partial}</td>
          <td className={`${TD} text-red-600`}>{r.wrong}</td>
          <td className={`${TD} text-slate-500`}>{r.skipped}</td>
          <td className={`${TD} text-slate-400`}>{r.notViewed}</td>
          <td className={`${TD} font-semibold`}>{r.total}</td>
        </tr>
      ))}
    </Table>
  );
}

// ── Sections tab (question-by-question review) ──────────────────────────────

const STATUS_STYLE: Record<TestResultAnalysisQuestion['status'], { label: string; icon: typeof CheckCircle2; className: string }> = {
  correct: { label: 'Correct', icon: CheckCircle2, className: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  wrong: { label: 'Wrong', icon: XCircle, className: 'text-red-700 bg-red-50 border-red-200' },
  partial: { label: 'Partially Correct', icon: MinusCircle, className: 'text-amber-700 bg-amber-50 border-amber-200' },
  skipped: { label: 'Skipped', icon: CircleDashed, className: 'text-slate-600 bg-slate-100 border-slate-200' },
  not_viewed: { label: 'Not Viewed', icon: EyeOff, className: 'text-slate-400 bg-white border-slate-200' },
};

function SectionsTab({ questions }: { questions: TestResultAnalysisQuestion[] }) {
  const sectionNames = useMemo(() => [...new Set(questions.map((q) => q.section))], [questions]);
  const [activeSection, setActiveSection] = useState(sectionNames[0] ?? '');
  const [activeIndex, setActiveIndex] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const sectionQuestions = questions.filter((q) => q.section === activeSection);
  const q = sectionQuestions[activeIndex];

  const go = (i: number) => { setActiveIndex(i); setShowSolution(false); };

  if (!q) return <EmptyState icon={ShieldAlert} title="No questions" description="This test has no questions to review." />;
  const status = STATUS_STYLE[q.status];
  const StatusIcon = status.icon;

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_280px] gap-5">
      <div className="space-y-4 min-w-0">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {sectionNames.map((name) => (
            <button
              key={name}
              onClick={() => { setActiveSection(name); go(0); }}
              className={`shrink-0 h-9 px-4 rounded-lg text-sm font-medium transition-colors ${activeSection === name ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {name} <span className="opacity-70 text-xs">({questions.filter((x) => x.section === name).length})</span>
            </button>
          ))}
        </div>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-slate-500">Question {activeIndex + 1} of {sectionQuestions.length}</p>
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${status.className}`}>
              <StatusIcon className="w-3.5 h-3.5" /> {status.label}
            </span>
          </div>

          <p className="text-base text-slate-900 whitespace-pre-wrap mb-5 leading-relaxed">{q.questionText}</p>

          {q.questionType === 'mcq' ? (
            <div className="space-y-2.5 mb-5">
              {(q.options ?? []).map((opt, i) => {
                const isSelected = q.selectedOption === opt;
                const isCorrect = q.correctAnswer === opt;
                const highlight = isCorrect ? 'border-emerald-400 bg-emerald-50' : isSelected ? 'border-red-400 bg-red-50' : 'border-slate-200';
                return (
                  <div key={i} className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border ${highlight}`}>
                    <span className="text-sm text-slate-700"><span className="font-semibold text-slate-400 mr-2">{String.fromCharCode(65 + i)}.</span>{opt}</span>
                    {isSelected && <span className={`text-xs font-semibold ${isCorrect ? 'text-emerald-700' : 'text-red-700'}`}>Your answer</span>}
                    {!isSelected && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs text-slate-400 mb-1">Your answer</p>
              <p className="text-sm text-slate-800 whitespace-pre-wrap font-mono">{q.answerText || q.selectedOption || '—'}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500 border-t border-slate-100 pt-4 mb-3">
            <span>Marks: <span className="font-semibold text-slate-800">{q.marksObtained}/{q.marks}</span></span>
            {q.level && <span>Level: <span className="font-medium capitalize text-slate-800">{q.level}</span></span>}
            <span>Type: <span className="font-medium capitalize text-slate-800">{q.questionType.replace('_', ' ')}</span></span>
            {q.topic && <span>Topic: <span className="font-medium text-slate-800">{q.topic}</span></span>}
          </div>

          {q.correctAnswer && (
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={showSolution} onChange={(e) => setShowSolution(e.target.checked)} className="accent-indigo-600" />
              Show solution
            </label>
          )}
          {showSolution && q.correctAnswer && (
            <div className="mt-3 rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3 text-sm text-indigo-800">
              Correct answer: <span className="font-semibold">{q.correctAnswer}</span>
            </div>
          )}
        </Card>

        <div className="flex items-center justify-between">
          <button onClick={() => go(Math.max(0, activeIndex - 1))} disabled={activeIndex === 0} className="inline-flex items-center gap-1 h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-30">
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <button onClick={() => go(Math.min(sectionQuestions.length - 1, activeIndex + 1))} disabled={activeIndex === sectionQuestions.length - 1} className="inline-flex items-center gap-1 h-10 px-4 rounded-xl bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-30">
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <Card className="p-5 h-fit lg:sticky lg:top-4">
        <p className="text-sm font-semibold text-slate-900 mb-3">{activeSection}</p>
        <div className="grid grid-cols-5 gap-2">
          {sectionQuestions.map((sq, i) => (
            <button
              key={sq.questionIndex}
              onClick={() => go(i)}
              title={STATUS_STYLE[sq.status].label}
              className={`h-9 rounded-lg text-xs font-semibold border transition-shadow ${STATUS_STYLE[sq.status].className} ${i === activeIndex ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <div className="mt-4 space-y-1.5">
          {Object.values(STATUS_STYLE).map((s) => (
            <p key={s.label} className="flex items-center gap-2 text-xs text-slate-500"><span className={`w-3 h-3 rounded border ${s.className}`} />{s.label}</p>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── The report ───────────────────────────────────────────────────────────────

export function ResultReport({ data, backAction }: { data: TestResultAnalysis; backAction?: ReactNode }) {
  const [tab, setTab] = useState<'summary' | 'sections'>('summary');
  const t = data.totalRow;
  const accuracy = pct(t.correct, t.attempted);
  const ip = data.ipAddresses.length ? data.ipAddresses[data.ipAddresses.length - 1] : '—';

  return (
    <div className="min-h-full bg-slate-50/60">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-8 py-4 bg-white border-b border-slate-100 print:hidden">
        <div className="flex items-center gap-3 min-w-0">
          {backAction}
          <ClipboardCheck className="w-5 h-5 text-slate-700 shrink-0" />
          <h1 className="text-lg font-semibold text-slate-900 truncate">Result &amp; Analysis</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()} className="hidden sm:inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">
            <Printer className="w-4 h-4" /> Print
          </button>
          <span className="inline-flex items-center h-10 px-3.5 rounded-xl border border-slate-200 text-sm text-slate-600">Attempt 1 <span className="text-slate-400 ml-1.5">of 01</span></span>
        </div>
      </div>

      <div className="px-4 sm:px-8 py-6 space-y-5 max-w-[1400px] mx-auto">
        <Card className="px-6 py-5">
          <div className="flex flex-wrap items-center gap-y-2 text-[15px] [&>*:not(:last-child)]:sm:border-r [&>*:not(:last-child)]:sm:border-slate-200 [&>*]:sm:px-5 [&>*:first-child]:sm:pl-0">
            <span className="w-full sm:w-auto"><span className="text-slate-500">Student: </span><span className="font-semibold text-slate-900">{data.candidateName}</span></span>
            {data.candidateEmail && <span className="w-full sm:w-auto"><span className="text-slate-500">Email id: </span><span className="font-semibold text-slate-900 break-all">{data.candidateEmail}</span></span>}
            <span className="w-full sm:w-auto"><span className="text-slate-500">Test: </span><span className="font-semibold text-slate-900">{data.testTitle}</span></span>
            {(data.batch || data.track) && <span className="w-full sm:w-auto"><span className="text-slate-500">Batch: </span><span className="font-semibold text-slate-900">{[data.batch, data.track].filter(Boolean).join(' · ')}</span></span>}
          </div>
        </Card>

        <Card className="px-6 py-5">
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-x-6 gap-y-3.5">
            <MetaItem icon={Globe} label="IP Address" value={ip} title={data.ipAddresses.join(', ')} />
            <MetaItem icon={AppWindow} label="Tab Switches" value={data.tabSwitches ? String(data.tabSwitches) : '--'} />
            <MetaItem icon={MonitorSmartphone} label="OS Used" value={data.os ?? '—'} />
            <MetaItem icon={Compass} label="Browser Used" value={data.browser ?? '—'} />
            <MetaItem icon={Clock} label="Test Duration" value={formatDuration(data.durationSeconds)} />
            <MetaItem icon={CalendarDays} label="Test Start Time" value={formatStamp(data.startedAt)} />
            <MetaItem icon={CalendarCheck} label="Test Submit Time" value={formatStamp(data.submittedAt)} />
            <MetaItem icon={PlayCircle} label="Resume Count" value={String(data.resumeCount)} />
          </div>
          {data.autoSubmitted && (
            <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 px-3 py-1.5 rounded-full">
              <ShieldAlert className="w-3.5 h-3.5" /> Auto-submitted by proctoring · {data.violationCount} violation(s) logged
            </p>
          )}
        </Card>

        <div className="inline-flex p-1 bg-white rounded-xl border border-slate-100 shadow-sm print:hidden">
          {(['summary', 'sections'] as const).map((k) => (
            <button key={k} onClick={() => setTab(k)} className={`h-10 px-6 rounded-lg text-sm font-semibold capitalize transition-colors ${tab === k ? 'bg-indigo-600 text-white shadow' : 'text-slate-700 hover:bg-slate-50'}`}>
              {k}
            </button>
          ))}
        </div>

        {tab === 'summary' ? (
          <div className="space-y-5">
            <div className="grid lg:grid-cols-[auto_minmax(0,1fr)] gap-5">
              <Card className="p-6 flex items-center gap-6">
                <ScoreRing score={data.myScore} total={data.totalMarks} />
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Overall Score</p>
                  <p className="text-sm text-slate-600 mt-1">Topper: <span className="font-semibold text-emerald-700">{t.topperScore.toFixed(2)}</span></p>
                  <p className="text-sm text-slate-600">Average: <span className="font-semibold text-slate-900">{t.averageScore.toFixed(2)}</span></p>
                  <p className="text-sm text-slate-600">Least: <span className="font-semibold text-slate-500">{t.leastScore.toFixed(2)}</span></p>
                </div>
              </Card>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <StatTile icon={ListChecks} label="Attempted" value={`${t.attempted}/${t.totalQuestions}`} sub={`${pct(t.attempted, t.totalQuestions)}% of paper`} tone="bg-indigo-50 text-indigo-600" />
                <StatTile icon={Target} label="Accuracy" value={`${accuracy}%`} sub={`${t.correct} correct · ${t.wrong} wrong`} tone="bg-emerald-50 text-emerald-600" />
                <StatTile icon={Trophy} label="vs Topper" value={`${pct(data.myScore, t.topperScore || 1)}%`} sub="of the top score" tone="bg-amber-50 text-amber-600" />
                <StatTile icon={Timer} label="Time Taken" value={formatDuration(data.durationSeconds)} sub={`${t.attempted ? Math.round(data.durationSeconds / t.attempted) : 0}s per attempted Q`} tone="bg-sky-50 text-sky-600" />
              </div>
            </div>

            <Panel title="Performance Status"><PerformanceTable sections={data.sections} totalRow={data.totalRow} /></Panel>
            <Panel title="Section-wise Comparison"><SectionComparison sections={data.sections} /></Panel>
            <Panel title="Question Status"><QuestionStatusTable sections={data.sections} totalRow={data.totalRow} /></Panel>

            <div className="grid sm:grid-cols-2 gap-5">
              <Card className="p-5">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 mb-3"><TrendingUp className="w-4 h-4" /> Top Performing Topics</p>
                {data.topPerforming.length ? (
                  <div className="flex flex-wrap gap-2">{data.topPerforming.map((x) => <span key={x} className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium">{x}</span>)}</div>
                ) : <p className="text-sm text-slate-400">None yet</p>}
              </Card>
              <Card className="p-5">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-red-600 mb-3"><TrendingDown className="w-4 h-4" /> Needs Improvement</p>
                {data.leastPerforming.length ? (
                  <div className="flex flex-wrap gap-2">{data.leastPerforming.map((x) => <span key={x} className="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-xs font-medium">{x}</span>)}</div>
                ) : <p className="text-sm text-slate-400">None</p>}
              </Card>
            </div>

            <Panel title="Topic Wise Analysis — Count"><TopicTable rows={data.countWiseAnalysis} /></Panel>
            <Panel title="Topic Wise Analysis — Marks"><TopicTable rows={data.marksWiseAnalysis} /></Panel>
          </div>
        ) : (
          <SectionsTab questions={data.questions} />
        )}
      </div>
    </div>
  );
}
