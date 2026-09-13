import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { candidatesApi } from '@/features/candidates/api/candidates.api';
import { SwipeAttendanceDeck } from '../components/SwipeAttendanceDeck';
import { AttendanceStatusBadge } from '../components/AttendanceStatusBadge';
import { useBatchAttendance } from '../hooks/useAttendance';

// Must match the server's attendance.repository.ts#todayString() exactly (IST, not the
// browser's local timezone or UTC) — the server rejects any date but "today" here, so a
// mismatch meant every submission failed outright during the ~5.5h/day window where the
// UTC calendar date and the IST one disagree (e.g. any evening in India, UTC-side).
function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().split('T')[0];
}

function formatLong(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

function initialsOf(name: string): string {
  return name.split(' ').map((n) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

export function BatchAttendancePage() {
  const { batch, track } = useParams<{ batch: string; track: string }>();
  const navigate          = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const today             = todayStr();
  const date              = searchParams.get('date') || today;
  const isToday           = date === today;

  const { data: candidates = [], isLoading, isError } = useQuery({
    queryKey: ['attendance', 'batch-candidates', batch, track],
    queryFn:  () => candidatesApi.listByBatch(batch!, track),
    enabled:  !!batch,
  });

  // Only fetched for the read-only past/future view — the editable Today view marks fresh.
  const { data: pastRecords = [], isLoading: pastLoading } = useBatchAttendance(batch!, track!, isToday ? undefined : date);
  const pastStatusByCandidate = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of pastRecords) map.set(r.candidateId, r.status);
    return map;
  }, [pastRecords]);

  function goToDate(next: string) {
    setSearchParams(next === today ? {} : { date: next });
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] p-3 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3 sm:mb-4">
        <button
          onClick={() => navigate('/faculty/batches')}
          className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 transition-colors shrink-0"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
          Attendance — {batch} / {track}
        </h1>
      </div>

      {/* Date navigator */}
      <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6 bg-white border border-gray-200 rounded-xl px-2 py-2">
        <button
          onClick={() => goToDate(shiftDate(date, -1))}
          aria-label="Previous day"
          className="p-2 rounded-lg hover:bg-gray-50 text-gray-500 transition-colors shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-gray-900 text-center truncate">{formatLong(date)}</span>
        <button
          onClick={() => goToDate(shiftDate(date, 1))}
          disabled={date >= today}
          aria-label="Next day"
          className="p-2 rounded-lg hover:bg-gray-50 text-gray-500 transition-colors shrink-0 disabled:opacity-25 disabled:hover:bg-transparent"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {isToday ? (
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-5" style={{ minHeight: '60vh' }}>
          {isLoading ? (
            <div className="space-y-3 animate-pulse">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg" />
              ))}
            </div>
          ) : isError ? (
            <div className="text-center py-10 text-red-600 text-sm">
              Failed to load candidates. Please try again.
            </div>
          ) : (
            <SwipeAttendanceDeck
              candidates={candidates}
              batch={batch!}
              track={track!}
              date={date}
              onSuccess={() => navigate('/faculty/batches')}
              onCancel={() => navigate('/faculty/batches')}
            />
          )}
        </div>
      ) : (
        // Past/future dates are view-only — the server only accepts marking today's date.
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-5" style={{ minHeight: '60vh' }}>
          <p className="text-xs text-gray-400 mb-4">
            {date > today ? "Future date — nothing recorded yet." : 'Past attendance is view-only.'}
          </p>
          {pastLoading || isLoading ? (
            <div className="space-y-3 animate-pulse">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-lg" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {candidates.map((c) => {
                const status = pastStatusByCandidate.get(c._id);
                return (
                  <div key={c._id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {initialsOf(c.fullName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.fullName}</p>
                      <p className="text-xs text-gray-400">{c.rollNumber}</p>
                    </div>
                    {status ? (
                      <AttendanceStatusBadge status={status as never} size="sm" />
                    ) : (
                      <span className="text-xs text-gray-300">Not marked</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
