import { useRef, useState } from 'react';
import { FileText, Upload, Loader2, X } from 'lucide-react';
import { useExtractContent } from '../hooks/useContentExtraction';
import { extractErrorMessage } from '@/services/api';

interface Props {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  rows?: number;
  label?: string;
}

/** Paste-or-upload content input shared by the Training Plan, Worksheet, and Test
 *  creation flows. Uploading a PDF/image transcribes it server-side and drops the
 *  result straight into the same editable textarea a pasted syllabus/content would
 *  use — so either path ends in one reviewable block of text. */
export function ContentSourceInput({ value, onChange, placeholder, rows = 8, label = 'Content' }: Props) {
  const [mode, setMode] = useState<'paste' | 'upload'>('paste');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mutateAsync: extract, isPending } = useExtractContent();

  async function handleFile(file: File) {
    setError('');
    try {
      const result = await extract(file);
      onChange(result.text);
      setFileName(file.name);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setMode('paste')}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
              mode === 'paste' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500'
            }`}
          >
            <FileText className="w-3 h-3" /> Paste
          </button>
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
              mode === 'upload' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500'
            }`}
          >
            <Upload className="w-3 h-3" /> Upload
          </button>
        </div>
      </div>

      {mode === 'upload' && (
        <div className="mb-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending}
            className="w-full h-10 rounded-xl border border-dashed border-gray-300 text-xs font-medium text-gray-500 hover:border-violet-400 hover:text-violet-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isPending ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Transcribing…</>
            ) : fileName ? (
              <><Upload className="w-3.5 h-3.5" /> {fileName} — upload another</>
            ) : (
              <><Upload className="w-3.5 h-3.5" /> Upload a PDF or photo of a page</>
            )}
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 mb-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2">
          <p className="text-xs text-red-600 flex-1">{error}</p>
          <button type="button" onClick={() => setError('')} className="text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={mode === 'upload' ? 'Extracted text will appear here — review and edit before generating…' : placeholder}
        rows={rows}
        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 resize-none"
      />
      <p className="text-[11px] text-gray-300 mt-1 text-right">{value.length} characters</p>
    </div>
  );
}
