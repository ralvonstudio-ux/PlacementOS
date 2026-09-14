import { useEffect, useMemo, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { Play, Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useRunCode } from '../hooks/useTests';
import { extractErrorMessage } from '@/services/api';
import type { CodingLanguage, RunCodeResult, TestQuestionForCandidate } from '@placementos/types';

const LANGUAGE_LABEL: Record<CodingLanguage, string> = {
  python: 'Python 3',
  java: 'Java (OpenJDK)',
  c: 'C (GCC)',
  cpp: 'C++ (GCC)',
};

// Monaco's own language ids — distinct from our CodingLanguage keys (e.g. 'cpp' matches, 'c' matches).
const MONACO_LANGUAGE: Record<CodingLanguage, string> = {
  python: 'python',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
};

const DEFAULT_STARTER: Record<CodingLanguage, string> = {
  python: '# Write your solution here\ndef solve():\n    pass\n\nsolve()\n',
  java: 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        // Write your solution here\n    }\n}\n',
  c: '#include <stdio.h>\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n',
  cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n',
};

interface CodingQuestionPanelProps {
  attemptId: string;
  questionIndex: number;
  question: TestQuestionForCandidate;
  code: string;
  language: CodingLanguage;
  onChange: (patch: { code?: string; language?: CodingLanguage }) => void;
  disabled?: boolean;
}

export function CodingQuestionPanel({ attemptId, questionIndex, question, code, language, onChange, disabled }: CodingQuestionPanelProps) {
  const runCode = useRunCode();
  const [result, setResult] = useState<RunCodeResult | null>(null);
  const [runError, setRunError] = useState('');

  const allowedLanguages = question.allowedLanguages?.length ? question.allowedLanguages : (['python'] as CodingLanguage[]);
  const visibleCases = useMemo(() => question.testCases?.filter((tc) => !tc.hidden) ?? [], [question.testCases]);

  // Seed the editor with starter code (or a sensible per-language default) the first time this
  // question is opened with no code written yet — doesn't run again once the candidate types.
  useEffect(() => {
    if (!code.trim()) {
      onChange({ code: question.starterCode?.[language] ?? DEFAULT_STARTER[language] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIndex]);

  function handleLanguageChange(next: CodingLanguage) {
    setResult(null);
    setRunError('');
    onChange({
      language: next,
      // Only swap in the starter/default when there's no code yet for this question — don't
      // clobber something the candidate already wrote.
      code: code.trim() ? code : (question.starterCode?.[next] ?? DEFAULT_STARTER[next]),
    });
  }

  async function handleRun() {
    setRunError('');
    setResult(null);
    try {
      const res = await runCode.mutateAsync({ attemptId, questionIndex, payload: { code, language } });
      setResult(res);
    } catch (err) {
      setRunError(extractErrorMessage(err));
    }
  }

  const handleMount: OnMount = (editor) => {
    if (disabled) editor.updateOptions({ readOnly: true });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <select
          value={language}
          onChange={(e) => handleLanguageChange(e.target.value as CodingLanguage)}
          disabled={disabled}
          className="h-9 px-3 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 disabled:opacity-50"
        >
          {allowedLanguages.map((lang) => (
            <option key={lang} value={lang}>{LANGUAGE_LABEL[lang]}</option>
          ))}
        </select>

        <button
          onClick={handleRun}
          disabled={disabled || runCode.isPending || !code.trim()}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {runCode.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Run
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <Editor
          height="360px"
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
          }}
        />
      </div>

      {runError && (
        <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-600">{runError}</p>
        </div>
      )}

      {result?.status === 'not_configured' && (
        <div className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-700">Code execution is not configured yet — contact your administrator. You can still write and submit your code; it will be graded once this is set up.</p>
        </div>
      )}

      {result?.status === 'compile_error' && (
        <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3">
          <p className="text-sm font-semibold text-red-700 mb-1 flex items-center gap-1.5"><XCircle className="w-4 h-4" /> Syntax / compile error</p>
          <pre className="text-xs text-red-600 whitespace-pre-wrap font-mono">{result.compileError}</pre>
        </div>
      )}

      {result?.status === 'ok' && (
        <div className="space-y-2">
          <p className={`text-sm font-semibold flex items-center gap-1.5 ${result.allPassed ? 'text-green-600' : 'text-gray-700'}`}>
            {result.allPassed ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4 text-red-500" />}
            {result.results.filter((r) => r.passed).length} / {result.results.length} sample test case(s) passed
          </p>
          {result.results.map((r, i) => (
            <div key={i} className={`rounded-lg border px-4 py-3 text-xs font-mono ${r.passed ? 'border-green-100 bg-green-50' : 'border-red-100 bg-red-50'}`}>
              <div className="flex items-center gap-1.5 mb-2 font-sans font-semibold text-[13px]">
                {r.passed ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                <span className={r.passed ? 'text-green-700' : 'text-red-700'}>Test case {i + 1}{r.passed ? ' — Passed' : ' — Failed'}</span>
              </div>
              <p className="text-gray-500">Input: <span className="text-gray-800">{r.input || '(none)'}</span></p>
              <p className="text-gray-500">Expected: <span className="text-gray-800">{r.expectedOutput}</span></p>
              <p className="text-gray-500">Got: <span className="text-gray-800">{r.stdout || '(empty)'}</span></p>
              {r.stderr && <p className="text-red-500 mt-1">stderr: {r.stderr}</p>}
            </div>
          ))}
        </div>
      )}

      {visibleCases.length === 0 && (
        <p className="text-xs text-gray-400">No sample test cases were provided for this question — Run will only check that your code compiles and executes.</p>
      )}
    </div>
  );
}
