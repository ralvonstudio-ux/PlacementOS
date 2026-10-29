import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { User, Lock, KeyRound, Loader2, ArrowLeft, ArrowRight, Eye, EyeOff, CheckCircle2, MailCheck } from 'lucide-react';
import { authApi } from '../api/auth.api';

type Step = 'request' | 'code' | 'done';

const inputCls =
  'w-full h-11 pl-10 pr-4 rounded-xl border border-white/[0.06] bg-[#17102B] text-base text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all duration-150';
const primaryBtn =
  'w-full h-11 rounded-xl bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-base font-bold text-white flex items-center justify-center gap-2 transition-all duration-200 shadow-md shadow-violet-600/10 disabled:opacity-50 disabled:cursor-not-allowed';

function Field({ id, label, icon: Icon, children }: { id: string; label: string; icon: typeof User; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-zinc-300 mb-1.5">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        {children}
      </div>
    </div>
  );
}

/** Self-service password reset: identifier → 6-digit code by email → new password. */
export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // The link in the email opens straight on the code step with the identifier filled in.
  const [step, setStep] = useState<Step>(params.get('step') === 'code' && params.get('id') ? 'code' : 'request');
  const [identifier, setIdentifier] = useState(params.get('id') ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function requestCode(e?: FormEvent) {
    e?.preventDefault();
    if (!identifier.trim()) return;
    setError('');
    setBusy(true);
    try {
      await authApi.forgotPassword(identifier.trim());
      setNotice("If that account exists and has an email on file, we've sent it a 6-digit code. It expires in 10 minutes.");
      setStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Your new password must be at least 8 characters.');
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    try {
      await authApi.resetPassword({ identifier: identifier.trim(), code: code.trim(), newPassword: password });
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#0B0620] flex items-center justify-center px-4 py-8 text-white font-sans relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-40 right-0 h-[32rem] w-[32rem] rounded-full bg-violet-600/15 blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 h-[26rem] w-[26rem] rounded-full bg-pink-600/10 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-[410px] rounded-[28px] border border-white/[0.08] bg-[#120B25] p-6 shadow-[0_25px_60px_rgba(0,0,0,0.85)]">
        <div className="mb-4 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white ring-2 ring-violet-500/70 shadow-[0_0_45px_rgba(124,58,237,0.35)]">
            {step === 'done' ? <CheckCircle2 className="w-7 h-7 text-green-600" /> : <KeyRound className="w-6 h-6 text-violet-700" />}
          </div>
        </div>

        {step === 'request' && (
          <>
            <div className="mb-5 text-center">
              <h1 className="text-xl font-bold tracking-tight">Forgot your password?</h1>
              <p className="mt-1 text-sm text-zinc-400">Enter your roll number or email. We'll email you a 6-digit code to set a new password.</p>
            </div>
            <form onSubmit={requestCode} noValidate className="space-y-4">
              <Field id="identifier" label="Roll number or email" icon={User}>
                <input id="identifier" autoComplete="username" autoFocus value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="e.g. cse-2026-014 or you@college.edu" className={inputCls} />
              </Field>
              {error && <p className="rounded-xl bg-red-950/40 border border-red-900/30 px-4 py-3 text-sm font-medium text-red-400">{error}</p>}
              <button type="submit" disabled={busy || !identifier.trim()} className={primaryBtn}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Send code <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          </>
        )}

        {step === 'code' && (
          <>
            <div className="mb-4 text-center">
              <h1 className="text-xl font-bold tracking-tight">Check your email</h1>
              <p className="mt-1 text-sm text-zinc-400">Enter the code we sent for <span className="text-zinc-200 font-medium">{identifier}</span> and choose a new password.</p>
            </div>
            {notice && (
              <p className="mb-4 flex gap-2 rounded-xl bg-violet-950/30 border border-violet-900/30 px-4 py-3 text-sm text-violet-200">
                <MailCheck className="w-4 h-4 shrink-0 mt-0.5" /> {notice}
              </p>
            )}
            <form onSubmit={resetPassword} noValidate className="space-y-4">
              <Field id="code" label="6-digit code" icon={KeyRound}>
                <input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                  className={`${inputCls} tracking-[0.5em] font-mono text-lg`}
                />
              </Field>
              <Field id="new-password" label="New password" icon={Lock}>
                <input id="new-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className={`${inputCls} pr-11`} />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-0 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center text-zinc-500 hover:text-zinc-300" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </Field>
              <Field id="confirm-password" label="Confirm new password" icon={Lock}>
                <input id="confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Type it again" className={inputCls} />
              </Field>
              {error && <p className="rounded-xl bg-red-950/40 border border-red-900/30 px-4 py-3 text-sm font-medium text-red-400">{error}</p>}
              <button type="submit" disabled={busy || code.length !== 6 || !password || !confirm} className={primaryBtn}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Set new password'}
              </button>
              <p className="text-center text-sm text-zinc-400">
                No email?{' '}
                <button type="button" onClick={() => requestCode()} disabled={busy} className="font-semibold text-violet-400 hover:text-violet-300 disabled:opacity-50">Send a new code</button>
                {' '}· check spam, or ask your TPO to reset it.
              </p>
            </form>
          </>
        )}

        {step === 'done' && (
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight">Password updated</h1>
            <p className="mt-1 mb-5 text-sm text-zinc-400">You can sign in with your new password. You've been signed out on your other devices.</p>
            <button onClick={() => navigate('/login', { replace: true })} className={primaryBtn}>
              Go to sign in <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step !== 'done' && (
          <div className="mt-5 pt-4 border-t border-white/[0.08] text-center">
            <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white">
              <ArrowLeft className="w-4 h-4" /> Back to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
