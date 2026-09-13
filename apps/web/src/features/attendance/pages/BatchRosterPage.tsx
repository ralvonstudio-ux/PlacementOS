import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, Search } from 'lucide-react';
import type { Candidate } from '@placementos/types';
import { candidatesApi } from '@/features/candidates/api/candidates.api';
import { StudentNoteModal } from '../components/StudentNoteModal';

function initialsOf(name: string): string {
  return name.split(' ').map((n) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

/** Full roster for one batch/track — reached from the "people" icon on the attendance
 *  toolbar. Shows every student's name and roll number; the pencil icon is the only
 *  way in to a per-student note, which never appears on the attendance-marking screen
 *  itself (that screen only ever shows a name, by design). */
export function BatchRosterPage() {
  const { batch, track } = useParams<{ batch: string; track: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Candidate | null>(null);

  const { data: candidates = [], isLoading, isError } = useQuery({
    queryKey: ['attendance', 'batch-candidates', batch, track],
    queryFn: () => candidatesApi.listByBatch(batch!, track),
    enabled: !!batch,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => c.fullName.toLowerCase().includes(q) || c.rollNumber.toLowerCase().includes(q));
  }, [candidates, search]);

  return (
    <div className="min-h-screen bg-[#F5F5F7] p-3 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 transition-colors shrink-0"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
            {batch} / {track}
          </h1>
          <p className="text-xs text-gray-400">{candidates.length} students</p>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or roll number…"
          className="w-full h-10 pl-9 pr-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-5" style={{ minHeight: '60vh' }}>
        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-10 text-red-600 text-sm">Failed to load students. Please try again.</div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-10">
            {candidates.length === 0 ? `No students found for ${batch} – ${track}.` : `No students match "${search}".`}
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((c, idx) => (
              <div
                key={c._id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors"
              >
                <span className="w-6 text-xs text-gray-400 shrink-0">{idx + 1}</span>
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {initialsOf(c.fullName)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{c.fullName}</p>
                  <p className="text-xs text-gray-400">{c.rollNumber}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(c)}
                  aria-label={`Edit info for ${c.fullName}`}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-violet-600 hover:bg-violet-50 transition-colors shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && <StudentNoteModal candidate={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
