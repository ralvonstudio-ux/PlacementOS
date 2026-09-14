import { useState, FormEvent } from 'react';
import { X } from 'lucide-react';
import { useCreateFaculty } from '../hooks/useAdminFaculty';
import { extractErrorMessage } from '@/services/api';
import type { FacultyGender } from '@placementos/types';

export function AddFacultyModal({ onClose }: { onClose: () => void }) {
  const [fullName, setFullName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [gender, setGender] = useState<FacultyGender>('male');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const { mutateAsync, isPending } = useCreateFaculty();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await mutateAsync({ fullName, employeeId, gender, phone, department: department || undefined, email: email || undefined });
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
        <h2 className="text-lg font-bold text-gray-900 mb-5">Add Faculty</h2>
        <div className="space-y-3">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" required className={inputCls} />
          <div className="grid grid-cols-2 gap-3">
            <input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="Employee ID" required className={inputCls} />
            <select value={gender} onChange={(e) => setGender(e.target.value as FacultyGender)} className={inputCls}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" required className={inputCls} />
            <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Department (optional)" className={inputCls} />
          </div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" type="email" className={inputCls} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={isPending} className="w-full h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50">
            {isPending ? 'Adding…' : 'Add Faculty'}
          </button>
        </div>
      </form>
    </div>
  );
}
