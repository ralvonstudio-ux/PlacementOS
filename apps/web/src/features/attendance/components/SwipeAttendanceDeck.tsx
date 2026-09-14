import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import {
  Check, X, Clock, CalendarOff, Search, Undo2,
  SlidersHorizontal, Users, RotateCcw, Save,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AttendanceStatus, Candidate } from '@placementos/types';
import { useBulkMarkAttendance } from '../hooks/useAttendance';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

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

function draftKey(batch: string, track: string, date: string): string {
  return `po_attendance_draft_${batch}_${track}_${date}`;
}

const STATUS_STYLE: Record<AttendanceStatus, { label: string; bg: string; text: string; ring: string }> = {
  present: { label: 'Present', bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  absent: { label: 'Absent', bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200' },
  late: { label: 'Late', bg: 'bg-yellow-50', text: 'text-yellow-700', ring: 'ring-yellow-200' },
  excused: { label: 'Excused', bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200' },
};

type StatusFilter = 'all' | 'present' | 'absent' | 'unmarked';

/** One roster row — swipe it right to mark present, left to mark absent. The whole row
 *  is the drag surface (not a separate full-screen card), so the candidate stays in
 *  scannable list context the way a register does, and a long roster reads top to bottom
 *  the same as any other list — swiping is the fast path, not the only path.
 *
 *  Tapping the name/avatar area (rather than dragging) expands an inline Present /
 *  Absent / Unmark strip — a slower, explicit alternative to swiping. */
function SwipeRow({
  index,
  candidate,
  status,
  expanded,
  onMark,
  onUnmark,
  onToggleExpand,
}: {
  index: number;
  candidate: Candidate;
  status?: AttendanceStatus;
  expanded: boolean;
  onMark: (id: string, status: AttendanceStatus) => void;
  onUnmark: (id: string) => void;
  onToggleExpand: (id: string) => void;
}) {
  const x = useMotionValue(0);
  // Full-bleed reveal: each panel scales up from the edge the card is sliding away
  // from, reaching 100% of the row's width (not a fixed px cap) right as the drag
  // crosses the mark threshold — so the row reads as fully, solidly red/green at
  // the same moment it's about to commit, not a thin sliver alongside white space.
  const presentScale = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1], { clamp: true });
  const absentScale = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0], { clamp: true });
  const presentLabelOpacity = useTransform(x, [SWIPE_THRESHOLD * 0.35, SWIPE_THRESHOLD * 0.75], [0, 1]);
  const absentLabelOpacity = useTransform(x, [-SWIPE_THRESHOLD * 0.75, -SWIPE_THRESHOLD * 0.35], [1, 0]);
  const marked = status !== undefined;
  // A completed drag still fires a trailing click on release — without this guard,
  // every swipe-to-mark also popped open the tap-to-expand strip underneath it.
  const draggedRef = useRef(false);

  function handleDrag(_e: unknown, info: PanInfo) {
    if (Math.abs(info.offset.x) > 5) draggedRef.current = true;
  }

  function handleDragEnd(_e: unknown, info: PanInfo) {
    if (info.offset.x > SWIPE_THRESHOLD) onMark(candidate._id, 'present');
    else if (info.offset.x < -SWIPE_THRESHOLD) onMark(candidate._id, 'absent');
  }

  function handleClick() {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    onToggleExpand(candidate._id);
  }

  const style = status ? STATUS_STYLE[status] : null;

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Swipe-direction reveal — each panel scales from 0 to the row's full width,
          anchored to the edge the card is sliding away from, so the row goes fully
          solid emerald/red rather than a partial strip. */}
      <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
        <motion.div
          style={{ scaleX: presentScale, opacity: presentLabelOpacity }}
          className="absolute inset-0 bg-emerald-500 flex items-center pl-4 origin-left"
        >
          <span className="flex items-center gap-1.5 text-white font-bold text-xs whitespace-nowrap">
            <Check className="w-4 h-4" /> PRESENT
          </span>
        </motion.div>
        <motion.div
          style={{ scaleX: absentScale, opacity: absentLabelOpacity }}
          className="absolute inset-0 bg-red-500 flex items-center justify-end pr-4 origin-right"
        >
          <span className="flex items-center gap-1.5 text-white font-bold text-xs whitespace-nowrap">
            ABSENT <X className="w-4 h-4" />
          </span>
        </motion.div>
      </div>

      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.7}
        dragTransition={{ bounceStiffness: 600, bounceDamping: 44 }}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
        whileDrag={{ boxShadow: '0 10px 28px -6px rgba(0,0,0,0.18)' }}
        whileTap={{ cursor: 'grabbing' }}
        transition={{ type: 'spring', stiffness: 550, damping: 46, mass: 0.7 }}
        className={`relative flex items-center gap-2.5 px-3 py-3 bg-white border rounded-xl select-none touch-pan-y cursor-grab ${
          marked && style ? `${style.bg} ${style.ring} ring-1 border-transparent` : 'border-gray-100'
        }`}
      >
        <span className="w-3.5 text-[10px] text-gray-300 shrink-0 text-center">{index}</span>
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
          {initialsOf(candidate.fullName)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{candidate.fullName}</p>
          <p className="text-[11px] text-gray-400 truncate">{candidate.rollNumber}</p>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {marked && style ? (
            <motion.span
              key={status}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              className={`text-[11px] font-bold px-2 py-1 rounded-full whitespace-nowrap shrink-0 ${style.bg} ${style.text}`}
            >
              {style.label}
            </motion.span>
          ) : (
            <motion.span
              key="unmarked"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              className="text-[10px] text-gray-300 font-medium tracking-wide shrink-0 whitespace-nowrap"
            >
              SWIPE
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Tap-to-expand quick actions — everything a swipe can't reach in one place:
          Present / Absent / Unmark, plus the Late / Excused states, for anyone who'd
          rather tap than swipe. */}
      {expanded && (
        <div className="px-3 py-2.5 bg-gray-50/80 border border-t-0 border-gray-100 rounded-b-xl -mt-px space-y-1.5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMark(candidate._id, 'present'); }}
              className={`flex-1 h-8 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
                status === 'present' ? 'bg-emerald-600 text-white' : 'bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <Check className="w-3.5 h-3.5" /> Present
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMark(candidate._id, 'absent'); }}
              className={`flex-1 h-8 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
                status === 'absent' ? 'bg-red-600 text-white' : 'bg-white border border-red-200 text-red-700 hover:bg-red-50'
              }`}
            >
              <X className="w-3.5 h-3.5" /> Absent
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onUnmark(candidate._id); }}
              disabled={!marked}
              className="flex-1 h-8 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 bg-white border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Unmark
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMark(candidate._id, 'late'); }}
              className={`flex-1 h-8 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
                status === 'late' ? 'bg-yellow-500 text-white' : 'bg-white border border-yellow-200 text-yellow-700 hover:bg-yellow-50'
              }`}
            >
              <Clock className="w-3.5 h-3.5" /> Late
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMark(candidate._id, 'excused'); }}
              className={`flex-1 h-8 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
                status === 'excused' ? 'bg-blue-500 text-white' : 'bg-white border border-blue-200 text-blue-700 hover:bg-blue-50'
              }`}
            >
              <CalendarOff className="w-3.5 h-3.5" /> Excused
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Stat card with a soft glow behind its icon and a bouncy pop whenever the count changes. */
function StatCard({ label, count, tone }: { label: string; count: number; tone: 'emerald' | 'red' }) {
  const toneCls = tone === 'emerald'
    ? { glow: 'bg-emerald-400', iconBg: 'from-emerald-400 to-emerald-600', shadow: 'shadow-emerald-500/40', border: 'border-emerald-100', bg: 'bg-emerald-50/60', text: 'text-emerald-700', sub: 'text-emerald-600' }
    : { glow: 'bg-red-400', iconBg: 'from-red-400 to-red-600', shadow: 'shadow-red-500/40', border: 'border-red-100', bg: 'bg-red-50/60', text: 'text-red-700', sub: 'text-red-600' };

  return (
    <div className={`flex items-center gap-3 rounded-2xl border ${toneCls.border} ${toneCls.bg} px-4 py-3`}>
      <div className="relative w-10 h-10 shrink-0">
        <span className={`absolute inset-0 rounded-full ${toneCls.glow} opacity-40 blur-md animate-pulse`} />
        <div className={`relative w-10 h-10 rounded-full bg-gradient-to-br ${toneCls.iconBg} text-white flex items-center justify-center shadow-lg ${toneCls.shadow}`}>
          {tone === 'emerald' ? <Check className="w-5 h-5" strokeWidth={3} /> : <X className="w-5 h-5" strokeWidth={3} />}
        </div>
      </div>
      <div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={count}
            initial={{ scale: 0.5, opacity: 0, y: -4 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            className={`text-xl font-bold ${toneCls.text} leading-none`}
          >
            {count}
          </motion.p>
        </AnimatePresence>
        <p className={`text-xs ${toneCls.sub} mt-0.5`}>{label}</p>
      </div>
    </div>
  );
}

export function SwipeAttendanceDeck({ candidates, batch, track, date, onSuccess, onCancel }: Props) {
  const navigate = useNavigate();
  const { mutateAsync: bulkMark, isPending } = useBulkMarkAttendance();
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const historyRef = useRef<{ id: string; prev: AttendanceStatus | undefined }[]>([]);
  const key = draftKey(batch, track, date);
  const hydratedRef = useRef(false);

  // Restore any unsaved marks left behind by a network drop, an accidental
  // reload, or the tab getting killed mid-session — nothing gets lost.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, AttendanceStatus>;
        if (saved && Object.keys(saved).length > 0) {
          setStatuses(saved);
          setRestoredDraft(true);
        }
      }
    } catch {
      // Corrupt/inaccessible storage — just start fresh.
    }
    hydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Autosave on every change (skip the very first render so we don't
  // immediately re-write the draft we just restored).
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      if (Object.keys(statuses).length === 0) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(statuses));
    } catch {
      // Storage full/unavailable — silently skip; nothing user-facing to fix.
    }
  }, [statuses, key]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = candidates;
    if (q) list = list.filter((c) => c.fullName.toLowerCase().includes(q) || c.rollNumber.toLowerCase().includes(q));
    if (statusFilter === 'unmarked') list = list.filter((c) => statuses[c._id] === undefined);
    else if (statusFilter !== 'all') list = list.filter((c) => statuses[c._id] === statusFilter);
    return list;
  }, [candidates, search, statusFilter, statuses]);

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const s of Object.values(statuses)) c[s]++;
    return c;
  }, [statuses]);

  const unmarkedCount = candidates.length - Object.keys(statuses).length;
  const absentNames = candidates.filter((c) => statuses[c._id] === 'absent').map((c) => c.fullName);
  const allPresent = candidates.length > 0 && candidates.every((c) => statuses[c._id] === 'present');

  function mark(id: string, status: AttendanceStatus) {
    historyRef.current.push({ id, prev: statuses[id] });
    setStatuses((prev) => ({ ...prev, [id]: status }));
  }

  function unmark(id: string) {
    historyRef.current.push({ id, prev: statuses[id] });
    setStatuses((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
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

  function unmarkAll() {
    setStatuses({});
    historyRef.current = [];
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  async function confirmSubmit() {
    await bulkMark({
      batch,
      track,
      date,
      records: candidates.map((c) => ({ candidateId: c._id, status: statuses[c._id] ?? 'present' })),
    });
    try { localStorage.removeItem(key); } catch { /* best effort */ }
    setConfirmOpen(false);
    onSuccess?.();
  }

  if (candidates.length === 0) {
    return <div className="text-center py-10 text-gray-500">No candidates found for {batch} – {track}.</div>;
  }

  const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All students' },
    { value: 'present', label: 'Marked present' },
    { value: 'absent', label: 'Marked absent' },
    { value: 'unmarked', label: 'Unmarked' },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Fixed top section — stays put while the roster below scrolls. */}
      <div className="shrink-0">
        {restoredDraft && (
          <button
            type="button"
            onClick={() => setRestoredDraft(false)}
            className="w-full mb-3 flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-left"
          >
            <span className="text-xs font-medium text-amber-700">Restored unsaved attendance from your last session.</span>
            <span className="text-[11px] font-semibold text-amber-500 shrink-0">Dismiss</span>
          </button>
        )}

        {/* Live counts */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <StatCard label="Present" count={counts.present} tone="emerald" />
          <StatCard label="Absent" count={counts.absent} tone="red" />
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1.5 sm:gap-2 mb-3">
          <button
            type="button"
            onClick={unmarkAll}
            disabled={Object.keys(statuses).length === 0}
            className="flex-1 h-9 sm:h-10 rounded-xl bg-violet-50 text-violet-700 text-xs sm:text-sm font-bold hover:bg-violet-100 transition-colors px-2 disabled:opacity-40 disabled:hover:bg-violet-50"
          >
            Unmark All
          </button>

          <button
            type="button"
            role="switch"
            aria-checked={allPresent}
            aria-label="Mark everyone present"
            onClick={() => (allPresent ? unmarkAll() : markAllPresent())}
            className={`relative w-11 h-6 sm:h-7 sm:w-12 rounded-full shrink-0 transition-colors duration-200 ${allPresent ? 'bg-emerald-500' : 'bg-gray-200'}`}
          >
            <motion.span
              layout
              transition={{ type: 'spring', stiffness: 600, damping: 32 }}
              className="absolute top-0.5 left-0.5 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white shadow"
              style={{ x: allPresent ? 20 : 0 }}
            />
          </button>

          <button
            type="button"
            onClick={() => { setShowSearch((v) => !v); setShowFilterMenu(false); }}
            aria-label="Search"
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${
              showSearch ? 'bg-violet-50 border-violet-200 text-violet-600' : 'border-gray-200 text-gray-500 hover:text-gray-700'
            }`}
          >
            <Search className="w-4 h-4" />
          </button>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => { setShowFilterMenu((v) => !v); setShowSearch(false); }}
              aria-label="Filter"
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center transition-colors ${
                showFilterMenu || statusFilter !== 'all' ? 'bg-violet-50 border-violet-200 text-violet-600' : 'border-gray-200 text-gray-500 hover:text-gray-700'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            {showFilterMenu && (
              <div className="absolute right-0 top-11 z-10 w-44 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5">
                {FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setStatusFilter(opt.value); setShowFilterMenu(false); }}
                    className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${
                      statusFilter === opt.value ? 'text-violet-700 bg-violet-50' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => navigate(`/faculty/attendance/${batch}/${track}/roster`)}
            aria-label="View batch roster"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-700 flex items-center justify-center shrink-0 transition-colors"
          >
            <Users className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={undoLast}
            disabled={historyRef.current.length === 0}
            aria-label="Undo last"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 hover:bg-amber-100 flex items-center justify-center shrink-0 disabled:opacity-30 disabled:hover:bg-amber-50 transition-colors"
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
            className="w-full h-10 px-3 mb-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
          />
        )}
      </div>

      {/* Only this middle section scrolls — the page around it stays put. */}
      <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
        <div className="space-y-2">
          {filtered.map((c, i) => (
            <SwipeRow
              key={c._id}
              index={i + 1}
              candidate={c}
              status={statuses[c._id]}
              expanded={expandedId === c._id}
              onMark={mark}
              onUnmark={unmark}
              onToggleExpand={toggleExpand}
            />
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-6">
              {search ? `No candidates match "${search}".` : 'No candidates match this filter.'}
            </p>
          )}
        </div>

        {/* Absent summary */}
        <div className="mt-5 mb-2 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
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
      </div>

      {/* Save bar — always pinned at the bottom of the panel, never scrolls away. */}
      <div className="shrink-0 pt-3">
        <div className="flex gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="h-12 px-4 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={isPending}
            className="flex-1 h-12 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 hover:opacity-90 text-sm font-bold text-white transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20"
          >
            <Save className="w-4 h-4" />
            {unmarkedCount > 0 ? `Save (${unmarkedCount} unmarked)` : 'Save Attendance'}
          </button>
        </div>
      </div>

      {confirmOpen && (
        <ConfirmDialog
          title="Submit Attendance?"
          description="Would you like to submit the attendance for this class?"
          confirmLabel="Yes, Submit"
          cancelLabel="Cancel"
          variant="warning"
          isLoading={isPending}
          onConfirm={confirmSubmit}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}
