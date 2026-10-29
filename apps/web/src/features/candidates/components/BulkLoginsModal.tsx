import { useState } from 'react';
import { X, KeyRound, Download, Printer, Loader2, AlertTriangle, CheckCircle2, Mail, MailX } from 'lucide-react';
import { useBulkCreateLogins, useCandidateBatches } from '../hooks/useCandidates';
import { downloadCredentialsCsv, printCredentialSlips } from './credentialSlips';
import type { BulkCreateLoginsResult } from '@placementos/types';

/** Issues logins to every student (or one batch) that doesn't have one yet, then offers the
 *  credentials as a CSV and printable slips — the passwords are never shown again. */
export function BulkLoginsModal({ onClose, missingCount }: { onClose: () => void; missingCount?: number }) {
  const [batch, setBatch] = useState('');
  const [emailCreds, setEmailCreds] = useState(true);
  const [result, setResult] = useState<BulkCreateLoginsResult | null>(null);
  const [error, setError] = useState('');
  const [popupBlocked, setPopupBlocked] = useState(false);
  const { data: batches = [] } = useCandidateBatches();
  const create = useBulkCreateLogins();

  async function run() {
    setError('');
    try {
      setResult(await create.mutateAsync({ ...(batch ? { batch } : {}), emailCredentials: emailCreds }));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const close = () => {
    if (result?.created.length && !window.confirm("Close this window? The passwords won't be shown again — make sure you've downloaded or printed them.")) return;
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} aria-hidden="true" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] flex flex-col">
        <button type="button" onClick={close} className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X className="w-4 h-4" /></button>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Create logins in bulk</h2>

        {!result ? (
          <>
            <p className="text-sm text-gray-500 mb-5">
              Every student without a login gets one: their <span className="font-medium text-gray-700">roll number</span> as the login ID and a random password.
              {missingCount !== undefined && <> {missingCount} student{missingCount === 1 ? '' : 's'} on this page still need{missingCount === 1 ? 's' : ''} one.</>}
            </p>
            <label className="block text-xs font-medium text-gray-600 mb-1">Students</label>
            <select value={batch} onChange={(e) => setBatch(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-violet-500/30">
              <option value="">All batches</option>
              {batches.map((b) => <option key={b} value={b}>Batch {b}</option>)}
            </select>
            <label className="flex items-start gap-2.5 rounded-xl border border-gray-200 px-4 py-3 mb-4 cursor-pointer hover:bg-gray-50">
              <input type="checkbox" checked={emailCreds} onChange={(e) => setEmailCreds(e.target.checked)} className="mt-0.5 accent-violet-600" />
              <span className="text-sm text-gray-700">
                <span className="font-medium text-gray-900">Email each student their login details</span>
                <span className="block text-xs text-gray-500 mt-0.5">Sent from PlacementOS to the email on each student's record. Students without an email get a printable slip instead.</span>
              </span>
            </label>
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-xs text-amber-800 flex gap-2 mb-5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Passwords are shown only once, on the next screen. Download the CSV or print slips for anyone not emailed before closing it. You can reset a student's password later if one gets lost.
            </div>
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <button onClick={run} disabled={create.isPending} className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white disabled:opacity-50">
              {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              {create.isPending ? 'Creating logins…' : 'Create logins'}
            </button>
          </>
        ) : (
          <>
            <p className="flex items-center gap-2 text-sm text-green-700 font-medium mb-4">
              <CheckCircle2 className="w-4 h-4" /> {result.created.length} login{result.created.length === 1 ? '' : 's'} created
              {result.skipped.length > 0 && <span className="text-amber-700 font-normal">· {result.skipped.length} skipped</span>}
            </p>
            {emailCreds && result.created.length > 0 && (() => {
              const emailed = result.created.filter((c) => c.emailedTo).length;
              const notEmailed = result.created.length - emailed;
              const reason = result.created.find((c) => c.emailError)?.emailError;
              return (
                <p className={`flex items-center gap-2 text-sm mb-4 ${notEmailed ? 'text-amber-700' : 'text-green-700'}`}>
                  {notEmailed ? <MailX className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                  Emailed {emailed} of {result.created.length}
                  {notEmailed > 0 && <span className="font-normal">· {notEmailed} need a slip{reason === 'Email is not set up on the server' ? ' (email is not set up on the server yet)' : ''}</span>}
                </p>
              );
            })()}
            {result.created.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                <button onClick={() => downloadCredentialsCsv(result.created, `student-logins${batch ? `-${batch}` : ''}.csv`)} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white">
                  <Download className="w-4 h-4" /> Download CSV
                </button>
                {(() => {
                  const notEmailed = result.created.filter((c) => !c.emailedTo);
                  const onlySome = emailCreds && notEmailed.length > 0 && notEmailed.length < result.created.length;
                  if (emailCreds && notEmailed.length === 0) return null;
                  return (
                    <button onClick={() => setPopupBlocked(!printCredentialSlips(emailCreds ? notEmailed : result.created))} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                      <Printer className="w-4 h-4" /> {onlySome ? `Print slips for the ${notEmailed.length} not emailed` : 'Print slips'}
                    </button>
                  );
                })()}
              </div>
            )}
            {popupBlocked && <p className="text-xs text-red-600 mb-3">The browser blocked the print window — allow pop-ups for this site and try again.</p>}
            {result.created.length === 0 && result.skipped.length === 0 && (
              <p className="text-sm text-gray-500">Everyone in this selection already has a login.</p>
            )}
            <div className="overflow-y-auto rounded-xl border border-gray-100 min-h-0">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs text-gray-500 sticky top-0">
                  <tr><th className="px-3 py-2 font-medium">Student</th><th className="px-3 py-2 font-medium">Login ID</th><th className="px-3 py-2 font-medium">Password</th>{emailCreds && <th className="px-3 py-2 font-medium">Email</th>}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {result.created.map((c) => (
                    <tr key={c.candidateId}>
                      <td className="px-3 py-2"><p className="font-medium text-gray-900">{c.fullName}</p><p className="text-xs text-gray-400">{c.rollNumber} · {c.batch}</p></td>
                      <td className="px-3 py-2 font-mono text-gray-800">{c.loginId}</td>
                      <td className="px-3 py-2 font-mono font-semibold text-gray-900 tracking-wide">{c.password}</td>
                      {emailCreds && (
                        <td className="px-3 py-2 text-xs">
                          {c.emailedTo ? <span className="inline-flex items-center gap-1 text-green-700" title={c.emailedTo}><Mail className="w-3.5 h-3.5" /> Sent</span> : <span className="text-amber-700">{c.emailError ?? 'Not sent'}</span>}
                        </td>
                      )}
                    </tr>
                  ))}
                  {result.skipped.map((s) => (
                    <tr key={`skip-${s.rollNumber}`} className="bg-amber-50/40">
                      <td className="px-3 py-2"><p className="font-medium text-gray-900">{s.fullName}</p><p className="text-xs text-gray-400">{s.rollNumber}</p></td>
                      <td colSpan={emailCreds ? 3 : 2} className="px-3 py-2 text-xs text-amber-700">Skipped — {s.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
