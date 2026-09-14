import { useState, useRef } from 'react';
import { Upload, Loader2, FileText, CheckCircle2 } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { useMyProfile, useUploadResume } from '../hooks/useCandidateProfile';
import { extractErrorMessage } from '@/services/api';

export function ResumeBuilderPage() {
  const { data: profile, isLoading } = useMyProfile();
  const { mutateAsync: uploadResume, isPending: isUploading } = useUploadResume();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus(null);
    try {
      await uploadResume(file);
      setStatus({ type: 'success', message: 'Resume uploaded. This is now your latest resume — no need to submit it physically.' });
    } catch (err) {
      setStatus({ type: 'error', message: extractErrorMessage(err) });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  if (isLoading) return <PageContainer narrow><div className="h-64 bg-gray-100 rounded-2xl animate-pulse" /></PageContainer>;

  return (
    <PageContainer narrow>
      <WorkspaceHeader title="Resume" subtitle="Upload your resume — your latest upload is what recruiters and TPO staff will see" />

      {status && (
        <div className={`mb-5 rounded-xl px-4 py-3 border ${status.type === 'success' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-600'}`}>
          <p className="text-sm">{status.message}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        {profile?.resumeFileUrl ? (
          <div className="flex items-center gap-3 mb-5 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-100">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-emerald-800">Resume on file</p>
              <a href={profile.resumeFileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-emerald-700 hover:text-emerald-900 underline">
                <FileText className="w-3.5 h-3.5" /> View current resume
              </a>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-5">You haven&apos;t uploaded a resume yet.</p>
        )}

        <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50"
        >
          {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {profile?.resumeFileUrl ? 'Upload updated resume' : 'Upload resume'}
        </button>
        <p className="text-xs text-gray-400 mt-3">PDF only. Uploading a new file replaces your previous resume.</p>
      </div>
    </PageContainer>
  );
}
