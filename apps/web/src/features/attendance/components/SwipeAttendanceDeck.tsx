import { useState, useRef, useMemo } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence, type PanInfo } from 'framer-motion';
import { Check, X, Clock, CalendarOff, Undo2, CheckCircle2, XCircle } from 'lucide-react';
import type { AttendanceStatus, Candidate } from '@placementos/types';
import { useBulkMarkAttendance } from '../hooks/useAttendance';

interface Props {
  candidates: Candidate[];
  batch: string;
  track: string;
  date: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const SWIPE_THRESHOLD = 90;

const STATUS_META: Record<AttendanceStatus, { label: string; dot: string; text: string }> = {
  present: { label: 'Present', dot: 'bg-green-500', text: 'text-green-700' },
  absent: { label: 'Absent', dot: 'bg-red-500', text: 'text-red-700' },
  late: { label: 'Late', dot: 'bg-yellow-500', text: 'text-yellow-700' },
  excused: { label: 'Excused', dot: 'bg-blue-500', text: 'text-blue-700' },
};

function initialsOf(name: string): string {
  return name.split(' ').map((n) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

/** One draggable card — swipe right marks present, left marks absent. Tapping the
 *  buttons below does the same (and is the only way to mark late/excused), so the
 *  gesture is always optional, never the sole path to finishing attendance. */
function Card({ candidate, isTop, onDecide }: { candidate: Candidate; isTop: boolean; onDecide: (status: AttendanceStatus) => void }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);
  const presentOpacity = useTransform(x, [10, SWIPE_THRESHOLD], [0, 1]);
  const absentOpacity = useTransform(x, [-SWIPE_THRESHOLD, -10], [1, 0]);

  function handleDragEnd(_e: unknown, info: PanInfo) {
    if (info.offset.x > SWIPE_THRESHOLD) onDecide('present');
    else if (info.offset.x < -SWIPE_THRESHOLD) onDecide('absent');
  }

  return (
    <motion.div
      className="absolute inset-0"
      style={isTop ? { x, rotate } : undefined}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={isTop ? handleDragEnd : undefined}
      animate={isTop ? { scale: 1, y: 0 } : { scale: 0.96, y: 10 }}
      exit={{ x: x.get() > 0 ? 400 : x.get() < 0 ? -400 : 0, opacity: 0, transition: { duration: 0.25 } }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="relative h-full w-full rounded-3xl border border-gray-100 bg-white shadow-lg flex flex-col items-center justify-center px-6 py-10 select-none touch-pan-y">
        {isTop && (
          <>
            <motion.div
              style={{ opacity: presentOpacity }}
              className="absolute top-6 left-6 flex items-center gap-1.5 rounded-xl border-2 border-green-500 px-3 py-1.5 text-green-600 font-bold text-sm -rotate-12"
            >
              <Check className="w-4 h-4" /> PRESENT
            </motion.div>
            <motion.div
              style={{ opacity: absentOpacity }}
              className="absolute top-6 right-6 flex items-center gap-1.5 rounded-xl border-2 border-red-500 px-3 py-1.5 text-red-600 font-bold text-sm rotate-12"
            >
              <X className="w-4 h-4" /> ABSENT
            </motion.div>
          </>
        )}

        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white flex items-center justify-center text-3xl font-bold shadow-sm">
          {initialsOf(candidate.fullName)}
        </div>
        <h2 className="mt-5 text-2xl font-bold text-gray-900 text-center">{candidate.fullName}</h2>
        <p className="mt-1 text-sm text-gray-500">{candidate.rollNumber}</p>
        {candidate.department && <p className="mt-0.5 text-xs text-gray-400">{candidate.department}</p>}
      </div>
    </motion.div>
  );
}

export function SwipeAttendanceDeck({ candidates, batch, track, date, onSuccess, onCancel }: Props) {
  const { mutateAsync: bulkMark, isPending } = useBulkMarkAttendance();
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [index, setIndex] = useState(0);
  const historyRef = useRef<number[]>([]);

  const total = candidates.length;
  const done = index >= total;
  const current = candidates[index];

  function decide(status: AttendanceStatus) {
    if (!current) return;
    historyRef.current.push(index);
    setStatuses((prev) => ({ ...prev, [current._id]: status }));
    setIndex((i) => i + 1);
  }

  function undo() {
    const prevIndex = historyRef.current.pop();
    if (prevIndex === undefined) return;
    setIndex(prevIndex);
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const s of Object.values(statuses)) c[s] = (c[s] ?? 0) + 1;
    return c;
  }, [statuses]);

  async function handleSubmit() {
    await bulkMark({
      batch,
      track,
      date,
      records: candidates.map((c) => ({ candidateId: c._id, status: statuses[c._id] ?? 'present' })),
    });
    onSuccess?.();
  }

  if (total === 0) {
    return <div className="text-center py-10 text-gray-500">No candidates found for {batch} – {track}.</div>;
  }

  if (done) {
    return (
      <div className="flex flex-col items-center py-10 px-4">
        <CheckCircle2 className="w-14 h-14 text-green-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900">All {total} marked</h2>
        <p className="text-sm text-gray-500 mt-1">Review the counts, then submit.</p>

        <div className="grid grid-cols-2 gap-3 mt-6 w-full max-w-sm">
          {(Object.keys(STATUS_META) as AttendanceStatus[]).map((s) => (
            <div key={s} className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <span className={`w-2.5 h-2.5 rounded-full ${STATUS_META[s].dot}`} />
              <span className={`text-sm font-semibold ${STATUS_META[s].text}`}>{counts[s] ?? 0}</span>
              <span className="text-xs text-gray-500">{STATUS_META[s].label}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-3 mt-8 w-full max-w-sm">
          <button
            onClick={undo}
            className="flex-1 h-11 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <Undo2 className="w-4 h-4" /> Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="flex-1 h-11 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50"
          >
            {isPending ? 'Saving…' : 'Submit Attendance'}
          </button>
        </div>
        {onCancel && (
          <button onClick={onCancel} className="mt-3 text-xs text-gray-400 hover:text-gray-600">
            Cancel
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center px-2 sm:px-4">
      {/* Progress */}
      <div className="w-full max-w-sm mb-4">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
          <span>{index} of {total} marked</span>
          <button onClick={undo} disabled={index === 0} className="inline-flex items-center gap-1 text-violet-600 disabled:opacity-30 disabled:cursor-not-allowed hover:text-violet-700">
            <Undo2 className="w-3.5 h-3.5" /> Undo
          </button>
        </div>
        <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full bg-violet-600 transition-all duration-300" style={{ width: `${(index / total) * 100}%` }} />
        </div>
      </div>

      {/* Card stack */}
      <div className="relative w-full max-w-sm" style={{ height: 320 }}>
        <AnimatePresence>
          {[candidates[index + 1], candidates[index]]
            .map((c, i) => (c ? { c, isTop: i === 1 } : null))
            .filter((v): v is { c: Candidate; isTop: boolean } => v !== null)
            .map(({ c, isTop }) => (
              <Card key={c._id} candidate={c} isTop={isTop} onDecide={decide} />
            ))}
        </AnimatePresence>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-4 mt-6">
        <button
          onClick={() => decide('absent')}
          aria-label="Mark absent"
          className="w-14 h-14 rounded-full bg-white border-2 border-red-200 text-red-500 hover:bg-red-50 hover:border-red-400 shadow-sm flex items-center justify-center transition-colors"
        >
          <XCircle className="w-7 h-7" />
        </button>
        <button
          onClick={() => decide('late')}
          aria-label="Mark late"
          className="w-11 h-11 rounded-full bg-white border-2 border-yellow-200 text-yellow-500 hover:bg-yellow-50 hover:border-yellow-400 shadow-sm flex items-center justify-center transition-colors"
        >
          <Clock className="w-5 h-5" />
        </button>
        <button
          onClick={() => decide('excused')}
          aria-label="Mark excused"
          className="w-11 h-11 rounded-full bg-white border-2 border-blue-200 text-blue-500 hover:bg-blue-50 hover:border-blue-400 shadow-sm flex items-center justify-center transition-colors"
        >
          <CalendarOff className="w-5 h-5" />
        </button>
        <button
          onClick={() => decide('present')}
          aria-label="Mark present"
          className="w-14 h-14 rounded-full bg-white border-2 border-green-200 text-green-500 hover:bg-green-50 hover:border-green-400 shadow-sm flex items-center justify-center transition-colors"
        >
          <CheckCircle2 className="w-7 h-7" />
        </button>
      </div>
      <p className="mt-4 text-xs text-gray-400 text-center">Swipe the card right for present, left for absent — or tap a button</p>
    </div>
  );
}
