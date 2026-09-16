import type { BankWorksheetQuestion } from '@placementos/types';

interface Props {
  title: string;
  batch: string;
  track: string;
  worksheetType: string;
  questions: BankWorksheetQuestion[];
}

const LETTERS = 'abcdefghij';

/** Exam-paper layout for AI-generated / bank worksheets — institute header, centered topic
 *  title, numbered questions in two columns with lettered options. Only ever rendered inside
 *  a `hidden print:block` wrapper (see WorksheetDetailPage) so it appears solely in the
 *  browser's print/"Save as PDF" output, never in the normal editing view. */
export function WorksheetPrintView({ title, batch, track, worksheetType, questions }: Props) {
  return (
    <div className="bg-white text-black p-8 max-w-4xl mx-auto">
      <div className="text-center border-b-2 border-black pb-3 mb-4">
        <h1 className="text-xl font-bold uppercase tracking-wide">Training &amp; Placement Cell</h1>
        <p className="text-xs text-gray-700 mt-0.5">{batch} · {track} · {worksheetType}</p>
      </div>

      <h2 className="text-center text-lg font-bold uppercase tracking-wide mb-5">{title}</h2>

      <div className="grid grid-cols-2 gap-x-10 gap-y-5 text-[13px] leading-snug">
        {questions.map((q, i) => (
          <div key={i} className="break-inside-avoid">
            <p className="font-medium text-black">
              <span className="font-bold">{i + 1}.</span> {q.questionText}
            </p>
            {q.options && q.options.length > 0 && (
              <div className="grid grid-cols-2 gap-x-3 mt-1 pl-4 text-[12px] text-gray-800">
                {q.options.map((opt, oi) => (
                  <span key={oi}>({LETTERS[oi] ?? oi + 1}) {opt}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
