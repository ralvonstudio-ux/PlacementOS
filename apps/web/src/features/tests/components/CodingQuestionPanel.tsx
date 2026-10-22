import { useEffect, useMemo, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { Play, Loader2, CheckCircle2, XCircle, AlertTriangle, Send, TerminalSquare, ListChecks, Lock } from 'lucide-react';
import { useRunCode, useSubmitCode } from '../hooks/useTests';
import { extractErrorMessage } from '@/services/api';
import type { CodeSubmission, CodingLanguage, RunCodeResult, SubmitCodeResult, TestQuestionForCandidate } from '@placementos/types';

export const LANGUAGE_LABEL: Record<CodingLanguage, string> = {
  python: 'Python 3',
  java: 'Java (OpenJDK)',
  c: 'C (GCC)',
  cpp: 'C++ (GCC)',
  javascript: 'JavaScript (Node.js)',
};

// Monaco's own language ids — distinct from our CodingLanguage keys (e.g. 'cpp' matches, 'c' matches).
const MONACO_LANGUAGE: Record<CodingLanguage, string> = {
  python: 'python',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  javascript: 'javascript',
};

export const DEFAULT_STARTER: Record<CodingLanguage, string> = {
  python: '# Read input from stdin, print the answer to stdout\nimport sys\n\ndef main():\n    data = sys.stdin.read().split()\n    \n\nmain()\n',
  java: 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Write your solution here\n    }\n}\n',
  c: '#include <stdio.h>\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n',
  cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n',
  javascript: "// Read input from stdin, print the answer to stdout\nconst input = require('fs').readFileSync(0, 'utf8').trim();\n\n",
};

interface CodingQuestionPanelProps {
  attemptId: string;
  questionIndex: number;
  question: TestQuestionForCandidate;
  code: string;
  language: CodingLanguage;
  submission?: CodeSubmission;
  onChange: (patch: { code?: string; language?: CodingLanguage }) => void;
  onSubmitted: (submission: CodeSubmission) => void;
  disabled?: boolean;
}

type ConsoleTab = 'results' | 'custom';

export function CodingQuestionPanel({ attemptId, questionIndex, question, code, language, submission, onChange, onSubmitted, disabled }: CodingQuestionPanelProps) {
  const runCode = useRunCode();
  const submitCode = useSubmitCode();
  const [tab, setTab] = useState<ConsoleTab>('results');
  const [result, setResult] = useState<RunCodeResult | SubmitCodeResult | null>(null);
  const [resultKind, setResultKind] = useState<'run' | 'submit'>('run');
  const [customInput, setCustomInput] = useState('');
  const [customResult, setCustomResult] = useState<RunCodeResult | null>(null);
  const [actionError, setActionError] = useState('');

  const allowedLanguages = question.allowedLanguages?.length ? question.allowedLanguages : (['python'] as CodingLanguage[]);
  const busy = runCode.isPending || submitCode.isPending;
  const submittedCurrent = !!submission && submission.code === code && submission.language === language;

  // Seed the editor with starter code (or a sensible per-language default) the first time this
  // question is opened with no code written yet — doesn't run again once the candidate types.
  useEffect(() => {
    if (!code.trim()) {
      onChange({ code: question.starterCode?.[language] ?? DEFAULT_STARTER[language], language });
    }
    // Per-question console state shouldn't leak into the next question.
    setResult(null);
    setCustomResult(null);
    setActionError('');
    setCustomInput(question.testCases?.find((tc) => !tc.hidden)?.input ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIndex]);

  function handleLanguageChange(next: CodingLanguage) {
    setResult(null);
    setActionError('');
    const untouched = !code.trim() || code === (question.starterCode?.[language] ?? DEFAULT_STARTER[language]);
    if (!untouched && !window.confirm('Switching language replaces your code with the starter template. Continue?')) return;
    onChange({ language: next, code: question.starterCode?.[next] ?? DEFAULT_STARTER[next] });
  }

  async function handleRun() {
    setActionError('');
    try {
      if (tab === 'custom') {
        setCustomResult(null);
        setCustomResult(await runCode.mutateAsync({ attemptId, questionIndex, payload: { code, language, customInput } }));
      } else {
        setResult(null);
        setResultKind('run');
        setResult(await runCode.mutateAsync({ attemptId, questionIndex, payload: { code, language } }));
      }
    } catch (err) {
      setActionError(extractErrorMessage(err));
    }
  }

  async function handleSubmitCode() {
    setActionError('');
    setResult(null);
    setResultKind('submit');
    setTab('results');
    try {
      const res = await submitCode.mutateAsync({ attemptId, questionIndex, payload: { code, language } });
      setResult(res);
      if (res.status !== 'not_configured') {
        onSubmitted({ code, language, passedCount: res.passedCount, totalCount: res.totalCount, submittedAt: new Date().toISOString() });
      }
    } catch (err) {
      setActionError(extractErrorMessage(err));
    }
  }

  // Monaco handles its own context menu, drag/drop and clipboard; turn off what it can and the
  // page-level proctoring listeners catch the clipboard events it still fires.
  const handleMount: OnMount = (editor) => {
    if (disabled) editor.updateOptions({ readOnly: true });
  };

  const sampleCount = useMemo(() => question.testCases?.filter((tc) => !tc.hidden).length ?? 0, [question.testCases]);

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <select
          value={language}
          onChange={(e) => handleLanguageChange(e.target.value as CodingLanguage)}
          disabled={disabled || busy}
          className="h-9 px-3 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 disabled:opacity-50"
        >
          {allowedLanguages.map((lang) => (
            <option key={lang} value={lang}>{LANGUAGE_LABEL[lang]}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          {submission && (
            <span className={`text-xs font-semibold px-2 py-1 rounded-md ${submittedCurrent ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`} title={submittedCurrent ? 'Your latest code is submitted' : 'You changed the code after submitting — submit again to update your score'}>
              {submittedCurrent ? `Submitted · ${submission.passedCount}/${submission.totalCount}` : 'Changed since submit'}
            </span>
          )}
          <button
            onClick={handleRun}
            disabled={disabled || busy || !code.trim()}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {runCode.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run
          </button>
          <button
            onClick={handleSubmitCode}
            disabled={disabled || busy || !code.trim()}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitCode.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit code
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <Editor
          height="44vh"
          language={MONACO_LANGUAGE[language]}
          value={code}
          onChange={(v) => onChange({ code: v ?? '' })}
          onMount={handleMount}
          theme="vs"
          options={{
            fontSize: 13,
            minimap: { enabled: false },
            readOnly: disabled,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            contextmenu: false,
            dragAndDrop: false,
            dropIntoEditor: { enabled: false },
            links: false,
          }}
        />
      </div>

      {/* ── Console ── */}
      <div className="rounded-xl border border-gray-200 flex flex-col min-h-[160px]">
        <div className="flex items-center gap-1 px-2 pt-2 border-b border-gray-100">
          {([['results', 'Test results', ListChecks], ['custom', 'Custom input', TerminalSquare]] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t-md border-b-2 -mb-px ${tab === key ? 'border-orange-500 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        <div className="p-3 overflow-y-auto max-h-[28vh] space-y-2">
          {actionError && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-600">{actionError}</p>
            </div>
          )}

          {tab === 'results' ? (
            <>
              {busy && <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {submitCode.isPending ? 'Judging against all test cases…' : 'Compiling and running…'}</p>}
              {!busy && !result && !actionError && (
                <p className="text-xs text-gray-400">
                  {sampleCount > 0 ? `Run checks your code against ${sampleCount} sample case(s). ` : 'Run checks that your code compiles and executes. '}
                  Submit code judges it against all test cases, hidden included, and records your score for this problem.
                </p>
              )}
              {result && <RunResultView result={result} kind={resultKind} />}
            </>
          ) : (
            <>
              <textarea
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                rows={3}
                disabled={disabled}
                placeholder="Input passed to your program on stdin"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono resize-y focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
              <p className="text-[11px] text-gray-400">Press Run to execute your code with this input.</p>
              {runCode.isPending && <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Running…</p>}
              {customResult && <CustomResultView result={customResult} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
      <p className="text-sm text-amber-700">Code execution is not configured yet — contact your administrator. You can still write your code; it is saved and graded once this is set up.</p>
    </div>
  );
}

function CompileError({ text }: { text?: string }) {
  return (
    <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2">
      <p className="text-sm font-semibold text-red-700 mb-1 flex items-center gap-1.5"><XCircle className="w-4 h-4" /> Compilation error</p>
      <pre className="text-xs text-red-600 whitespace-pre-wrap font-mono">{text}</pre>
    </div>
  );
}

function RunResultView({ result, kind }: { result: RunCodeResult | SubmitCodeResult; kind: 'run' | 'submit' }) {
  if (result.status === 'not_configured') return <NotConfigured />;
  if (result.status === 'compile_error') return <CompileError text={result.compileError} />;

  const passed = result.results.filter((r) => r.passed).length;
  const total = result.results.length;
  const allPassed = total > 0 && passed === total;

  return (
    <div className="space-y-2">
      <p className={`text-sm font-semibold flex items-center gap-1.5 ${allPassed ? 'text-green-600' : 'text-gray-800'}`}>
        {allPassed ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4 text-red-500" />}
        {total === 0 ? 'Ran successfully (no sample cases to compare against)' : `${passed} / ${total} ${kind === 'submit' ? 'test cases' : 'sample cases'} passed`}
        {kind === 'submit' && total > 0 && <span className="font-normal text-gray-500">— score recorded</span>}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {result.results.map((r, i) => (
          <span key={i} className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${r.passed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {r.hidden ? <Lock className="w-3 h-3" /> : r.passed ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
            {r.hidden ? 'Hidden' : 'Case'} {i + 1}
          </span>
        ))}
      </div>
      {result.results.map((r, i) =>
        r.hidden || r.passed ? null : (
          <div key={i} className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-mono space-y-0.5">
            <p className="font-sans font-semibold text-[12px] text-red-700">Case {i + 1} — failed</p>
            <p className="text-gray-500">Input: <span className="text-gray-800 whitespace-pre-wrap">{r.input || '(none)'}</span></p>
            <p className="text-gray-500">Expected: <span className="text-gray-800 whitespace-pre-wrap">{r.expectedOutput}</span></p>
            <p className="text-gray-500">Your output: <span className="text-gray-800 whitespace-pre-wrap">{r.stdout || '(empty)'}</span></p>
            {r.stderr && <p className="text-red-600 whitespace-pre-wrap">{r.stderr}</p>}
          </div>
        )
      )}
    </div>
  );
}

function CustomResultView({ result }: { result: RunCodeResult }) {
  if (result.status === 'not_configured') return <NotConfigured />;
  if (result.status === 'compile_error') return <CompileError text={result.compileError} />;
  const c = result.custom;
  if (!c) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-mono space-y-1">
      <p className="font-sans text-[12px] font-semibold text-gray-700">
        {c.status}{c.time ? <span className="font-normal text-gray-400"> · {c.time}s</span> : null}
      </p>
      <p className="text-gray-500">Output:</p>
      <pre className="text-gray-900 whitespace-pre-wrap">{c.stdout || '(empty)'}</pre>
      {c.stderr && <pre className="text-red-600 whitespace-pre-wrap">{c.stderr}</pre>}
    </div>
  );
}
