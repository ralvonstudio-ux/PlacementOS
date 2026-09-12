import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Lock, Loader2, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuthContext } from '../context/AuthContext';
import { getHomePathForRole } from '../utils/roleHome';
import type { UserRole } from '@placementos/types';
import { pingServerAwake } from '../../../services/api';

export const LoginPage = () => {
  const { login, isAuthenticated, user } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [slowLoading, setSlowLoading] = useState(false);

  // The backend may run on a free-tier host that spins down when idle, so the
  // first request after inactivity can take 30-50s to wake it. Ping it the
  // moment this page loads so the real login request has a better chance of
  // hitting an already-warm server instead of paying the cold-start cost itself.
  useEffect(() => {
    pingServerAwake();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      setSlowLoading(false);
      return;
    }
    const timer = setTimeout(() => setSlowLoading(true), 4000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  const goHome = (role: UserRole) => {
    const from = (location.state as { from?: string })?.from ?? getHomePathForRole(role);
    navigate(from, { replace: true });
  };

  useEffect(() => {
    if (isAuthenticated && user) {
      goHome(user.role);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user]);

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setError('');
    setIsLoading(true);

    try {
      const loggedInUser = await login(email.trim(), password);
      goHome(loggedInUser.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0B0620] lg:flex text-white selection:bg-violet-500/30 selection:text-white font-sans relative overflow-hidden">
      <h1 className="sr-only">PlacementOS — Sign In</h1>

      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
        <div className="absolute -top-40 right-0 h-[32rem] w-[32rem] rounded-full bg-violet-600/15 blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 h-[26rem] w-[26rem] rounded-full bg-pink-600/10 blur-[120px]" />
      </div>

      {/* ── Left brand panel — desktop/tablet only ─────────────────────────── */}
      <div className="relative hidden overflow-hidden bg-[#0a0618] lg:flex lg:h-screen lg:aspect-[3/2] z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#180f30] via-[#0a0618] to-[#0B0620]" />
        <div className="pointer-events-none absolute -top-32 -right-16 h-[28rem] w-[28rem] rounded-full bg-violet-600/15 blur-[120px]" />
        <div className="pointer-events-none absolute bottom-0 -left-16 h-[24rem] w-[24rem] rounded-full bg-pink-600/10 blur-[120px]" />

        <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-6 px-10 text-center">
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white ring-2 ring-violet-500/70 shadow-[0_0_60px_rgba(124,58,237,0.35)]">
            <span className="text-4xl font-black text-violet-700">P</span>
          </div>
          <div>
            <p className="text-5xl font-black tracking-tight" aria-hidden="true">
              <span className="text-white">Placement</span>
              <span className="text-violet-400">OS</span>
            </p>
            <p className="mt-2 text-sm font-medium tracking-[0.35em] text-white/60">
              TRAINING &amp; PLACEMENT CELL
            </p>
          </div>
          <div className="h-px w-16 bg-violet-500" />
          <p className="max-w-sm text-base text-white/80">
            Empowering Placements.
            <br />
            <span className="text-violet-400">Building Careers.</span>
          </p>
        </div>
      </div>

      {/* ── Right panel — login form ────────────────────────────────────────── */}
      <main className="relative flex min-h-screen flex-1 items-center justify-center px-4 py-3 lg:min-h-0 z-10">
        <div className="relative w-full max-w-[410px] z-10">
          <div className="rounded-[28px] border border-white/[0.08] bg-[#120B25] p-5 shadow-[0_25px_60px_rgba(0,0,0,0.85)]">
            <div className="mb-3 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white ring-2 ring-violet-500/70 shadow-[0_0_45px_rgba(124,58,237,0.35)]">
                <span className="text-2xl font-black text-violet-700">P</span>
              </div>
            </div>

            <div className="mb-3 flex flex-col items-center text-center">
              <h2 className="text-xl font-bold tracking-tight text-white">Welcome Back</h2>
              <p className="mt-1 text-sm text-zinc-400">Sign in to access your placement cell account</p>
            </div>

            <form onSubmit={handlePasswordSubmit} noValidate className="space-y-3">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Email or Username
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                  <input
                    id="email"
                    type="text"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email or username"
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-white/[0.06] bg-[#17102B]
                               text-base text-white placeholder-zinc-600
                               focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500
                               transition-all duration-150"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full h-11 pl-10 pr-11 rounded-xl border border-white/[0.06] bg-[#17102B]
                               text-base text-white placeholder-zinc-600
                               focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500
                               transition-all duration-150"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-red-950/40 border border-red-900/30 px-4 py-3">
                  <p className="text-sm font-medium text-red-400">{error}</p>
                </div>
              )}

              {slowLoading && (
                <div className="rounded-xl bg-violet-950/30 border border-violet-900/30 px-4 py-3">
                  <p className="text-sm font-medium text-violet-300">
                    Waking up the server — this can take up to a minute the first time today.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !email || !password}
                className="w-full h-11 rounded-xl bg-violet-600 hover:bg-violet-500 active:bg-violet-700
                           text-base font-bold text-white
                           flex items-center justify-center gap-2
                           transition-all duration-200
                           shadow-md shadow-violet-600/10 hover:shadow-violet-500/25
                           disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {slowLoading ? 'Waking up server…' : 'Signing in…'}
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="border-t border-white/[0.08] my-3" />

            <div className="text-center">
              <p className="text-sm font-bold text-white">Need Help?</p>
              <p className="mt-0.5 text-sm text-zinc-400">Contact your TPO administrator.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
