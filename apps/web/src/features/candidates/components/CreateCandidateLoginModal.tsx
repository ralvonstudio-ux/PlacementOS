import { useState, FormEvent } from 'react';
import { X } from 'lucide-react';
import { useCreateCandidateLogin } from '../hooks/useCandidates';
import { extractErrorMessage } from '@/services/api';
import type { Candidate } from '@placementos/types';

interface Props {
  candidate: Candidate;
  onClose: () => void;
}

export function CreateCandidateLoginModal({ candidate, onClose }: Props) {
  const [loginEmail, setLoginEmail] = useState(candidate.email ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { mutateAsync, isPending } = useCreateCandidateLogin();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const result = await mutateAsync({ id: candidate._id, payload: { loginEmail, password } });
      setSuccess(`Login created: ${result.email}`);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <form onSubmit={handleSubmit} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
          <X className="w-4 h-4" />
        </button>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Create Login</h2>
        <p className="text-sm text-gray-500 mb-5">For {candidate.fullName}</p>

        {success ? (
          <div className="rounded-lg bg-green-50 border border-green-100 px-3 py-2.5 text-sm text-green-700">{success}</div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Login Email</label>
              <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Temporary Password</label>
              <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={isPending} className="w-full h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50">
              {isPending ? 'Creating…' : 'Create Login'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
