import { useState } from 'react';
import { Users, Search } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useFacultyList } from '../hooks/useTpo';

export function TpoFacultyPage() {
  const [search, setSearch] = useState('');
  const { data: faculty = [], isLoading } = useFacultyList(search || undefined);

  return (
    <PageContainer>
      <WorkspaceHeader title="Faculty" subtitle="Every faculty member in your institute" />

      <div className="mb-5 relative max-w-sm">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search faculty by name or employee ID"
          className="w-full h-10 pl-10 pr-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl" />)}
          </div>
        ) : faculty.length === 0 ? (
          <EmptyState icon={Users} title="No faculty found" description="Try a different search." />
        ) : (
          <div className="divide-y divide-gray-50">
            {faculty.map((f) => (
              <div key={f._id} className="flex items-center gap-4 px-5 py-4">
                <div className="w-9 h-9 rounded-full bg-violet-100 border border-violet-200 flex items-center justify-center text-xs font-bold text-violet-700 shrink-0">
                  {f.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{f.fullName}</p>
                  <p className="text-xs text-gray-500">{f.employeeId} · {f.department ?? 'No department'}</p>
                </div>
                <div className="flex flex-wrap gap-1 justify-end max-w-[45%]">
                  {f.tracks.slice(0, 3).map((t) => (
                    <span key={t} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{t}</span>
                  ))}
                </div>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                    f.employmentStatus === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {f.employmentStatus}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
