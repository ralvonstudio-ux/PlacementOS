import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, XCircle, Copy, RotateCcw, Ban } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  useImportSession,
  useImportTemplates,
  useUpdateImportMapping,
  useSetDuplicateStrategy,
  useDeleteImportRow,
  useConfirmImport,
  useCancelImport,
  useRollbackImport,
} from '../hooks/useImport';
import { ImportStatusBadge } from '../components/ImportStatusBadge';
import { extractErrorMessage } from '@/services/api';
import { toast } from 'sonner';
import type { ImportRowStatus } from '@placementos/types';

const ROW_STATUS_ICON: Record<ImportRowStatus, { icon: typeof CheckCircle2; cls: string }> = {
  pending: { icon: AlertTriangle, cls: 'text-gray-400' },
  valid: { icon: CheckCircle2, cls: 'text-green-500' },
  invalid: { icon: XCircle, cls: 'text-red-500' },
  duplicate: { icon: Copy, cls: 'text-amber-500' },
  created: { icon: CheckCircle2, cls: 'text-green-600' },
  skipped: { icon: Ban, cls: 'text-gray-400' },
};

export function ImportSessionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: session, isLoading } = useImportSession(id ?? null);
  const { data: templates } = useImportTemplates();
  const { mutateAsync: updateMapping, isPending: savingMapping } = useUpdateImportMapping();
  const { mutate: setDupStrategy } = useSetDuplicateStrategy();
  const { mutate: deleteRow } = useDeleteImportRow();
  const { mutateAsync: confirmImport, isPending: confirming } = useConfirmImport();
  const { mutateAsync: cancelImport } = useCancelImport();
  const { mutateAsync: rollbackImport, isPending: rollingBack } = useRollbackImport();

  const [mappingDraft, setMappingDraft] = useState<Record<string, string> | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showRollback, setShowRollback] = useState(false);

  if (isLoading || !session) {
    return (
      <PageContainer>
        <div className="p-5 space-y-3 animate-pulse">{[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl" />)}</div>
      </PageContainer>
    );
  }

  const fields = templates?.[session.importType] ?? [];
  const mapping = mappingDraft ?? session.columnMapping;
  const isMapping = session.status === 'mapping';

  const counts = session.rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  async function saveMapping() {
    if (!mappingDraft) return;
    try {
      await updateMapping({ id: session!._id, columnMapping: mappingDraft });
      setMappingDraft(null);
      toast.success('Mapping updated');
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  }

  async function handleConfirm() {
    try {
      await confirmImport(session!._id);
      toast.success('Import confirmed');
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setShowConfirm(false);
    }
  }

  async function handleCancel() {
    try {
      await cancelImport(session!._id);
      toast.success('Import cancelled');
      navigate('/tpo/import');
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  }

  async function handleRollback() {
    try {
      await rollbackImport(session!._id);
      toast.success('Import rolled back');
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setShowRollback(false);
    }
  }

  return (
    <PageContainer>
      <WorkspaceHeader
        title={session.originalFileName}
        subtitle={`${session.importType.replace('-', ' ')} · ${session.totalRows} rows`}
        backTo="/tpo/import"
        backLabel="Data Import"
        action={<ImportStatusBadge status={session.status} />}
      />

      <div className="flex flex-wrap gap-3 mb-6">
        {(['valid', 'invalid', 'duplicate', 'created'] as const).map((s) => (
          <div key={s} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-2.5">
            <p className="text-lg font-bold text-gray-900">{counts[s] ?? 0}</p>
            <p className="text-[11px] text-gray-500 capitalize">{s}</p>
          </div>
        ))}
      </div>

      {isMapping && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-gray-700">Column Mapping</p>
            {mappingDraft && (
              <button onClick={saveMapping} disabled={savingMapping} className="h-8 px-3 rounded-lg bg-violet-600 hover:bg-violet-700 text-xs font-semibold text-white transition-colors disabled:opacity-50">
                {savingMapping ? 'Saving…' : 'Re-map & Revalidate'}
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fields.map((f) => (
              <div key={f.field} className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-600 w-36 shrink-0 truncate" title={f.label}>
                  {f.label}{f.required && <span className="text-red-500">*</span>}
                </label>
                <select
                  value={mapping[f.field] ?? ''}
                  onChange={(e) => setMappingDraft({ ...mapping, [f.field]: e.target.value })}
                  className="flex-1 h-9 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
                >
                  <option value="">— not mapped —</option>
                  {session.rawHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-5 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">On duplicates</p>
            <div className="flex gap-2">
              {(['skip', 'overwrite', 'create'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setDupStrategy({ id: session._id, duplicateStrategy: s })}
                  className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors capitalize ${
                    session.duplicateStrategy === s ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {s === 'skip' ? 'Skip' : s === 'overwrite' ? 'Overwrite existing' : 'Create anyway'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-3 py-2 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider w-10">#</th>
                <th className="px-3 py-2 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider w-10"></th>
                {fields.map((f) => (
                  <th key={f.field} className="px-3 py-2 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">{f.label}</th>
                ))}
                <th className="px-3 py-2 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Errors</th>
                {isMapping && <th className="px-3 py-2 w-10" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {session.rows.slice(0, 100).map((row) => {
                const StatusIcon = ROW_STATUS_ICON[row.status].icon;
                return (
                  <tr key={row.rowNumber} className={row.status === 'invalid' ? 'bg-red-50/40' : row.status === 'duplicate' ? 'bg-amber-50/40' : undefined}>
                    <td className="px-3 py-2 text-xs text-gray-400">{row.rowNumber}</td>
                    <td className="px-3 py-2"><StatusIcon className={`w-4 h-4 ${ROW_STATUS_ICON[row.status].cls}`} /></td>
                    {fields.map((f) => (
                      <td key={f.field} className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap max-w-[160px] truncate">
                        {String(row.mapped[f.field] ?? row.raw[mapping[f.field] ?? ''] ?? '')}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-xs text-red-600 max-w-[240px]">{row.errors.join('; ')}</td>
                    {isMapping && (
                      <td className="px-3 py-2">
                        <button onClick={() => deleteRow({ id: session._id, rowNumber: row.rowNumber })} className="text-gray-300 hover:text-red-600 text-xs">✕</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {session.rows.length > 100 && (
          <p className="text-xs text-gray-400 text-center py-3 border-t border-gray-50">Showing first 100 of {session.rows.length} rows</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {isMapping && (
          <>
            <button onClick={() => setShowConfirm(true)} disabled={confirming} className="h-11 px-5 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50">
              {confirming ? 'Importing…' : `Confirm Import (${(counts.valid ?? 0) + (session.duplicateStrategy !== 'skip' ? counts.duplicate ?? 0 : 0)} rows)`}
            </button>
            <button onClick={handleCancel} className="h-11 px-5 rounded-xl border border-gray-200 hover:bg-gray-50 text-sm font-semibold text-gray-700 transition-colors">
              Cancel Import
            </button>
          </>
        )}
        {session.status === 'completed' && (
          <button onClick={() => setShowRollback(true)} disabled={rollingBack} className="inline-flex items-center gap-2 h-11 px-5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold transition-colors disabled:opacity-50">
            <RotateCcw className="w-4 h-4" /> Roll Back
          </button>
        )}
      </div>

      {showConfirm && (
        <ConfirmDialog
          title="Confirm this import?"
          description={`This will create ${(counts.valid ?? 0) + (session.duplicateStrategy !== 'skip' ? counts.duplicate ?? 0 : 0)} records. You can roll it back afterwards if something looks wrong.`}
          confirmLabel="Confirm Import"
          variant="warning"
          isLoading={confirming}
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
        />
      )}
      {showRollback && (
        <ConfirmDialog
          title="Roll back this import?"
          description="Every record this import created will be removed. This can't be undone."
          confirmLabel="Roll Back"
          isLoading={rollingBack}
          onConfirm={handleRollback}
          onCancel={() => setShowRollback(false)}
        />
      )}
    </PageContainer>
  );
}
