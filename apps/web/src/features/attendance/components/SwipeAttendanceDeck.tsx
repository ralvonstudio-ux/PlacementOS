import { useState, useMemo, useRef } from 'react';
import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { Check, X, Clock, CalendarOff, Search, CheckCircle2, XCircle, Undo2 } from 'lucide-react';
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

const SWIPE_THRESHOLD = 72;

function initialsOf(name: string): string {
  return name.split(' ').map((n) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

const STATUS_STYLE: Record<AttendanceStatus, { label: string; bg: string; text: string; ring: string }> = {
  present: { label: 'Present', bg: 'bg-green-50', text: 'text-green-700', ring: 'ring-green-200' },
  absent: { label: 'Absent', bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200' },
  late: { label: 'Late', bg: 'bg-yellow-50', text: 'text-yellow-700', ring: 'ring-yellow-200' },
  excused: { label: 'Excused', bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200' },
};

/** One roster row — swipe it right to mark present, left to mark absent. The whole row
 *  is the drag surface (not a separate full-screen card), so the candidate stays in
 *  scannable list context the way a register does, and a long roster reads top to bottom
 *  the same as any other list — swiping is the fast path, not the only path. */
function SwipeRow({
  candidate,
  status,
  onMark,
}: {
  candidate: Candidate;
  status?: AttendanceStatus;
  onMark: (id: string, status: AttendanceStatus) => void;
}) {
  const x = useMotionValue(0);
  const presentOpacity = useTransform(x, [10, SWIPE_THRESHOLD], [0, 1]);
  const absentOpacity = useTransform(x, [-SWIPE_THRESHOLD, -10], [1, 0]);
  const marked = status !== undefined;

  function handleDragEnd(_e: unknown, info: PanInfo) {
    if (info.offset.x > SWIPE_THRESHOLD) onMark(candidate._id, 'present');
    else if (info.offset.x < -SWIPE_THRESHOLD) onMark(candidate._id, 'absent');
  }

  const style = status ? STATUS_STYLE[status] : null;

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Swipe-direction hints revealed behind the row while dragging */}
      <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
        <motion.span style={{ opacity: absentOpacity }} className="flex items-center gap-1 text-red-600 font-bold text-xs">
          <X className="w-4 h-4" /> ABSENT
        </motion.span>
        <motion.span style={{ opacity: presentOpacity }} className="flex items-center gap-1 text-green-600 font-bold text-xs">
          PRESENT <Check className="w-4 h-4" />
        </motion.span>
      </div>

      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        onDragEnd={handleDragEnd}
        whileTap={{ cursor: 'grabbing' }}
        className={`relative flex items-center gap-3 px-4 py-3.5 bg-white border rounded-xl select-none touch-pan-y cursor-grab ${
          marked && style ? `${style.bg} ${style.ring} ring-1 border-transparent` : 'border-gray-100'
        }`}
      >
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
          {initialsOf(candidate.fullName)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{candidate.fullName}</p>
          <p className="text-xs text-gray-400">{candidate.rollNumber}</p>
        </div>

        {marked && style ? (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${style.bg} ${style.text} shrink-0`}>{style.label}</span>
        ) : (
          <span className="text-[11px] text-gray-300 font-medium tracking-wide shrink-0">SWIPE TO MARK</span>
        )}

        {/* Escape hatch for the two states a left/right swipe can't reach */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onMark(candidate._id, 'late')}
            aria-label="Mark late"
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              status === 'late' ? 'bg-yellow-500 text-white' : 'text-gray-300 hover:text-yellow-500 hover:bg-yellow-50'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMark(candidate._id, 'excused')}
            aria-label="Mark excused"
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              status === 'excused' ? 'bg-blue-500 text-white' : 'text-gray-300 hover:text-blue-500 hover:bg-blue-50'
            }`}
          >
            <CalendarOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function SwipeAttendanceDeck({ candidates, batch, track, date, onSuccess, onCancel }: Props) {
  const { mutateAsync: bulkMark, isPending } = useBulkMarkAttendance();
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const historyRef = useRef<{ id: string; prev: AttendanceStatus | undefined }[]>([]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => c.fullName.toLowerCase().includes(q) || c.rollNumber.toLowerCase().includes(q));
  }, [candidates, search]);

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const s of Object.values(statuses)) c[s]++;
    return c;
  }, [statuses]);

  const unmarkedCount = candidates.length - Object.keys(statuses).length;
  const absentNames = candidates.filter((c) => statuses[c._id] === 'absent').map((c) => c.fullName);

  function mark(id: string, status: AttendanceStatus) {
    historyRef.current.push({ id, prev: statuses[id] });
    setStatuses((prev) => ({ ...prev, [id]: status }));
  }

  function undoLast() {
    const last = historyRef.current.pop();
    if (!last) return;
    setStatuses((prev) => {
      const next = { ...prev };
      if (last.prev === undefined) delete next[last.id];
      else next[last.id] = last.prev;
      return next;
    });
  }

  function markAllPresent() {
    const next: Record<string, AttendanceStatus> = {};
    for (const c of candidates) next[c._id] = 'present';
    setStatuses(next);
    historyRef.current = [];
  }

  async function handleSubmit() {
    await bulkMark({
      batch,
      track,
      date,
      records: candidates.map((c) => ({ candidateId: c._id, status: statuses[c._id] ?? 'present' })),
    });
    onSuccess?.();
  }

  if (candidates.length === 0) {
    return <div className="text-center py-10 text-gray-500">No candidates found for {batch} – {track}.</div>;
  }

  return (
    <div className="flex flex-col">
      {/* Live counts */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="flex items-center gap-3 rounded-2xl border border-green-100 bg-green-50/60 px-4 py-3">
          <div className="w-9 h-9 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-bold text-green-700 leading-none">{counts.present}</p>
            <p className="text-xs text-green-600 mt-0.5">Present</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50/60 px-4 py-3">
          <div className="w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-bold text-red-700 leading-none">{counts.absent}</p>
            <p className="text-xs text-red-600 mt-0.5">Absent</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={markAllPresent}
          className="flex-1 h-10 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity"
        >
          All Present
        </button>
        <button
          type="button"
          onClick={() => setShowSearch((v) => !v)}
          aria-label="Search"
          className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${
            showSearch ? 'bg-violet-50 border-violet-200 text-violet-600' : 'border-gray-200 text-gray-400 hover:text-gray-600'
          }`}
        >
          <Search className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={undoLast}
          disabled={historyRef.current.length === 0}
          aria-label="Undo last"
          className="w-10 h-10 rounded-xl border border-gray-200 text-gray-400 hover:text-gray-600 flex items-center justify-center shrink-0 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
        >
          <Undo2 className="w-4 h-4" />
        </button>
      </div>

      {showSearch && (
        <input
          autoFocus
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or roll number…"
          className="w-full h-10 px-3 mb-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
        />
      )}

      {/* Roster */}
      <div className="space-y-2">
        {filtered.map((c) => (
          <SwipeRow key={c._id} candidate={c} status={statuses[c._id]} onMark={mark} />
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-6">No candidates match "{search}".</p>
        )}
      </div>

      {/* Absent summary */}
      <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Absent Students Summary</p>
        {absentNames.length === 0 ? (
          <p className="text-sm text-gray-400">No students marked absent yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {absentNames.map((n) => (
              <span key={n} className="text-xs font-medium px-2.5 py-1 rounded-full bg-red-100 text-red-700">{n}</span>
            ))}
          </div>
        )}
      </div>

      {/* Sticky save bar */}
      <div className="sticky bottom-0 -mx-3 sm:-mx-5 mt-5 bg-gradient-to-t from-white via-white to-transparent pt-4 px-3 sm:px-5 pb-1">
        <div className="flex gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="h-11 px-4 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="flex-1 h-11 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50"
          >
            {isPending ? 'Saving…' : unmarkedCount > 0 ? `Save (${unmarkedCount} unmarked)` : 'Save Attendance'}
          </button>
        </div>
      </div>
    </div>
  );
}
