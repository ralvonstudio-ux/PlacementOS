import { useState, type FormEvent, type ReactNode } from 'react';
import { X, Plus, Trash2, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import { useCreateDrive, useUpdateDrive } from '../hooks/usePlacementDrives';
import { JOB_TYPE_LABEL, ROUND_TYPE_LABEL } from './driveUi';
import type { CreatePlacementDrivePayload, DriveJobType, DriveRoundType, PlacementDrive } from '@placementos/types';

const inputCls = 'w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500';

/** ISO → the `YYYY-MM-DDTHH:mm` a datetime-local input wants, in local time. */
function toLocalInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : undefined);
const splitList = (v: string) => v.split(',').map((s) => s.trim()).filter(Boolean);
const optionalNumber = (v: string) => (v.trim() === '' ? undefined : Number(v));

interface RoundDraft { name: string; type: DriveRoundType; scheduledAt: string }

const DEFAULT_ROUNDS: RoundDraft[] = [
  { name: 'Online Assessment', type: 'aptitude', scheduledAt: '' },
  { name: 'Technical Interview', type: 'interview', scheduledAt: '' },
  { name: 'HR Interview', type: 'hr', scheduledAt: '' },
];

function Field({ label, hint, children, className = '' }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-gray-400 mt-1">{hint}</span>}
    </label>
  );
}

export function DriveEditorModal({ drive, onClose, onSaved }: { drive?: PlacementDrive; onClose: () => void; onSaved?: (id: string) => void }) {
  const [companyName, setCompanyName] = useState(drive?.companyName ?? '');
  const [companyWebsite, setCompanyWebsite] = useState(drive?.companyWebsite ?? '');
  const [roleTitle, setRoleTitle] = useState(drive?.roleTitle ?? '');
  const [jobType, setJobType] = useState<DriveJobType>(drive?.jobType ?? 'full_time');
  const [ctcLpa, setCtcLpa] = useState(drive?.ctcLpa?.toString() ?? '');
  const [stipend, setStipend] = useState(drive?.stipendPerMonth?.toString() ?? '');
  const [location, setLocation] = useState(drive?.location ?? '');
  const [description, setDescription] = useState(drive?.description ?? '');
  const [deadline, setDeadline] = useState(toLocalInput(drive?.applicationDeadline));
  const [driveDate, setDriveDate] = useState(drive?.driveDate?.slice(0, 10) ?? '');
  const [minCgpa, setMinCgpa] = useState(drive?.eligibility.minCgpa?.toString() ?? '');
  const [maxBacklogs, setMaxBacklogs] = useState(drive?.eligibility.maxBacklogs?.toString() ?? '');
  const [departments, setDepartments] = useState(drive?.eligibility.departments.join(', ') ?? '');
  const [batches, setBatches] = useState(drive?.eligibility.batches.join(', ') ?? '');
  const [placementYears, setPlacementYears] = useState(drive?.eligibility.placementYears.join(', ') ?? '');
  const [excludePlaced, setExcludePlaced] = useState(drive?.eligibility.excludePlaced ?? true);
  const [rounds, setRounds] = useState<RoundDraft[]>(
    drive ? drive.rounds.map((r) => ({ name: r.name, type: r.type, scheduledAt: toLocalInput(r.scheduledAt) })) : DEFAULT_ROUNDS
  );
  const [error, setError] = useState('');

  const create = useCreateDrive();
  const update = useUpdateDrive();
  const saving = create.isPending || update.isPending;

  const setRound = (i: number, patch: Partial<RoundDraft>) => setRounds((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const moveRound = (i: number, by: number) =>
    setRounds((rs) => {
      const next = [...rs];
      const [r] = next.splice(i, 1);
      next.splice(i + by, 0, r);
      return next;
    });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const payload: CreatePlacementDrivePayload = {
      companyName: companyName.trim(),
      companyWebsite: companyWebsite.trim() || undefined,
      roleTitle: roleTitle.trim(),
      description: description.trim() || undefined,
      jobType,
      ctcLpa: optionalNumber(ctcLpa),
      stipendPerMonth: optionalNumber(stipend),
      location: location.trim() || undefined,
      applicationDeadline: fromLocalInput(deadline),
      driveDate: driveDate ? new Date(`${driveDate}T00:00:00`).toISOString() : undefined,
      eligibility: {
        minCgpa: optionalNumber(minCgpa),
        maxBacklogs: optionalNumber(maxBacklogs),
        departments: splitList(departments),
        batches: splitList(batches),
        placementYears: splitList(placementYears),
        excludePlaced,
      },
      rounds: rounds.filter((r) => r.name.trim()).map((r) => ({ name: r.name.trim(), type: r.type, scheduledAt: fromLocalInput(r.scheduledAt) })),
    };
    try {
      if (drive) {
        await update.mutateAsync({ id: drive._id, payload });
        onSaved?.(drive._id);
      } else {
        const created = await create.mutateAsync(payload);
        onSaved?.(created._id);
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <form onSubmit={handleSubmit} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{drive ? 'Edit drive' : 'New placement drive'}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Company &amp; role</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Company name *"><input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required className={inputCls} placeholder="e.g. Infosys" /></Field>
              <Field label="Role *"><input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} required className={inputCls} placeholder="e.g. Systems Engineer" /></Field>
              <Field label="Job type">
                <select value={jobType} onChange={(e) => setJobType(e.target.value as DriveJobType)} className={inputCls}>
                  {(Object.keys(JOB_TYPE_LABEL) as DriveJobType[]).map((t) => <option key={t} value={t}>{JOB_TYPE_LABEL[t]}</option>)}
                </select>
              </Field>
              <Field label="Location"><input value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} placeholder="e.g. Bengaluru / Pan India" /></Field>
              <Field label="CTC (LPA)" hint={jobType === 'internship' ? 'Leave blank for a pure internship' : undefined}>
                <input type="number" step="0.01" min="0" value={ctcLpa} onChange={(e) => setCtcLpa(e.target.value)} className={inputCls} placeholder="e.g. 6.5" />
              </Field>
              <Field label="Stipend (₹ / month)"><input type="number" min="0" value={stipend} onChange={(e) => setStipend(e.target.value)} className={inputCls} placeholder="Internships only" /></Field>
              <Field label="Company website" className="sm:col-span-2"><input value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} className={inputCls} placeholder="https://" /></Field>
              <Field label="Job description" className="sm:col-span-2">
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={`${inputCls} h-auto py-2 resize-y`} placeholder="Responsibilities, bond, training location, documents to carry…" />
              </Field>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Dates</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Application deadline"><input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputCls} /></Field>
              <Field label="Drive date"><input type="date" value={driveDate} onChange={(e) => setDriveDate(e.target.value)} className={inputCls} /></Field>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Eligibility</h3>
            <p className="text-xs text-gray-400 mb-3">Leave a field blank for no restriction. Only eligible students can apply, and they're notified when you open the drive.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Minimum CGPA"><input type="number" step="0.01" min="0" max="10" value={minCgpa} onChange={(e) => setMinCgpa(e.target.value)} className={inputCls} placeholder="e.g. 7" /></Field>
              <Field label="Max active backlogs"><input type="number" min="0" value={maxBacklogs} onChange={(e) => setMaxBacklogs(e.target.value)} className={inputCls} placeholder="e.g. 0" /></Field>
              <Field label="Departments" hint="Comma-separated, e.g. Computer Science, Electronics"><input value={departments} onChange={(e) => setDepartments(e.target.value)} className={inputCls} /></Field>
              <Field label="Batches" hint="Comma-separated"><input value={batches} onChange={(e) => setBatches(e.target.value)} className={inputCls} /></Field>
              <Field label="Passing / placement year" hint="Comma-separated, e.g. 2026"><input value={placementYears} onChange={(e) => setPlacementYears(e.target.value)} className={inputCls} /></Field>
              <label className="flex items-start gap-2.5 sm:mt-6 cursor-pointer">
                <input type="checkbox" checked={excludePlaced} onChange={(e) => setExcludePlaced(e.target.checked)} className="mt-0.5 accent-violet-600" />
                <span className="text-sm text-gray-600">Exclude students who already hold a full-time offer</span>
              </label>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Selection rounds</h3>
              <button type="button" onClick={() => setRounds((rs) => [...rs, { name: '', type: 'other', scheduledAt: '' }])} className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700">
                <Plus className="w-3.5 h-3.5" /> Add round
              </button>
            </div>
            <div className="space-y-2">
              {rounds.map((r, i) => (
                <div key={i} className="grid grid-cols-[auto_minmax(0,1fr)] sm:grid-cols-[auto_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 items-center rounded-xl border border-gray-100 bg-gray-50/60 p-2">
                  <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <input value={r.name} onChange={(e) => setRound(i, { name: e.target.value })} placeholder="Round name" className={inputCls} />
                  <select value={r.type} onChange={(e) => setRound(i, { type: e.target.value as DriveRoundType })} className={`${inputCls} col-start-2 sm:col-start-auto`}>
                    {(Object.keys(ROUND_TYPE_LABEL) as DriveRoundType[]).map((t) => <option key={t} value={t}>{ROUND_TYPE_LABEL[t]}</option>)}
                  </select>
                  <input type="datetime-local" value={r.scheduledAt} onChange={(e) => setRound(i, { scheduledAt: e.target.value })} className={`${inputCls} col-start-2 sm:col-start-auto`} />
                  <div className="flex items-center gap-0.5 col-start-2 sm:col-start-auto">
                    <button type="button" disabled={i === 0} onClick={() => moveRound(i, -1)} className="p-1.5 rounded-lg text-gray-400 hover:bg-white disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
                    <button type="button" disabled={i === rounds.length - 1} onClick={() => moveRound(i, 1)} className="p-1.5 rounded-lg text-gray-400 hover:bg-white disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => setRounds((rs) => rs.filter((_, j) => j !== i))} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
              {rounds.length === 0 && <p className="text-xs text-gray-400">No rounds — you can still mark students selected directly.</p>}
            </div>
            {drive && drive.applicantCount > 0 && <p className="mt-2 text-[11px] text-amber-600">Results already recorded are stored by round position — reordering rounds after recording results will shift them.</p>}
          </section>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          {error && <p className="text-sm text-red-600 mr-auto">{error}</p>}
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {drive ? 'Save changes' : 'Create draft'}
          </button>
        </div>
      </form>
    </div>
  );
}
