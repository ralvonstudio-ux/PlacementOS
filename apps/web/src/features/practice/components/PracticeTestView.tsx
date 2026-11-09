import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Lightbulb, XCircle } from 'lucide-react';
import type { PracticeQuestion } from '@placementos/types';

const PRIMARY_BTN = 'bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 text-white hover:opacity-90 transition-opacity';

const DIFFICULTY_CLASSES: Record<string, string> = {
  easy: 'bg-green-50 text-green-700',
  medium: 'bg-amber-50 text-amber-700',
  hard: 'bg-red-50 text-red-700',
};

/**
 * Aptitude / reasoning practice, laid out exactly like the real test paper (one question at a
 * time, numbered palette, lettered radio options, Previous / Next) — minus the proctoring and
 * the timer. Students can also "Check answer" to get instant feedback, which a real test doesn't.
 */
export function PracticeTestView({ questions }: { questions: PracticeQuestion[] }) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // A different set of questions (tab switch) starts from the top.
  const signature = questions.map((q) => q._id).join(',');
  useEffect(() => { setCurrent(0); setAnswers({}); setChecked({}); }, [signature]);

  const q = questions[current];
  if (!q) return null;

  const isMcq = q.questionType === 'mcq';
  const selected = answers[q._id];
  const isChecked = !!checked[q._id];
  const isLast = current === questions.length - 1;
  const answeredCount = questions.filter((x) => answers[x._id]).length;

  const setAnswer = (value: string) => setAnswers((p) => ({ ...p, [q._id]: value }));

  return (
    <div className="flex flex-col md:flex-row gap-5 items-start">
      {/* ── Question palette ── */}
      <aside className="hidden md:flex flex-col w-52 shrink-0 bg-white border border-gray-100 shadow-sm rounded-2xl p-4">
        <p className="text-xs font-semibold text-gray-900 mb-3">Questions · {answeredCount}/{questions.length} answered</p>
        <div className="grid grid-cols-4 gap-2">
          {questions.map((x, i) => {
            const done = checked[x._id];
            const right = done && isMcq && answers[x._id] === x.correctAnswer;
            const wrong = done && isMcq && answers[x._id] && answers[x._id] !== x.correctAnswer;
            return (
              <button
                key={x._id}
                onClick={() => setCurrent(i)}
                className={`w-9 h-9 rounded-lg text-xs font-semibold transition-colors ${
                  i === current
                    ? PRIMARY_BTN
                    : right ? 'bg-green-50 text-green-700 border border-green-200'
                    : wrong ? 'bg-red-50 text-red-600 border border-red-200'
                    : answers[x._id] ? 'bg-violet-50 text-violet-700 border border-violet-200'
                    : 'bg-gray-50 text-gray-500 border border-gray-200'
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        <div className="mt-4 space-y-1.5 text-[11px] text-gray-400">
          <p className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-violet-50 border border-violet-200" /> Answered</p>
          <p className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-50 border border-green-200" /> Checked · correct</p>
          <p className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-50 border border-red-200" /> Checked · wrong</p>
          <p className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gray-50 border border-gray-200" /> Not answered</p>
        </div>
      </aside>

      <div className="flex-1 min-w-0 w-full max-w-3xl">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-500">Question {current + 1} of {questions.length}</span>
          <div className="flex items-center gap-1.5">
            {q.companyName && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">{q.companyName}</span>}
            {q.difficulty && <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${DIFFICULTY_CLASSES[q.difficulty]}`}>{q.difficulty}</span>}
          </div>
        </div>

        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6">
          <p className="text-base text-gray-900 mb-6 whitespace-pre-wrap">{q.questionText}</p>

          {isMcq ? (
            <div className="space-y-2.5">
              {(q.options ?? []).map((opt, i) => {
                const picked = selected === opt;
                const isCorrect = isChecked && opt === q.correctAnswer;
                const isWrongPick = isChecked && picked && opt !== q.correctAnswer;
                return (
                  <label
                    key={i}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                      isCorrect ? 'border-green-300 bg-green-50'
                      : isWrongPick ? 'border-red-300 bg-red-50'
                      : picked ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                    } ${isChecked ? 'pointer-events-none' : ''}`}
                  >
                    <input type="radio" name={`pq-${q._id}`} checked={picked} onChange={() => setAnswer(opt)} disabled={isChecked} className="accent-orange-500" />
                    <span className="flex-1 text-sm text-gray-700"><span className="font-semibold text-gray-400 mr-2">{String.fromCharCode(65 + i)}.</span>{opt}</span>
                    {isCorrect && <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />}
                    {isWrongPick && <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                  </label>
                );
              })}

              <div className="flex items-center gap-4 pt-1">
                {!isChecked && (
                  <button
                    onClick={() => setChecked((p) => ({ ...p, [q._id]: true }))}
                    disabled={!selected}
                    className="h-9 px-4 rounded-lg border border-violet-200 bg-violet-50 text-sm font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Check answer
                  </button>
                )}
                {selected && !isChecked && (
                  <button onClick={() => setAnswer('')} className="text-xs text-gray-400 hover:text-gray-600">Clear response</button>
                )}
              </div>

              {isChecked && (
                <div className={`rounded-xl px-4 py-3 text-sm ${selected === q.correctAnswer ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
                  {selected === q.correctAnswer ? 'Correct!' : <>Incorrect. Correct answer: <span className="font-semibold">{q.correctAnswer}</span></>}
                </div>
              )}
              {isChecked && q.explanation && (
                <div className="flex items-start gap-2 text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-3">
                  <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <p><span className="font-semibold text-gray-800">Explanation: </span>{q.explanation}</p>
                </div>
              )}
            </div>
          ) : (
            <div>
              <textarea
                value={selected ?? ''}
                onChange={(e) => setAnswer(e.target.value)}
                rows={6}
                placeholder="Type your answer…"
                className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
              />
              {!isChecked ? (
                <button onClick={() => setChecked((p) => ({ ...p, [q._id]: true }))} className="mt-3 text-xs font-semibold text-violet-600 hover:text-violet-700">
                  Show answer &amp; solution
                </button>
              ) : (
                <div className="mt-3 space-y-2">
                  {(q.guidancePoints ?? []).map((point, i) => <p key={i} className="text-sm text-gray-600">• {point}</p>)}
                  {q.explanation && (
                    <div className="flex items-start gap-2 text-sm text-gray-600 bg-violet-50/60 rounded-xl px-4 py-3">
                      <Lightbulb className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
                      <p><span className="font-semibold text-gray-800">Model answer: </span>{q.explanation}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-5">
          <button
            onClick={() => setCurrent((i) => Math.max(0, i - 1))}
            disabled={current === 0}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <button
            onClick={() => setCurrent((i) => Math.min(questions.length - 1, i + 1))}
            disabled={isLast}
            className={`inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold disabled:opacity-30 ${PRIMARY_BTN}`}
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Small screens have no side palette. */}
        <div className="flex md:hidden flex-wrap gap-2 mt-5">
          {questions.map((x, i) => (
            <button
              key={x._id}
              onClick={() => setCurrent(i)}
              className={`w-8 h-8 rounded-lg text-xs font-semibold ${i === current ? PRIMARY_BTN : answers[x._id] ? 'bg-violet-50 text-violet-700' : 'bg-gray-100 text-gray-400'}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
