import { Link } from 'react-router-dom';
import { Upload, ArrowRight, Users, Users2, CalendarClock } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { useImportSessions } from '../hooks/useImport';
import { ImportStatusBadge } from '../components/ImportStatusBadge';
import type { ImportType } from '@placementos/types';

const IMPORT_TYPES: { type: ImportType; label: string; description: string; icon: typeof Users }[] = [
  { type: 'faculty', label: 'Faculty', description: 'Bulk-create teacher accounts with tracks and batches', icon: Users },
  { type: 'candidates', label: 'Candidates', description: 'Bulk-import the student roster', icon: Users2 },
  { type: 'training-schedule', label: 'Training Schedule', description: 'Bulk-fill the weekly timetable across batches', icon: CalendarClock },
];

export function ImportDashboard() {
  const { data: recentData, isLoading } = useImportSessions({ limit: 5 });
  const recent = recentData?.data ?? [];

  const completed = recent.filter((s) => s.status === 'completed').length;
  const processing = recent.filter((s) => s.status === 'processing' || s.status === 'mapping').length;
  const failed = recent.filter((s) => s.status === 'failed').length;

  return (
    <PageContainer>
      <WorkspaceHeader
        title="Data Import"
        subtitle="Bulk-load faculty, candidates, or the training schedule from a spreadsheet"
        action={
          <Link to="/tpo/import/history" className="inline-flex items-center h-10 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 text-sm font-semibold text-gray-700 transition-colors">
            History
          </Link>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xl font-bold text-gray-900">{completed}</p>
          <p className="text-xs text-gray-500">Completed</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xl font-bold text-gray-900">{processing}</p>
          <p className="text-xs text-gray-500">In Progress</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xl font-bold text-gray-900">{failed}</p>
          <p className="text-xs text-gray-500">Failed</p>
        </div>
      </div>

      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Start a New Import</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {IMPORT_TYPES.map(({ type, label, description, icon: Icon }) => (
          <Link
            key={type}
            to={`/tpo/import/upload?type=${type}`}
            className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-violet-200 hover:shadow-md transition-all"
          >
            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center mb-3 group-hover:bg-violet-100 transition-colors">
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-gray-900">{label}</p>
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Recent Imports</p>
        <Link to="/tpo/import/history" className="text-xs text-violet-600 hover:underline font-medium">View all</Link>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {isLoading ? (
          <div className="p-5 space-y-3 animate-pulse">{[1, 2].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}</div>
        ) : recent.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">
            <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            No imports yet
          </div>
        ) : (
          recent.map((s) => (
            <Link key={s._id} to={`/tpo/import/sessions/${s._id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/60 transition-colors">
              <div>
                <p className="text-sm font-medium text-gray-800 capitalize">{s.importType.replace('-', ' ')}</p>
                <p className="text-xs text-gray-500">{s.originalFileName} · {s.totalRows} rows</p>
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
