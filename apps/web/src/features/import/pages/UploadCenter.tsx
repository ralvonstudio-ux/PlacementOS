import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UploadCloud, Download, FileSpreadsheet } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { useImportTemplates } from '../hooks/useImport';
import { useUploadImport } from '../hooks/useImport';
import { extractErrorMessage } from '@/services/api';
import type { ImportType } from '@placementos/types';

const TYPE_LABELS: Record<ImportType, string> = {
  faculty: 'Faculty',
  candidates: 'Candidates',
  'training-schedule': 'Training Schedule',
};

function downloadTemplate(type: ImportType, fields: { label: string }[]) {
  const header = fields.map((f) => f.label).join(',');
  const blob = new Blob([header + '\n'], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${type}-import-template.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function UploadCenter() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const initialType = (params.get('type') as ImportType) ?? 'faculty';
  const [importType, setImportType] = useState<ImportType>(initialType);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  const { data: templates } = useImportTemplates();
  const { mutateAsync: upload, isPending } = useUploadImport();

  const fields = useMemo(() => templates?.[importType] ?? [], [templates, importType]);

  async function handleUpload() {
    if (!file) return;
    setError('');
    try {
      const session = await upload({ importType, file });
      navigate(`/tpo/import/sessions/${session._id}`);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <PageContainer narrow>
      <WorkspaceHeader title="New Import" subtitle="Upload a CSV or Excel file — columns are mapped automatically" backTo="/tpo/import" backLabel="Data Import" />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">What are you importing?</label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(TYPE_LABELS) as ImportType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setImportType(t)}
                className={`h-10 rounded-xl text-sm font-semibold transition-colors ${
                  importType === t ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {fields.length > 0 && (
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Expected columns</p>
              <button onClick={() => downloadTemplate(importType, fields)} className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-700">
                <Download className="w-3.5 h-3.5" /> Download template
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {fields.map((f) => (
                <span key={f.field} className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${f.required ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500'}`}>
                  {f.label}{f.required ? ' *' : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const dropped = e.dataTransfer.files[0];
            if (dropped) setFile(dropped);
          }}
          className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${dragging ? 'border-violet-400 bg-violet-50/50' : 'border-gray-200'}`}
        >
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileSpreadsheet className="w-8 h-8 text-violet-500" />
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button onClick={() => setFile(null)} className="text-xs text-gray-400 hover:text-red-600 ml-2">Remove</button>
            </div>
          ) : (
            <label className="cursor-pointer flex flex-col items-center gap-2">
              <UploadCloud className="w-8 h-8 text-gray-300" />
              <span className="text-sm text-gray-500">Drag a CSV/Excel file here, or <span className="text-violet-600 font-semibold">browse</span></span>
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handleUpload}
          disabled={!file || isPending}
          className="w-full h-11 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50"
        >
          {isPending ? 'Uploading & mapping columns…' : 'Upload & Continue'}
        </button>
      </div>
    </PageContainer>
  );
}
