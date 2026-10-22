import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Globe, MonitorSmartphone, Chrome, Clock, RefreshCw, Calendar, CalendarCheck, ShieldAlert,
  TrendingUp, TrendingDown, CheckCircle2, XCircle, MinusCircle, EyeOff, CircleDashed, ChevronLeft,
} from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTestResultAnalysis } from '../hooks/useTests';
import type { TestResultAnalysisQuestion, TestSectionPerformance, TestTopicAnalysisRow } from '@placementos/types';

const TAB_ACTIVE = 'bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 text-white';

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0
    ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function InfoStat({ icon: Icon, label, value }: { icon: typeof Globe; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-800 break-words">{value}</p>
      </div>
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-sm text-gray-700 whitespace-nowrap ${className}`}>{children}</td>;
}

function PerformanceTable({ sections, totalRow }: { sections: TestSectionPerformance[]; totalRow: TestSectionPerformance }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="min-w-full divide-y divide-gray-100">
        <thead className="bg-gray-50">
          <tr>
            <Th>#</Th><Th>Section</Th><Th className="text-right">Total Marks</Th><Th className="text-right">My Score</Th>
            <Th className="text-right">Topper Score</Th><Th className="text-right">Average Score</Th><Th className="text-right">Least Score</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {sections.map((s, i) => (
            <tr key={s.section}>
              <Td>{i + 1}</Td><Td className="font-medium text-gray-900">{s.section}</Td>
              <Td className="text-right">{s.totalMarks}</Td><Td className="text-right font-semibold text-gray-900">{s.myScore}</Td>
              <Td className="text-right text-green-700">{s.topperScore.toFixed(2)}</Td>
              <Td className="text-right text-gray-500">{s.averageScore.toFixed(2)}</Td>
              <Td className="text-right text-gray-400">{s.leastScore.toFixed(2)}</Td>
            </tr>
          ))}
          <tr className="bg-gray-50 font-semibold">
            <Td className="text-gray-400">—</Td><Td className="text-gray-900">Total</Td>
            <Td className="text-right">{totalRow.totalMarks}</Td><Td className="text-right">{totalRow.myScore}</Td>
            <Td className="text-right text-green-700">{totalRow.topperScore.toFixed(2)}</Td>
            <Td className="text-right text-gray-500">{totalRow.averageScore.toFixed(2)}</Td>
            <Td className="text-right text-gray-400">{totalRow.leastScore.toFixed(2)}</Td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function QuestionStatusTable({ sections, totalRow }: { sections: TestSectionPerformance[]; totalRow: TestSectionPerformance }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="min-w-full divide-y divide-gray-100">
        <thead className="bg-gray-50">
          <tr>
            <Th>#</Th><Th>Section</Th><Th className="text-right">Total</Th><Th className="text-right">Attempted</Th>
            <Th className="text-right">Correct</Th><Th className="text-right">Wrong</Th><Th className="text-right">Partial</Th>
            <Th className="text-right">Not Viewed</Th><Th className="text-right">Skipped</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {sections.map((s, i) => (
            <tr key={s.section}>
              <Td>{i + 1}</Td><Td className="font-medium text-gray-900">{s.section}</Td>
              <Td className="text-right">{s.totalQuestions}</Td><Td className="text-right">{s.attempted}</Td>
              <Td className="text-right text-green-700">{s.correct}</Td><Td className="text-right text-red-600">{s.wrong}</Td>
              <Td className="text-right text-amber-600">{s.partial}</Td><Td className="text-right text-gray-400">{s.notViewed}</Td>
              <Td className="text-right text-gray-400">{s.skipped}</Td>
            </tr>
          ))}
          <tr className="bg-gray-50 font-semibold">
            <Td className="text-gray-400">—</Td><Td className="text-gray-900">Total</Td>
            <Td className="text-right">{totalRow.totalQuestions}</Td><Td className="text-right">{totalRow.attempted}</Td>
            <Td className="text-right text-green-700">{totalRow.correct}</Td><Td className="text-right text-red-600">{totalRow.wrong}</Td>
            <Td className="text-right text-amber-600">{totalRow.partial}</Td><Td className="text-right text-gray-400">{totalRow.notViewed}</Td>
            <Td className="text-right text-gray-400">{totalRow.skipped}</Td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function TopicTable({ rows, marksMode }: { rows: TestTopicAnalysisRow[]; marksMode: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="min-w-full divide-y divide-gray-100">
        <thead className="bg-gray-50">
          <tr>
            <Th>#</Th><Th>Subject</Th><Th>Topic</Th><Th>Sub Topic</Th><Th className="text-right">Accuracy</Th>
            <Th className="text-right">Correct</Th><Th className="text-right">Partial</Th><Th className="text-right">Wrong</Th>
            <Th className="text-right">Skipped</Th><Th className="text-right">Not Viewed</Th><Th className="text-right">Total</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((r, i) => (
            <tr key={`${r.topic}-${r.subTopic}-${i}`}>
              <Td>{i + 1}</Td><Td>{r.subject}</Td><Td className="font-medium text-gray-900">{r.topic}</Td><Td>{r.subTopic}</Td>
              <Td className="text-right">
                <span className={`font-semibold ${r.accuracy === 100 ? 'text-green-700' : r.accuracy === 0 ? 'text-gray-400' : 'text-amber-600'}`}>{r.accuracy}%</span>
              </Td>
              <Td className="text-right text-green-700">{r.correct}</Td><Td className="text-right text-amber-600">{r.partial}</Td>
              <Td className="text-right text-red-600">{r.wrong}</Td><Td className="text-right text-gray-400">{r.skipped}</Td>
              <Td className="text-right text-gray-400">{r.notViewed}</Td><Td className="text-right font-medium">{marksMode ? r.total : r.total}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const STATUS_STYLE: Record<TestResultAnalysisQuestion['status'], { label: string; icon: typeof CheckCircle2; className: string }> = {
  correct: { label: 'Correct', icon: CheckCircle2, className: 'text-green-700 bg-green-50' },
  wrong: { label: 'Wrong', icon: XCircle, className: 'text-red-700 bg-red-50' },
  partial: { label: 'Partially Correct', icon: MinusCircle, className: 'text-amber-700 bg-amber-50' },
  skipped: { label: 'Skipped', icon: CircleDashed, className: 'text-gray-500 bg-gray-100' },
  not_viewed: { label: 'Not Viewed', icon: EyeOff, className: 'text-gray-400 bg-gray-100' },
};

function SectionsTab({ questions }: { questions: TestResultAnalysisQuestion[] }) {
  const sectionNames = useMemo(() => [...new Set(questions.map((q) => q.section))], [questions]);
  const [activeSection, setActiveSection] = useState(sectionNames[0] ?? '');
  const sectionQuestions = questions.filter((q) => q.section === activeSection);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const q = sectionQuestions[activeIndex];

  function selectSection(name: string) {
    setActiveSection(name);
    setActiveIndex(0);
    setShowSolution(false);
  }

  if (!q) return <EmptyState icon={ShieldAlert} title="No questions" description="This test has no questions to review." />;

  const status = STATUS_STYLE[q.status];
  const StatusIcon = status.icon;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {sectionNames.map((name, i) => (
          <button
            key={name}
            onClick={() => selectSection(name)}
            className={`shrink-0 inline-flex items-center gap-2 h-9 px-3.5 rounded-xl text-sm font-medium transition-colors ${
              activeSection === name ? TAB_ACTIVE : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${activeSection === name ? 'bg-white/20' : 'bg-white text-gray-500'}`}>{i + 1}</span>
            {name}
            <span className="opacity-70 text-xs">({questions.filter((qq) => qq.section === name).length})</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {sectionQuestions.map((sq, i) => {
          const st = STATUS_STYLE[sq.status];
          return (
            <button
              key={sq.questionIndex}
              onClick={() => { setActiveIndex(i); setShowSolution(false); }}
              className={`w-9 h-9 rounded-lg text-xs font-semibold border transition-colors ${
                i === activeIndex ? 'border-purple-500 ring-2 ring-purple-200' : 'border-transparent'
              } ${st.className}`}
              title={st.label}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Question No: {q.questionIndex + 1}</p>
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${status.className}`}>
            <StatusIcon className="w-3.5 h-3.5" /> {status.label}
          </span>
        </div>

        <p className="text-base text-gray-900 whitespace-pre-wrap mb-5">{q.questionText}</p>

        {q.questionType === 'mcq' ? (
          <div className="space-y-2.5 mb-5">
            {(q.options ?? []).map((opt, i) => {
              const isSelected = q.selectedOption === opt;
              const isCorrect = q.correctAnswer === opt;
              const highlight = isCorrect ? 'border-green-500 bg-green-50' : isSelected ? 'border-red-500 bg-red-50' : 'border-gray-200';
              return (
                <div key={i} className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border ${highlight}`}>
                  <span className="text-sm text-gray-700">{opt}</span>
                  {isSelected && <span className={`text-xs font-semibold ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>Your answer</span>}
                  {!isSelected && isCorrect && <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mb-5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-xs text-gray-400 mb-1">Candidate's answer</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{q.answerText || q.selectedOption || '—'}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-500 border-t border-gray-50 pt-4 mb-3">
          <span><span className="text-gray-400">Marks:</span> <span className="font-semibold text-gray-700">{q.marksObtained}/{q.marks}</span></span>
          {q.level && <span><span className="text-gray-400">Level:</span> <span className="font-medium capitalize text-gray-700">{q.level}</span></span>}
          <span><span className="text-gray-400">Type:</span> <span className="font-medium text-gray-700 capitalize">{q.questionType.replace('_', ' ')}</span></span>
          <span><span className="text-gray-400">Topic:</span> <span className="font-medium text-gray-700">{q.section}</span></span>
          {q.topic && <span><span className="text-gray-400">Sub Topic:</span> <span className="font-medium text-gray-700">{q.topic}</span></span>}
        </div>

        {q.correctAnswer && (
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showSolution} onChange={(e) => setShowSolution(e.target.checked)} className="accent-purple-600" />
            Show solution
          </label>
        )}
        {showSolution && q.correctAnswer && (
          <div className="mt-3 rounded-xl bg-purple-50 border border-purple-100 px-4 py-3 text-sm text-purple-800">
            Correct answer: <span className="font-semibold">{q.correctAnswer}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
          disabled={activeIndex === 0}
          className="h-9 px-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-30"
        >
          Previous
        </button>
        <button
          onClick={() => setActiveIndex((i) => Math.min(sectionQuestions.length - 1, i + 1))}
          disabled={activeIndex === sectionQuestions.length - 1}
          className={`h-9 px-4 rounded-xl text-sm font-semibold disabled:opacity-30 ${TAB_ACTIVE}`}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function TestResultAnalysisPage() {
  const { id, attemptId } = useParams<{ id: string; attemptId: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useTestResultAnalysis(id ?? null, attemptId ?? null);
  const [tab, setTab] = useState<'summary' | 'sections'>('summary');

  return (
    <PageContainer>
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
        <ChevronLeft className="w-4 h-4" /> Back to review
      </button>
      <WorkspaceHeader
        title={data ? `${data.candidateName} — Result & Analysis` : 'Result & Analysis'}
        subtitle={data?.testTitle}
      />

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : !data ? (
        <EmptyState icon={ShieldAlert} title="Not found" description="Couldn't load this attempt's result analysis." />
      ) : (
        <div className="space-y-5 max-w-6xl">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-base font-semibold text-gray-900">{data.candidateName}</p>
                {data.candidateEmail && <p className="text-xs text-gray-500">{data.candidateEmail}</p>}
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">{data.myScore} <span className="text-sm font-normal text-gray-400">/ {data.totalMarks}</span></p>
                <p className="text-xs text-gray-400">Total score</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <InfoStat icon={Globe} label="IP Address" value={data.ipAddresses.length ? data.ipAddresses.join(', ') : '—'} />
              <InfoStat icon={ShieldAlert} label="Tab Switches" value={String(data.tabSwitches)} />
              <InfoStat icon={MonitorSmartphone} label="OS Used" value={data.os ?? '—'} />
              <InfoStat icon={Chrome} label="Browser Used" value={data.browser ?? '—'} />
              <InfoStat icon={Clock} label="Test Duration" value={formatDuration(data.durationSeconds)} />
              <InfoStat icon={Calendar} label="Test Start Time" value={new Date(data.startedAt).toLocaleString()} />
              <InfoStat icon={CalendarCheck} label="Test Submit Time" value={data.submittedAt ? new Date(data.submittedAt).toLocaleString() : '—'} />
              <InfoStat icon={RefreshCw} label="Resume Count" value={String(data.resumeCount)} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setTab('summary')} className={`h-9 px-4 rounded-xl text-sm font-semibold transition-colors ${tab === 'summary' ? TAB_ACTIVE : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>Summary</button>
            <button onClick={() => setTab('sections')} className={`h-9 px-4 rounded-xl text-sm font-semibold transition-colors ${tab === 'sections' ? TAB_ACTIVE : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>Sections</button>
          </div>

          {tab === 'summary' ? (
            <div className="space-y-6">
              <section>
                <h2 className="text-sm font-semibold text-gray-900 mb-3">Performance Status</h2>
                <PerformanceTable sections={data.sections} totalRow={data.totalRow} />
              </section>

              <section>
                <h2 className="text-sm font-semibold text-gray-900 mb-3">Question Status</h2>
                <QuestionStatusTable sections={data.sections} totalRow={data.totalRow} />
              </section>

              <section>
                <h2 className="text-sm font-semibold text-gray-900 mb-3">Topic Wise Analysis</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-green-700 mb-2"><TrendingUp className="w-3.5 h-3.5" /> Top Performing</p>
                    {data.topPerforming.length ? (
                      <ul className="space-y-1">{data.topPerforming.map((t) => <li key={t} className="text-sm text-gray-700">{t}</li>)}</ul>
                    ) : <p className="text-sm text-gray-400">None yet</p>}
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-red-700 mb-2"><TrendingDown className="w-3.5 h-3.5" /> Least Performing</p>
                    {data.leastPerforming.length ? (
                      <ul className="space-y-1">{data.leastPerforming.map((t) => <li key={t} className="text-sm text-gray-700">{t}</li>)}</ul>
                    ) : <p className="text-sm text-gray-400">None</p>}
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-sm font-semibold text-gray-900 mb-3">Count Wise</h2>
                <TopicTable rows={data.countWiseAnalysis} marksMode={false} />
              </section>

              <section>
                <h2 className="text-sm font-semibold text-gray-900 mb-3">Marks Wise</h2>
                <TopicTable rows={data.marksWiseAnalysis} marksMode />
              </section>
            </div>
          ) : (
            <SectionsTab questions={data.questions} />
          )}
        </div>
      )}
    </PageContainer>
  );
}
