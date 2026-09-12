import { useState } from 'react';
import { Users2, Plus, KeyRound, Trash2, Search } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useCandidateList, useDeleteCandidate } from '../hooks/useCandidates';
import { AddCandidateModal } from '../components/AddCandidateModal';
import { CreateCandidateLoginModal } from '../components/CreateCandidateLoginModal';
import type { Candidate } from '@placementos/types';

const STATUS_CLASSES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-500',
  placed: 'bg-violet-100 text-violet-700',
};

export function TpoCandidatesPage() {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useCandidateList({ search: search || undefined, limit: 100 });
  const { mutate: deleteCandidate } = useDeleteCandidate();
  const [showAdd, setShowAdd] = useState(false);
  const [loginTarget, setLoginTarget] = useState<Candidate | null>(null);

  const candidates = data?.data ?? [];

  return (
    <PageContainer>
      <WorkspaceHeader
        title="Students"
        subtitle="Roster, batch assignment, and portal logins"
        action={
          <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors">
            <Plus className="w-4 h-4" /> Add Student
          </button>
        }
      />

      <div className="mb-5 relative max-w-sm">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, roll number, email" className="w-full h-10 pl-10 pr-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3 animate-pulse">{[1, 2, 3, 4].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl" />)}</div>
        ) : candidates.length === 0 ? (
          <EmptyState icon={Users2} title="No students found" description="Add your first student to get started." action={{ label: 'Add Student', onClick: () => setShowAdd(true) }} />
        ) : (
          <div className="divide-y divide-gray-50">
            {candidates.map((c) => (
              <div key={c._id} className="flex items-center gap-4 px-5 py-4">
                <div className="w-9 h-9 rounded-full bg-violet-100 border border-violet-200 flex items-center justify-center text-xs font-bold text-violet-700 shrink-0">
                  {c.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{c.fullName}</p>
                  <p className="text-xs text-gray-500">{c.rollNumber} · {c.batch} · {c.department}</p>
                </div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_CLASSES[c.status]}`}>{c.status}</span>
                {c.loginEmail ? (
                  <span className="text-[11px] text-gray-400 shrink-0">Login: {c.loginEmail}</span>
                ) : (
                  <button onClick={() => setLoginTarget(c)} className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-700 shrink-0">
                    <KeyRound className="w-3.5 h-3.5" /> Create Login
                  </button>
                )}
                <button onClick={() => deleteCandidate(c._id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && <AddCandidateModal onClose={() => setShowAdd(false)} />}
      {loginTarget && <CreateCandidateLoginModal candidate={loginTarget} onClose={() => setLoginTarget(null)} />}
    </PageContainer>
  );
}
