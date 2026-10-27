import { useState, FormEvent } from 'react';
import { X } from 'lucide-react';
import { useCreateCandidate, useUpdateCandidate } from '../hooks/useCandidates';
import { extractErrorMessage } from '@/services/api';
import type { Candidate } from '@placementos/types';

/** Add a student, or edit one when `candidate` is passed. */
export function AddCandidateModal({ onClose, candidate }: { onClose: () => void; candidate?: Candidate }) {
  const [fullName, setFullName] = useState(candidate?.fullName ?? '');
  const [rollNumber, setRollNumber] = useState(candidate?.rollNumber ?? '');
  const [batch, setBatch] = useState(candidate?.batch ?? '');
  const [department, setDepartment] = useState(candidate?.department ?? '');
  const [placementYear, setPlacementYear] = useState(candidate?.placementYear ?? '');
  const [email, setEmail] = useState(candidate?.email ?? '');
  const [phone, setPhone] = useState(candidate?.phone ?? '');
  const [cgpa, setCgpa] = useState(candidate?.cgpa?.toString() ?? '');
  const [backlogs, setBacklogs] = useState(candidate?.activeBacklogs?.toString() ?? '');
  const [error, setError] = useState('');
  const create = useCreateCandidate();
  const update = useUpdateCandidate();
  const isPending = create.isPending || update.isPending;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const payload = {
      fullName, rollNumber, batch, department, placementYear,
      email: email || undefined,
      phone: phone || undefined,
      cgpa: cgpa.trim() ? Number(cgpa) : undefined,
      activeBacklogs: backlogs.trim() ? Number(backlogs) : undefined,
    };
    try {
      if (candidate) await update.mutateAsync({ id: candidate._id, payload });
      else await create.mutateAsync(payload);
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  const inputCls = 'w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <form onSubmit={handleSubmit} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"><X className="w-4 h-4" /></button>
        <h2 className="text-lg font-bold text-gray-900 mb-5">{candidate ? 'Edit Student' : 'Add Student'}</h2>
        <div className="space-y-3">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" required className={inputCls} />
          <div className="grid grid-cols-2 gap-3">
            <input value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} placeholder="Roll number" required className={inputCls} />
            <input value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="Batch" required className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Department" required className={inputCls} />
            <input value={placementYear} onChange={(e) => setPlacementYear(e.target.value)} placeholder="Placement year" required className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" type="email" className={inputCls} />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={cgpa} onChange={(e) => setCgpa(e.target.value)} placeholder="CGPA (0–10)" type="number" step="0.01" min="0" max="10" className={inputCls} />
            <input value={backlogs} onChange={(e) => setBacklogs(e.target.value)} placeholder="Active backlogs" type="number" min="0" className={inputCls} />
          </div>
          <p className="text-[11px] text-gray-400 -mt-1">CGPA and backlogs decide which placement drives the student can apply to.</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={isPending} className="w-full h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50">
            {isPending ? 'Saving…' : candidate ? 'Save Changes' : 'Add Student'}
          </button>
        </div>
      </form>
    </div>
  );
}
