import { useState } from 'react';
import { Users, Plus, KeyRound, BookOpen, Trash2, Search } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAdminFacultyList, useDeleteFaculty } from '../hooks/useAdminFaculty';
import { AddFacultyModal } from '../components/AddFacultyModal';
import { CreateFacultyLoginModal } from '../components/CreateFacultyLoginModal';
import { AssignFacultyModal } from '../components/AssignFacultyModal';
import type { Faculty } from '@placementos/types';

export function AdminFacultyPage() {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useAdminFacultyList({ search: search || undefined, limit: 100 });
  const { mutate: deleteFaculty, isPending: isDeleting } = useDeleteFaculty();
  const [showAdd, setShowAdd] = useState(false);
  const [loginTarget, setLoginTarget] = useState<Faculty | null>(null);
  const [assignTarget, setAssignTarget] = useState<Faculty | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Faculty | null>(null);

  const faculty = data?.data ?? [];

  return (
    <PageContainer>
      <WorkspaceHeader
        title="Faculty"
        subtitle="Create teacher logins and assign trainers to their batches and tracks"
        action={
          <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors">
            <Plus className="w-4 h-4" /> Add Faculty
          </button>
        }
      />

      <div className="mb-5 relative max-w-sm">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
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
          <EmptyState icon={Users} title="No faculty found" description="Add your first faculty member to get started." action={{ label: 'Add Faculty', onClick: () => setShowAdd(true) }} />
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
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {f.assignedBatches.slice(0, 3).map((b) => (
                      <span key={b} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{b}</span>
                    ))}
                    {f.tracks.slice(0, 3).map((t) => (
                      <span key={t} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{t}</span>
                    ))}
                    {f.assignedBatches.length === 0 && f.tracks.length === 0 && (
                      <span className="text-[11px] text-gray-400">No batch/track assigned</span>
                    )}
                  </div>
                </div>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                    f.employmentStatus === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {f.employmentStatus}
                </span>
                <button onClick={() => setAssignTarget(f)} className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-700 shrink-0">
                  <BookOpen className="w-3.5 h-3.5" /> Assign
                </button>
                {f.loginEmail ? (
                  <span className="text-[11px] text-gray-400 shrink-0">Login: {f.loginEmail}</span>
                ) : (
                  <button onClick={() => setLoginTarget(f)} className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-700 shrink-0">
                    <KeyRound className="w-3.5 h-3.5" /> Create Login
                  </button>
                )}
                <button onClick={() => setDeleteTarget(f)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && <AddFacultyModal onClose={() => setShowAdd(false)} />}
      {loginTarget && <CreateFacultyLoginModal faculty={loginTarget} onClose={() => setLoginTarget(null)} />}
      {assignTarget && <AssignFacultyModal faculty={assignTarget} onClose={() => setAssignTarget(null)} />}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete faculty member?"
          description={`This removes ${deleteTarget.fullName} from the faculty directory. This can't be undone.`}
          confirmLabel="Delete"
          isLoading={isDeleting}
          onConfirm={() => {
            deleteFaculty(deleteTarget._id, { onSettled: () => setDeleteTarget(null) });
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </PageContainer>
  );
}
