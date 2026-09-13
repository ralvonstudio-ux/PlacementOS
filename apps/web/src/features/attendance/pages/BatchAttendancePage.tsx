import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, LayoutList, Layers } from 'lucide-react';
import { candidatesApi } from '@/features/candidates/api/candidates.api';
import { BulkAttendanceForm } from '../components/BulkAttendanceForm';
import { SwipeAttendanceDeck } from '../components/SwipeAttendanceDeck';

// Must match the server's attendance.repository.ts#todayString() exactly (IST, not the
// browser's local timezone or UTC) — the server rejects any date but "today" here, so a
// mismatch meant every submission failed outright during the ~5.5h/day window where the
// UTC calendar date and the IST one disagree (e.g. any evening in India, UTC-side).
function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

// Phones default to the swipeable deck (one candidate at a time, big tap targets);
// wider screens default to the dense list (faster for marking many people at once
// with a mouse). Either view is always reachable via the toggle regardless of size.
function isNarrowScreen(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < 768;
}

export function BatchAttendancePage() {
  const { batch, track } = useParams<{ batch: string; track: string }>();
  const navigate          = useNavigate();
  const [searchParams]    = useSearchParams();
  const today             = todayStr();
  const date              = searchParams.get('date') || today;
  const [view, setView]   = useState<'swipe' | 'list'>(() => (isNarrowScreen() ? 'swipe' : 'list'));

  const { data: candidates = [], isLoading, isError } = useQuery({
    queryKey: ['attendance', 'batch-candidates', batch, track],
    queryFn:  () => candidatesApi.listByBatch(batch!, track),
    enabled:  !!batch,
  });

  return (
    <div className="min-h-screen bg-[#F5F5F7] p-3 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/faculty/batches')}
            className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 transition-colors shrink-0"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
              Attendance — {batch} / {track}
            </h1>
            <p className="text-sm text-gray-500">{date}</p>
          </div>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 shrink-0">
          <button
            onClick={() => setView('swipe')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              view === 'swipe' ? 'bg-violet-600 text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Swipe
          </button>
          <button
            onClick={() => setView('list')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              view === 'list' ? 'bg-violet-600 text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <LayoutList className="w-3.5 h-3.5" /> List
          </button>
        </div>
      </div>

      {/* Body */}
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
        ) : view === 'swipe' ? (
          <SwipeAttendanceDeck
            candidates={candidates}
            batch={batch!}
            track={track!}
            date={date}
            onSuccess={() => navigate('/faculty/batches')}
            onCancel={() => navigate('/faculty/batches')}
          />
        ) : (
          <BulkAttendanceForm
            candidates={candidates}
            batch={batch!}
            track={track!}
            date={date}
            onSuccess={() => navigate('/faculty/batches')}
            onCancel={() => navigate('/faculty/batches')}
          />
        )}
      </div>
    </div>
  );
}
