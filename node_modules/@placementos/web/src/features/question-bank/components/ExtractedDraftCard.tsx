import type { ExtractedQuestionDraft, QuestionKind, QuestionDifficulty } from '@placementos/types';

const QUESTION_TYPES: QuestionKind[] = ['mcq', 'short', 'long', 'true_false', 'fill_blank', 'very_short', 'numerical', 'case_study', 'hots', 'picture_based'];
const DIFFICULTIES: QuestionDifficulty[] = ['easy', 'medium', 'hard'];

interface Props {
  draft: ExtractedQuestionDraft;
  index: number;
  selected: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<ExtractedQuestionDraft>) => void;
}

export function ExtractedDraftCard({ draft, index, selected, onToggle, onChange }: Props) {
  return (
    <div className={`rounded-xl border p-4 transition-colors ${selected ? 'border-violet-200 bg-violet-50/40' : 'border-gray-100 bg-white'}`}>
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={selected} onChange={onToggle} className="mt-1.5 w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-semibold text-gray-400 mt-1.5">Q{index + 1}</span>
            <div className="flex items-center gap-2">
              <select value={draft.questionType} onChange={(e) => onChange({ questionType: e.target.value as QuestionKind })} className="h-8 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400">
                {QUESTION_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
              <select value={draft.difficulty} onChange={(e) => onChange({ difficulty: e.target.value as QuestionDifficulty })} className="h-8 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400">
                {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <textarea
            value={draft.questionText}
            onChange={(e) => onChange({ questionText: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
          />

          {draft.questionType === 'mcq' && (
            <div className="grid grid-cols-2 gap-2">
              {(draft.options ?? ['', '', '', '']).map((opt, i) => (
                <input
                  key={i}
                  type="text"
                  value={opt}
                  onChange={(e) => {
                    const next = [...(draft.options ?? ['', '', '', ''])];
                    next[i] = e.target.value;
                    onChange({ options: next });
                  }}
                  placeholder={`Option ${i + 1}`}
                  className="h-8 px-2.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400"
                />
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              value={draft.correctAnswer ?? ''}
              onChange={(e) => onChange({ correctAnswer: e.target.value })}
              placeholder="Correct answer"
              className="h-8 px-2.5 rounded-lg border border-gray-200 text-xs col-span-1 focus:outline-none focus:ring-1 focus:ring-violet-400"
            />
            <input
              type="number"
              min={0}
              value={draft.marks}
              onChange={(e) => onChange({ marks: Number(e.target.value) })}
              placeholder="Marks"
              className="h-8 px-2.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400"
            />
            <input
              type="number"
              min={0}
              value={draft.estimatedTimeMinutes}
              onChange={(e) => onChange({ estimatedTimeMinutes: Number(e.target.value) })}
              placeholder="Minutes"
              className="h-8 px-2.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400"
            />
          </div>

          {draft.imageRef && <p className="text-[11px] text-violet-500 font-medium">📷 Uses a detected figure from this upload</p>}
        </div>
      </div>
    </div>
  );
}
