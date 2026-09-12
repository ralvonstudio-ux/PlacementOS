import { useState } from 'react';
import { CheckCircle2, XCircle, Lightbulb } from 'lucide-react';
import type { PracticeQuestion } from '@placementos/types';

const DIFFICULTY_CLASSES: Record<string, string> = {
  easy: 'bg-green-50 text-green-700',
  medium: 'bg-amber-50 text-amber-700',
  hard: 'bg-red-50 text-red-700',
};

export function PracticeQuestionCard({ question, index }: { question: PracticeQuestion; index: number }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-sm font-medium text-gray-900 flex-1">
          <span className="text-gray-400 mr-2">{index + 1}.</span>
          {question.questionText}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          {question.companyName && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">{question.companyName}</span>}
          {question.difficulty && <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${DIFFICULTY_CLASSES[question.difficulty]}`}>{question.difficulty}</span>}
        </div>
      </div>

      {question.questionType === 'mcq' ? (
        <div className="space-y-2">
          {(question.options ?? []).map((opt, i) => {
            const isCorrect = revealed && opt === question.correctAnswer;
            const isWrongPick = revealed && selected === opt && opt !== question.correctAnswer;
            return (
              <button
                key={i}
                onClick={() => { if (!revealed) { setSelected(opt); setRevealed(true); } }}
                disabled={revealed}
                className={`w-full flex items-center justify-between text-left px-3.5 py-2.5 rounded-xl border text-sm transition-colors ${
                  isCorrect ? 'border-green-300 bg-green-50 text-green-800' : isWrongPick ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-200 hover:border-violet-300 text-gray-700'
                }`}
              >
                {opt}
                {isCorrect && <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />}
                {isWrongPick && <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
              </button>
            );
          })}
          {revealed && question.explanation && (
            <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 mt-2">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
              {question.explanation}
            </div>
          )}
        </div>
      ) : (
        <div>
          {!revealed ? (
            <button onClick={() => setRevealed(true)} className="text-xs font-semibold text-violet-600 hover:text-violet-700">
              Show answer guidance
            </button>
          ) : (
            <ul className="space-y-1.5 mt-1">
              {(question.guidancePoints ?? []).map((point, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="w-1 h-1 rounded-full bg-gray-300 mt-2 shrink-0" />
                  {point}
                </li>
              ))}
              {(!question.guidancePoints || question.guidancePoints.length === 0) && (
                <li className="text-sm text-gray-400">No guidance notes added for this one yet.</li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
