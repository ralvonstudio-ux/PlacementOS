import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Trash2, Save, Loader2, Eye, EyeOff, ChevronDown, ChevronRight, ListChecks, Code2, PencilLine,
  ShieldCheck, Wand2, Layers, ArrowUp, ArrowDown, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { useCreateTest, useLoadSampleTemplate } from '../hooks/useTests';
import { extractErrorMessage } from '@/services/api';
import type { CodingLanguage, CreateTestPayload, TestCase, TestQuestionSnapshot, TestQuestionType } from '@placementos/types';

const inputCls = 'w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500';
const textareaCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500';
const monoCls = 'w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-mono resize-y focus:outline-none focus:ring-1 focus:ring-violet-400';

export const ALL_LANGUAGES: { value: CodingLanguage; label: string }[] = [
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'javascript', label: 'JavaScript' },
];

const TYPE_LABEL: Record<TestQuestionType, string> = { mcq: 'MCQ', coding: 'Coding', short_answer: 'Short answer' };

const PROCTORING_RULES = [
  'Fullscreen enforced — leaving it pauses the test and logs a violation',
  'Tab / window switching detected and logged',
  'Copy, cut, paste, right-click and text selection blocked',
  'Browser extensions detected (injected scripts, known extensions, ad-blockers)',
  'DevTools shortcuts blocked and DevTools detection',
  'Camera and screen share required for the whole test',
  'Auto-submit once the violation limit is exceeded',
];

type BuilderQuestion = Omit<TestQuestionSnapshot, 'sectionIndex'>;
interface BuilderSection {
  title: string;
  description: string;
  questions: BuilderQuestion[];
}

function newQuestion(type: TestQuestionType): BuilderQuestion {
  if (type === 'coding') {
    return {
      questionText: '',
      questionType: 'coding',
      marks: 10,
      allowedLanguages: ALL_LANGUAGES.map((l) => l.value),
      starterCode: {},
      testCases: [
        { input: '', expectedOutput: '', hidden: false },
        { input: '', expectedOutput: '', hidden: true },
      ],
    };
  }
  if (type === 'mcq') return { questionText: '', questionType: 'mcq', options: ['', '', '', ''], correctAnswer: '', marks: 2 };
  return { questionText: '', questionType: 'short_answer', correctAnswer: '', marks: 2 };
}

const emptySection = (n: number): BuilderSection => ({ title: `Section ${String.fromCharCode(64 + n)}`, description: '', questions: [] });

/** Everything that would make the server reject the test (or make it un-gradable), listed
 *  up front with where it is — instead of one opaque error after hitting Save. */
function validate(title: string, sections: BuilderSection[]): string[] {
  const errors: string[] = [];
  if (!title.trim()) errors.push('Give the test a title.');
  if (sections.every((s) => s.questions.length === 0)) errors.push('Add at least one question.');
  sections.forEach((s, si) => {
    const where = (qi: number) => `${s.title || `Section ${si + 1}`} · Q${qi + 1}`;
    if (!s.title.trim()) errors.push(`Section ${si + 1} needs a title.`);
    if (s.questions.length === 0) errors.push(`${s.title || `Section ${si + 1}`} has no questions — add some or delete it.`);
    s.questions.forEach((q, qi) => {
      if (!q.questionText.trim()) errors.push(`${where(qi)}: question text is empty.`);
      if (q.questionType === 'mcq') {
        const opts = (q.options ?? []).filter((o) => o.trim());
        if (opts.length < 2) errors.push(`${where(qi)}: needs at least 2 options.`);
        if (!q.correctAnswer || !opts.includes(q.correctAnswer)) errors.push(`${where(qi)}: mark the correct option.`);
      }
      if (q.questionType === 'coding') {
        if (!q.allowedLanguages?.length) errors.push(`${where(qi)}: allow at least one language.`);
        const cases = q.testCases ?? [];
        if (cases.length === 0) errors.push(`${where(qi)}: add at least one test case.`);
        if (cases.some((tc) => !tc.expectedOutput.trim())) errors.push(`${where(qi)}: every test case needs an expected output.`);
        if (!cases.some((tc) => !tc.hidden)) errors.push(`${where(qi)}: add at least one visible sample case so candidates can Run.`);
      }
    });
  });
  return errors;
}

export function ManualTestBuilder({ basePath }: { basePath: string }) {
  const navigate = useNavigate();
  const createTest = useCreateTest();
  const loadSample = useLoadSampleTemplate();

  const [title, setTitle] = useState('');
  const [track, setTrack] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [violationLimit, setViolationLimit] = useState(3);
  const [sections, setSections] = useState<BuilderSection[]>([{ ...emptySection(1), title: 'Section A — MCQ' }]);
  // Keys are `${sectionIndex}:${questionIndex}` — which question cards are expanded.
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<string[]>([]);
  const [serverError, setServerError] = useState('');

  const allQuestions = sections.flatMap((s) => s.questions);
  const totalMarks = allQuestions.reduce((sum, q) => sum + (q.marks || 0), 0);

  function patchSection(si: number, patch: Partial<BuilderSection>) {
    setSections((prev) => prev.map((s, i) => (i === si ? { ...s, ...patch } : s)));
  }

  function patchQuestion(si: number, qi: number, patch: Partial<BuilderQuestion>) {
    setSections((prev) => prev.map((s, i) => (i === si ? { ...s, questions: s.questions.map((q, j) => (j === qi ? { ...q, ...patch } : q)) } : s)));
  }

  function addQuestion(si: number, type: TestQuestionType) {
    const qi = sections[si].questions.length;
    patchSection(si, { questions: [...sections[si].questions, newQuestion(type)] });
    setOpen((prev) => new Set(prev).add(`${si}:${qi}`));
  }

  function removeQuestion(si: number, qi: number) {
    patchSection(si, { questions: sections[si].questions.filter((_, j) => j !== qi) });
    setOpen(new Set());
  }

  function moveQuestion(si: number, qi: number, dir: -1 | 1) {
    const qs = [...sections[si].questions];
    const target = qi + dir;
    if (target < 0 || target >= qs.length) return;
    [qs[qi], qs[target]] = [qs[target], qs[qi]];
    patchSection(si, { questions: qs });
    setOpen(new Set());
  }

  function removeSection(si: number) {
    if (sections[si].questions.length && !window.confirm(`Delete "${sections[si].title}" and its ${sections[si].questions.length} question(s)?`)) return;
    setSections((prev) => prev.filter((_, i) => i !== si));
    setOpen(new Set());
  }

  function toggle(key: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function applyTemplate(t: CreateTestPayload) {
    setTitle(t.title);
    setTrack(t.track ?? '');
    setDescription(t.description ?? '');
    setInstructions(t.instructions ?? '');
    setDurationMinutes(t.durationMinutes);
    setViolationLimit(t.violationLimit);
    const templateSections = t.sections?.length ? t.sections : [{ title: 'Questions' }];
    setSections(
      templateSections.map((s, si) => ({
        title: s.title,
        description: s.description ?? '',
        questions: t.questions.filter((q) => (q.sectionIndex ?? 0) === si).map(({ sectionIndex: _ignored, ...q }) => q),
      }))
    );
    setOpen(new Set());
    setErrors([]);
  }

  async function handleLoadSample() {
    const hasWork = title.trim() || allQuestions.some((q) => q.questionText.trim());
    if (hasWork && !window.confirm('Replace everything in the builder with the sample test?')) return;
    setServerError('');
    try {
      applyTemplate(await loadSample.mutateAsync());
    } catch (err) {
      setServerError(extractErrorMessage(err));
    }
  }

  async function handleSave() {
    setServerError('');
    const found = validate(title, sections);
    setErrors(found);
    if (found.length) return;
    try {
      await createTest.mutateAsync({
        title: title.trim(),
        track: track.trim() || undefined,
        description: description.trim() || undefined,
        instructions: instructions.trim() || undefined,
        sections: sections.map((s) => ({ title: s.title.trim(), description: s.description.trim() || undefined })),
        questions: sections.flatMap((s, si) =>
          s.questions.map((q) => ({
            ...q,
            sectionIndex: si,
            options: q.questionType === 'mcq' ? q.options?.filter((o) => o.trim()) : undefined,
            correctAnswer: q.questionType === 'coding' ? undefined : q.correctAnswer,
          }))
        ),
        durationMinutes,
        violationLimit,
      });
      navigate(`${basePath}/tests`);
    } catch (err) {
      setServerError(extractErrorMessage(err));
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-6 max-w-6xl">
      <div className="space-y-5 min-w-0">
        {/* ── Details ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-base font-bold text-gray-900">Test details</h2>
            <button
              type="button"
              onClick={handleLoadSample}
              disabled={loadSample.isPending}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-violet-200 bg-violet-50 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50"
            >
              {loadSample.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              Load sample (10 MCQ + 5 Coding)
            </button>
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Test title, e.g. Campus Hiring Assessment — Round 1" className={inputCls} />
          <input value={track} onChange={(e) => setTrack(e.target.value)} placeholder="Track (optional), e.g. DSA" className={inputCls} />
          <div>
            <label className="block text-xs text-gray-500 mb-1">About this test — shown to candidates before they start</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What the test covers, who it's for, how it's scored…" className={textareaCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Instructions — one per line</label>
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} placeholder={'Read input from stdin and print only the answer.\nNo negative marking.'} className={textareaCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Duration (minutes)</label>
              <input type="number" min={1} value={durationMinutes} onChange={(e) => setDurationMinutes(Math.max(1, Number(e.target.value)))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Violations allowed before auto-submit</label>
              <input type="number" min={1} value={violationLimit} onChange={(e) => setViolationLimit(Math.max(1, Number(e.target.value)))} className={inputCls} />
            </div>
          </div>
        </div>

        {/* ── Sections ── */}
        {sections.map((section, si) => (
          <div key={si} className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="p-5 border-b border-gray-100 space-y-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-violet-500 shrink-0" />
                <input
                  value={section.title}
                  onChange={(e) => patchSection(si, { title: e.target.value })}
                  placeholder="Section title"
                  className="flex-1 min-w-0 h-9 px-2 rounded-lg border border-transparent hover:border-gray-200 focus:border-violet-500 text-sm font-bold text-gray-900 focus:outline-none"
                />
                <span className="text-xs text-gray-400 shrink-0">
                  {section.questions.length} Q · {section.questions.reduce((sum, q) => sum + (q.marks || 0), 0)} marks
                </span>
                {sections.length > 1 && (
                  <button type="button" onClick={() => removeSection(si)} title="Delete section" className="p-1.5 text-gray-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <input
                value={section.description}
                onChange={(e) => patchSection(si, { description: e.target.value })}
                placeholder="Section note (optional), e.g. 2 marks each · no negative marking"
                className="w-full h-8 px-2 rounded-lg border border-transparent hover:border-gray-200 focus:border-violet-500 text-xs text-gray-500 focus:outline-none"
              />
            </div>

            <div className="p-5 space-y-3">
              {section.questions.length === 0 && <p className="text-sm text-gray-400">No questions yet — add one below.</p>}
              {section.questions.map((q, qi) => {
                const key = `${si}:${qi}`;
                const isOpen = open.has(key);
                return (
                  <div key={key} className="rounded-xl border border-gray-200">
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <button type="button" onClick={() => toggle(key)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                        {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                        <span className="text-xs font-semibold text-gray-400 shrink-0">Q{qi + 1}</span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${q.questionType === 'coding' ? 'bg-sky-50 text-sky-700' : q.questionType === 'mcq' ? 'bg-violet-50 text-violet-700' : 'bg-gray-100 text-gray-600'}`}>
                          {TYPE_LABEL[q.questionType]}
                        </span>
                        <span className="text-sm text-gray-700 truncate">{q.questionText.split('\n')[0] || <span className="text-gray-400">Untitled question</span>}</span>
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={q.marks}
                        onChange={(e) => patchQuestion(si, qi, { marks: Math.max(0, Number(e.target.value)) })}
                        title="Marks"
                        className="w-14 h-8 px-2 rounded-lg border border-gray-200 text-xs shrink-0"
                      />
                      <button type="button" onClick={() => moveQuestion(si, qi, -1)} disabled={qi === 0} title="Move up" className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => moveQuestion(si, qi, 1)} disabled={qi === section.questions.length - 1} title="Move down" className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => removeQuestion(si, qi)} title="Delete question" className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>

                    {isOpen && (
                      <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-3">
                        <textarea
                          value={q.questionText}
                          onChange={(e) => patchQuestion(si, qi, { questionText: e.target.value })}
                          placeholder={q.questionType === 'coding' ? 'Problem statement — include input/output format, constraints and an example' : 'Question text'}
                          rows={q.questionType === 'coding' ? 8 : 2}
                          className={`${textareaCls} mt-2`}
                        />
                        {q.questionType === 'mcq' && <McqFields question={q} onChange={(patch) => patchQuestion(si, qi, patch)} />}
                        {q.questionType === 'coding' && <CodingFields question={q} onChange={(patch) => patchQuestion(si, qi, patch)} />}
                        {q.questionType === 'short_answer' && (
                          <input value={q.correctAnswer ?? ''} onChange={(e) => patchQuestion(si, qi, { correctAnswer: e.target.value })} placeholder="Expected answer for auto-grading (optional — leave blank for manual review)" className={inputCls} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" onClick={() => addQuestion(si, 'mcq')} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:border-violet-300 hover:text-violet-700">
                  <ListChecks className="w-3.5 h-3.5" /> MCQ
                </button>
                <button type="button" onClick={() => addQuestion(si, 'coding')} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:border-violet-300 hover:text-violet-700">
                  <Code2 className="w-3.5 h-3.5" /> Coding
                </button>
                <button type="button" onClick={() => addQuestion(si, 'short_answer')} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:border-violet-300 hover:text-violet-700">
                  <PencilLine className="w-3.5 h-3.5" /> Short answer
                </button>
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setSections((prev) => [...prev, emptySection(prev.length + 1)])}
          className="w-full inline-flex items-center justify-center gap-1.5 h-11 rounded-2xl border-2 border-dashed border-gray-200 text-sm font-semibold text-gray-500 hover:border-violet-300 hover:text-violet-700"
        >
          <Plus className="w-4 h-4" /> Add section
        </button>
      </div>

      {/* ── Summary / save ── */}
      <aside className="lg:sticky lg:top-6 self-start space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Summary</h3>
          <div className="space-y-2 mb-4">
            {sections.map((s, si) => (
              <div key={si} className="flex items-center justify-between text-xs">
                <span className="text-gray-600 truncate pr-2">{s.title || `Section ${si + 1}`}</span>
                <span className="text-gray-400 shrink-0">{s.questions.length} Q</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4 text-center">
            <Stat label="Questions" value={allQuestions.length} />
            <Stat label="Marks" value={totalMarks} />
            <Stat label="Minutes" value={durationMinutes} />
          </div>

          {(errors.length > 0 || serverError) && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-100 px-3 py-2.5 max-h-48 overflow-y-auto">
              {serverError && <p className="text-xs text-red-600 mb-1">{serverError}</p>}
              {errors.map((e) => (
                <p key={e} className="text-xs text-red-600 flex items-start gap-1.5 mb-1"><AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{e}</p>
              ))}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={createTest.isPending}
            className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50"
          >
            {createTest.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save as Draft
          </button>
          <p className="text-[11px] text-gray-400 mt-2 text-center">Then submit it for TPO approval and send it to a batch.</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-green-600" /> Proctoring (always on)</h3>
          <ul className="space-y-1.5">
            {PROCTORING_RULES.map((r) => (
              <li key={r} className="text-xs text-gray-600 flex items-start gap-1.5"><CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />{r}</li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-gray-50 py-2">
      <p className="text-base font-bold text-gray-900 tabular-nums">{value}</p>
      <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
    </div>
  );
}

function McqFields({ question, onChange }: { question: BuilderQuestion; onChange: (patch: Partial<BuilderQuestion>) => void }) {
  const options = question.options ?? [];

  function setOption(i: number, value: string) {
    const next = [...options];
    const wasCorrect = question.correctAnswer === next[i];
    next[i] = value;
    // Keep the correct-answer mark attached to the option while its text is edited.
    onChange(wasCorrect && question.correctAnswer ? { options: next, correctAnswer: value } : { options: next });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">Options — click the circle to mark the correct one</p>
      {options.map((opt, i) => {
        const isCorrect = !!opt.trim() && question.correctAnswer === opt;
        return (
          <div key={i} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => opt.trim() && onChange({ correctAnswer: opt })}
              title="Mark as correct"
              className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${isCorrect ? 'border-green-500 bg-green-500' : 'border-gray-300 hover:border-green-400'}`}
            >
              {isCorrect && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
            </button>
            <input
              value={opt}
              onChange={(e) => setOption(i, e.target.value)}
              placeholder={`Option ${i + 1}`}
              className={`flex-1 h-9 px-2.5 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:ring-violet-400 ${isCorrect ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}
            />
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => onChange({ options: options.filter((_, j) => j !== i), correctAnswer: isCorrect ? '' : question.correctAnswer })}
                className="p-1 text-gray-400 hover:text-red-600"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      })}
      {options.length < 6 && (
        <button type="button" onClick={() => onChange({ options: [...options, ''] })} className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700">
          <Plus className="w-3 h-3" /> Add option
        </button>
      )}
    </div>
  );
}

function CodingFields({ question, onChange }: { question: BuilderQuestion; onChange: (patch: Partial<BuilderQuestion>) => void }) {
  const allowedLanguages = question.allowedLanguages ?? [];
  const starterCode = question.starterCode ?? {};
  const testCases = question.testCases ?? [];
  const [starterLang, setStarterLang] = useState<CodingLanguage | null>(null);

  function toggleLanguage(lang: CodingLanguage) {
    const next = allowedLanguages.includes(lang) ? allowedLanguages.filter((l) => l !== lang) : [...allowedLanguages, lang];
    onChange({ allowedLanguages: next });
  }

  function updateCase(i: number, patch: Partial<TestCase>) {
    onChange({ testCases: testCases.map((tc, idx) => (idx === i ? { ...tc, ...patch } : tc)) });
  }

  const caseGroups: Array<{ hidden: boolean; title: string; hint: string }> = [
    { hidden: false, title: 'Sample test cases', hint: 'Shown in the problem and used by Run' },
    { hidden: true, title: 'Hidden test cases', hint: 'Never shown — used by Submit code and scoring' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-gray-500 mb-1.5">Allowed languages</label>
        <div className="flex flex-wrap gap-2">
          {ALL_LANGUAGES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => toggleLanguage(value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${allowedLanguages.includes(value) ? 'bg-violet-600 border-violet-600 text-white' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {allowedLanguages.length > 0 && (
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">Starter code (optional — a default template is used otherwise)</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {allowedLanguages.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setStarterLang(starterLang === lang ? null : lang)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border ${starterLang === lang ? 'border-violet-500 text-violet-700 bg-violet-50' : 'border-gray-200 text-gray-500'}`}
              >
                {ALL_LANGUAGES.find((l) => l.value === lang)?.label}{starterCode[lang]?.trim() ? ' ✓' : ''}
              </button>
            ))}
          </div>
          {starterLang && (
            <textarea
              value={starterCode[starterLang] ?? ''}
              onChange={(e) => onChange({ starterCode: { ...starterCode, [starterLang]: e.target.value } })}
              rows={6}
              placeholder={`Starter code shown to candidates who pick ${starterLang}…`}
              className={monoCls}
            />
          )}
        </div>
      )}

      {caseGroups.map((group) => {
        const indexed = testCases.map((tc, i) => ({ tc, i })).filter(({ tc }) => tc.hidden === group.hidden);
        return (
          <div key={String(group.hidden)}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-gray-700 font-semibold flex items-center gap-1.5">
                {group.hidden ? <EyeOff className="w-3.5 h-3.5 text-gray-400" /> : <Eye className="w-3.5 h-3.5 text-gray-400" />}
                {group.title} <span className="font-normal text-gray-400">· {group.hint}</span>
              </label>
              <button
                type="button"
                onClick={() => onChange({ testCases: [...testCases, { input: '', expectedOutput: '', hidden: group.hidden }] })}
                className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700 shrink-0"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            <div className="space-y-2">
              {indexed.length === 0 && <p className="text-xs text-gray-400">None yet.</p>}
              {indexed.map(({ tc, i }, n) => (
                <div key={i} className="rounded-lg border border-gray-200 p-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-gray-400">Case {n + 1}</span>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => updateCase(i, { hidden: !tc.hidden })} className="text-[11px] text-gray-500 hover:text-gray-800">
                        Make {tc.hidden ? 'sample' : 'hidden'}
                      </button>
                      <button type="button" onClick={() => onChange({ testCases: testCases.filter((_, idx) => idx !== i) })} className="p-0.5 text-gray-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <textarea value={tc.input} onChange={(e) => updateCase(i, { input: e.target.value })} rows={2} placeholder="Input (stdin)" className={monoCls} />
                    <textarea value={tc.expectedOutput} onChange={(e) => updateCase(i, { expectedOutput: e.target.value })} rows={2} placeholder="Expected output" className={monoCls} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
