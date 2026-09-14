import { useState } from 'react';
import { Link } from 'react-router-dom';
import { History, ArrowRight } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useImportSessions } from '../hooks/useImport';
import { ImportStatusBadge } from '../components/ImportStatusBadge';
import type { ImportType } from '@placementos/types';

const TYPE_FILTERS: { value: ImportType | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'candidates', label: 'Candidates' },
  { value: 'training-schedule', label: 'Training Schedule' },
];

export function ImportHistory() {
  const [importType, setImportType] = useState<ImportType | ''>('');
  const { data, isLoading } = useImportSessions({ importType: importType || undefined, limit: 100 });
  const sessions = data?.data ?? [];

  return (
    <PageContainer>
      <WorkspaceHeader title="Import History" subtitle="Every import run for this institute" backTo="/tpo/import" backLabel="Data Import" />

      <div className="flex items-center gap-2 mb-5">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setImportType(f.value)}
            className={`h-9 px-3 rounded-lg text-xs font-semibold transition-colors ${
              importType === f.value ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {isLoading ? (
          <div className="p-5 space-y-3 animate-pulse">{[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl" />)}</div>
        ) : sessions.length === 0 ? (
          <EmptyState icon={History} title="No imports yet" description="Runs will show up here once you start one." />
        ) : (
          sessions.map((s) => (
            <Link key={s._id} to={`/tpo/import/sessions/${s._id}`} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50/60 transition-colors">
              <div>
                <p className="text-sm font-semibold text-gray-900 capitalize">{s.importType.replace('-', ' ')}</p>
                <p className="text-xs text-gray-500">{s.originalFileName} · {s.totalRows} rows · {new Date(s.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-3">
                <ImportStatusBadge status={s.status} />
                <ArrowRight className="w-4 h-4 text-gray-300" />
              </div>
            </Link>
          ))
        )}
      </div>
    </PageContainer>
  );
}
