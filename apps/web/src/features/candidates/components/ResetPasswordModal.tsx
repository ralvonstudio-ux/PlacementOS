import { useState } from 'react';
import { X, KeyRound, Loader2, Copy, Check, Printer } from 'lucide-react';
import { useResetCandidatePassword } from '../hooks/useCandidates';
import { printCredentialSlips } from './credentialSlips';
import type { Candidate, IssuedCredential } from '@placementos/types';

/** TPO-side password reset: a new random password, shown once, and the student's other
 *  sessions are signed out. */
export function ResetPasswordModal({ candidate, onClose }: { candidate: Candidate; onClose: () => void }) {
  const reset = useResetCandidatePassword();
  const [issued, setIssued] = useState<IssuedCredential | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function run() {
    setError('');
    try {
      setIssued(await reset.mutateAsync(candidate._id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function copy() {
    if (!issued) return;
    await navigator.clipboard?.writeText(`Login ID: ${issued.loginId}\nPassword: ${issued.password}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X className="w-4 h-4" /></button>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Reset password</h2>
        <p className="text-sm text-gray-500 mb-5">For {candidate.fullName} ({candidate.rollNumber})</p>

        {issued ? (
          <>
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 space-y-2 mb-3">
              <p className="text-xs text-gray-500">Login ID</p>
              <p className="font-mono text-sm font-semibold text-gray-900 -mt-1.5">{issued.loginId}</p>
              <p className="text-xs text-gray-500">New password</p>
              <p className="font-mono text-lg font-bold text-gray-900 tracking-wider -mt-1.5">{issued.password}</p>
            </div>
            <p className="text-xs text-amber-700 mb-4">Shown only once. The old password no longer works; other open sessions end within 15 minutes.</p>
            <div className="flex gap-2">
              <button onClick={copy} className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />} {copied ? 'Copied' : 'Copy'}
              </button>
              <button onClick={() => printCredentialSlips([issued])} className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                <Printer className="w-4 h-4" /> Print slip
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-5">This sets a new random password. The old one stops working immediately, and any device still signed in is logged out within 15 minutes. A student mid-test can resume by signing in again.</p>
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <button onClick={run} disabled={reset.isPending} className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white disabled:opacity-50">
              {reset.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Reset password
            </button>
          </>
        )}
      </div>
    </div>
  );
}
