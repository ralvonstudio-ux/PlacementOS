import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { candidatesApi } from '@/features/candidates/api/candidates.api';
import { BulkAttendanceForm } from '../components/BulkAttendanceForm';

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export function BatchAttendancePage() {
  const { batch, track } = useParams<{ batch: string; track: string }>();
  const navigate          = useNavigate();
  const [searchParams]    = useSearchParams();
  const today             = todayStr();
  const date              = searchParams.get('date') || today;

  const { data: candidates = [], isLoading, isError } = useQuery({
    queryKey: ['attendance', 'batch-candidates', batch, track],
    queryFn:  () => candidatesApi.listByBatch(batch!, track),
    enabled:  !!batch,
  });

  return (
    <div className="min-h-screen bg-[#F5F5F7] p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/faculty/batches')}
          className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Attendance — {batch} / {track}
          </h1>
          <p className="text-sm text-gray-500">{date}</p>
        </div>
      </div>

      {/* Body */}
      <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ minHeight: '60vh' }}>
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
