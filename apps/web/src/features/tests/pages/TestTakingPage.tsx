import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, Camera, CheckCircle2, Loader2, Maximize, MonitorUp, ShieldAlert, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStartTest, useSubmitTestAnswer, useLogTestViolation, useSubmitTest } from '../hooks/useTests';
import { extractErrorMessage } from '@/services/api';
import type { TestQuestionForCandidate, TestViolationType, StartTestAttemptResult } from '@placementos/types';

type Phase = 'instructions' | 'in_progress' | 'submitted' | 'auto_submitted';

const VIOLATION_LABEL: Record<TestViolationType, string> = {
  tab_switch: 'Switched away from the test tab',
  window_blur: 'Test window lost focus',
  fullscreen_exit: 'Exited fullscreen mode',
  copy_paste: 'Copy/paste attempted',
  right_click: 'Right-click / context menu attempted',
  devtools: 'Developer tools detected',
  no_face: 'Camera feed lost',
  screen_share_stopped: 'Screen sharing was stopped',
  extension_detected: 'A browser extension was detected',
};

// DevTools heuristic: a docked panel changes the gap between outer and inner window
// dimensions past what normal browser chrome accounts for. Not foolproof — a genuinely
// tiny/undocked window can false-positive — but it's the same signal every browser-based
// proctoring tool uses, since a page has no real way to ask "is DevTools open?".
const DEVTOOLS_THRESHOLD = 160;

// Best-effort extension fingerprints — a page can't ask the browser "list my extensions",
// so this looks for DOM/global-scope traces the most common ones leave behind. Each check
// runs on its own and is reported at most once per attempt (see extensionsReportedRef) so a
// persistent extension doesn't spam repeat violations every poll.
const EXTENSION_CHECKS: Array<{ id: string; detail: string; test: () => boolean }> = [
  {
    id: 'grammarly',
    detail: 'Grammarly extension detected',
    test: () => !!document.querySelector('grammarly-desktop-integration, grammarly-extension, [data-gr-ext-installed]'),
  },
  {
    id: 'lastpass',
    detail: 'LastPass extension detected',
    test: () => !!document.querySelector('[data-lastpass-icon-root], #__lastpass_root'),
  },
  {
    id: 'translate',
    detail: 'Translate extension detected',
    test: () => !!document.querySelector('#google_translate_element, .goog-te-banner-frame'),
  },
  {
    id: 'dark-reader',
    detail: 'Dark Reader extension detected',
    test: () => document.documentElement.getAttribute('data-darkreader-mode') !== null,
  },
  {
    id: 'web3-wallet',
    detail: 'Wallet / web3 extension detected',
    test: () => typeof (window as unknown as { ethereum?: unknown }).ethereum !== 'undefined',
  },
  {
    id: 'react-devtools',
    detail: 'React/Redux DevTools extension detected',
    test: () => typeof (window as unknown as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown }).__REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined',
  },
  {
    id: 'honey',
    detail: 'Honey extension detected',
    test: () => !!document.querySelector('honey-extension, #honey-header'),
  },
];

// Classic ad-blocker bait: a hidden element named like an ad gets hidden or stripped of
// layout by any content-blocking extension — presence of the technique itself (not any one
// named product) is the signal.
function checkAdBlockBait(): boolean {
  const bait = document.getElementById('__proctor_adblock_bait__');
  if (!bait) return false;
  return bait.offsetParent === null || bait.offsetHeight === 0 || getComputedStyle(bait).display === 'none';
}

export function TestTakingPage() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('instructions');
  const [session, setSession] = useState<StartTestAttemptResult | null>(null);
  const [answers, setAnswers] = useState<Record<number, { selectedOption?: string; answerText?: string }>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [violationBanner, setViolationBanner] = useState<{ type: TestViolationType; count: number; limit: number } | null>(null);
  const [cameraError, setCameraError] = useState('');
  const [screenShareError, setScreenShareError] = useState('');
  const [error, setError] = useState('');
  const [finalScore, setFinalScore] = useState<number | undefined>();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const attemptIdRef = useRef<string>('');
  const phaseRef = useRef<Phase>('instructions');
  const devtoolsOpenRef = useRef(false);
  const extensionsReportedRef = useRef<Set<string>>(new Set());

  const startTest = useStartTest();
  const submitAnswerMutation = useSubmitTestAnswer();
  const logViolationMutation = useLogTestViolation();
  const submitTestMutation = useSubmitTest();

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const stopMediaStreams = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
  }, []);

  const exitFullscreenIfActive = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);

  const reportViolation = useCallback(
    async (type: TestViolationType, detail?: string) => {
      if (phaseRef.current !== 'in_progress' || !attemptIdRef.current) return;
      try {
        const result = await logViolationMutation.mutateAsync({ attemptId: attemptIdRef.current, payload: { type, detail } });
        setViolationBanner({ type, count: result.violationCount, limit: result.limit });
        if (result.autoSubmitted) {
          setPhase('auto_submitted');
          stopMediaStreams();
          exitFullscreenIfActive();
        }
      } catch {
        // A failed violation-log call shouldn't itself crash the test — the server is still
        // the source of truth for the count, so this is best-effort telemetry from the client.
      }
    },
    [logViolationMutation, stopMediaStreams, exitFullscreenIfActive]
  );

  // `reportViolation` is recreated whenever `logViolationMutation` (a TanStack Query mutation
  // object) gets a new identity, which happens far more often than the listeners/intervals
  // below actually need to be rebuilt — most visibly, the once-a-second countdown re-render
  // was tearing down and recreating the devtools/extension intervals before their multi-second
  // period ever elapsed, so they silently never fired. Routing calls through a ref keeps the
  // proctoring effect's own dependency array down to just `phase`, so it mounts once per attempt
  // and its intervals actually get to run.
  const reportViolationRef = useRef(reportViolation);
  useEffect(() => { reportViolationRef.current = reportViolation; }, [reportViolation]);

  // ── Proctoring listeners — armed only while a test is actually in progress ──
  useEffect(() => {
    if (phase !== 'in_progress') return;

    const onVisibilityChange = () => { if (document.hidden) reportViolationRef.current('tab_switch'); };
    const onBlur = () => reportViolationRef.current('window_blur');
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        reportViolationRef.current('fullscreen_exit');
        document.documentElement.requestFullscreen().catch(() => {});
      }
    };
    const onCopyCutPaste = (e: ClipboardEvent) => { e.preventDefault(); reportViolationRef.current('copy_paste'); };
    const onContextMenu = (e: MouseEvent) => { e.preventDefault(); reportViolationRef.current('right_click'); };
    const onKeyDown = (e: KeyboardEvent) => {
      // Block the most common "escape the lockdown" shortcuts outright, not just detect them.
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key)) || (e.ctrlKey && ['c', 'v', 'x', 'u', 'p'].includes(e.key))) {
        e.preventDefault();
        if (e.key === 'F12' || (e.ctrlKey && e.shiftKey)) reportViolationRef.current('devtools');
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('copy', onCopyCutPaste);
    document.addEventListener('cut', onCopyCutPaste);
    document.addEventListener('paste', onCopyCutPaste);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('keydown', onKeyDown);

    const devtoolsInterval = setInterval(() => {
      const isOpen = window.outerWidth - window.innerWidth > DEVTOOLS_THRESHOLD || window.outerHeight - window.innerHeight > DEVTOOLS_THRESHOLD;
      if (isOpen && !devtoolsOpenRef.current) {
        devtoolsOpenRef.current = true;
        reportViolationRef.current('devtools');
      } else if (!isOpen) {
        devtoolsOpenRef.current = false;
      }
    }, 1500);

    // Ad-block bait element — see checkAdBlockBait for how this is read.
    const bait = document.createElement('div');
    bait.id = '__proctor_adblock_bait__';
    bait.className = 'ad ads adsbox banner-ad textad text_ad text-ad';
    bait.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;';
    document.body.appendChild(bait);

    const extensionInterval = setInterval(() => {
      for (const check of EXTENSION_CHECKS) {
        if (extensionsReportedRef.current.has(check.id)) continue;
        if (check.test()) {
          extensionsReportedRef.current.add(check.id);
          reportViolationRef.current('extension_detected', check.detail);
        }
      }
      if (!extensionsReportedRef.current.has('adblock') && checkAdBlockBait()) {
        extensionsReportedRef.current.add('adblock');
        reportViolationRef.current('extension_detected', 'Ad-blocking or content-blocking extension detected');
      }
    }, 2000);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('copy', onCopyCutPaste);
      document.removeEventListener('cut', onCopyCutPaste);
      document.removeEventListener('paste', onCopyCutPaste);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('keydown', onKeyDown);
      clearInterval(devtoolsInterval);
      clearInterval(extensionInterval);
      bait.remove();
    };
    // Deliberately just `phase` — see reportViolationRef above for why reportViolation itself
    // must not be a dependency here.
  }, [phase]);

  // ── Countdown timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'in_progress' || secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [phase, secondsLeft]);

  useEffect(() => {
    if (phase === 'in_progress' && secondsLeft === 0 && session) {
      handleFinalSubmit(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, phase]);

  // Release the camera/screen-share and fullscreen if the candidate navigates away mid-test.
  useEffect(() => () => { stopMediaStreams(); exitFullscreenIfActive(); }, [stopMediaStreams, exitFullscreenIfActive]);

  async function handleStart() {
    if (!testId) return;
    setError('');
    setCameraError('');
    setScreenShareError('');

    try {
      await document.documentElement.requestFullscreen();
    } catch {
      setError('Fullscreen mode is required to start this test — please allow it and try again.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      stream.getVideoTracks()[0]?.addEventListener('ended', () => reportViolation('no_face', 'Camera stream ended'));
    } catch {
      setCameraError('Camera access is required for this test. Please allow camera permission and try again.');
      exitFullscreenIfActive();
      return;
    }

    try {
      // Screen sharing is required for the full test duration — the candidate picks what to
      // share (whole screen recommended); stopping it mid-test, or narrowing it to just this
      // tab, is on the candidate to avoid but only an outright stop is detectable and logged.
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = screenStream;
      screenStream.getVideoTracks()[0]?.addEventListener('ended', () => reportViolation('screen_share_stopped', 'Screen-share stream ended'));
    } catch {
      setScreenShareError('Screen sharing is required for this test. Please allow it and try again.');
      stopMediaStreams();
      exitFullscreenIfActive();
      return;
    }

    try {
      const result = await startTest.mutateAsync(testId);
      setSession(result);
      attemptIdRef.current = result.attempt._id;
      const existingAnswers: Record<number, { selectedOption?: string; answerText?: string }> = {};
      for (const a of result.attempt.answers) existingAnswers[a.questionIndex] = { selectedOption: a.selectedOption, answerText: a.answerText };
      setAnswers(existingAnswers);

      // Remaining time is derived from startedAt + durationMinutes, not reset to full duration
      // on reload — a candidate reopening the tab (or triggering a fullscreen-exit violation
      // that they then resume from) doesn't get extra time for free.
      const startedAtMs = new Date(result.attempt.startedAt).getTime();
      const serverNowMs = new Date(result.serverTime).getTime();
      const elapsedSeconds = Math.max(0, Math.floor((serverNowMs - startedAtMs) / 1000));
      const totalSeconds = result.durationMinutes * 60;
      setSecondsLeft(Math.max(0, totalSeconds - elapsedSeconds));
      setPhase('in_progress');
    } catch (err) {
      setError(extractErrorMessage(err));
      stopMediaStreams();
      exitFullscreenIfActive();
    }
  }

  function answerFor(index: number) {
    return answers[index] ?? {};
  }

  function setAnswer(index: number, patch: { selectedOption?: string; answerText?: string }) {
    setAnswers((prev) => ({ ...prev, [index]: { ...prev[index], ...patch } }));
    if (attemptIdRef.current) {
      submitAnswerMutation.mutate({ attemptId: attemptIdRef.current, payload: { questionIndex: index, ...patch } });
    }
  }

  async function handleFinalSubmit(confirmed: boolean) {
    if (!attemptIdRef.current) return;
    if (!confirmed && phase === 'in_progress' && secondsLeft > 0) return;
    try {
      const result = await submitTestMutation.mutateAsync(attemptIdRef.current);
      setFinalScore(result.score);
      setPhase('submitted');
    } finally {
      stopMediaStreams();
      exitFullscreenIfActive();
    }
  }

  const questions: TestQuestionForCandidate[] = session?.questions ?? [];
  const question = questions[currentIndex];
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  if (phase === 'submitted' || phase === 'auto_submitted') {
    return (
      <div className="min-h-screen bg-[#0B0620] flex items-center justify-center p-6">
        <div className="bg-[#150C29] border border-white/10 rounded-2xl p-10 max-w-md text-center">
          {phase === 'auto_submitted' ? (
            <>
              <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h1 className="text-xl font-bold text-white mb-2">Test auto-submitted</h1>
              <p className="text-sm text-zinc-400">The proctoring violation limit for this test was exceeded, so your attempt was submitted automatically.</p>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <h1 className="text-xl font-bold text-white mb-2">Test submitted</h1>
              {finalScore !== undefined && <p className="text-sm text-zinc-400">Auto-graded score: <span className="text-white font-semibold">{finalScore}</span></p>}
            </>
          )}
          <button onClick={() => navigate('/candidate/tests')} className="mt-6 h-10 px-5 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors">
            Back to Tests
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'instructions') {
    return (
      <div className="min-h-screen bg-[#0B0620] flex items-center justify-center p-6">
        <div className="bg-[#150C29] border border-white/10 rounded-2xl p-8 max-w-lg w-full">
          <ShieldAlert className="w-10 h-10 text-violet-400 mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Before you start</h1>
          <p className="text-sm text-zinc-400 mb-5">This is a proctored test. The following are monitored and logged for the entire duration:</p>
          <ul className="space-y-2.5 mb-6">
            {[
              'Fullscreen mode is required — exiting it is logged as a violation',
              'Switching tabs or losing window focus is logged',
              'Copy, paste, and right-click are disabled and logged',
              'Your camera must stay on for the full test',
              'Your screen must stay shared for the full test — stopping it is logged',
              'Browser extensions (Grammarly, ad-blockers, translators, wallets, etc.) are detected and logged — disable them before starting',
              'Exceeding the violation limit auto-submits your test immediately',
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-sm text-zinc-300">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                {line}
              </li>
            ))}
          </ul>

          {(error || cameraError || screenShareError) && (
            <div className="mb-4 rounded-xl bg-red-950/40 border border-red-900/30 px-4 py-3">
              <p className="text-sm text-red-400">{error || cameraError || screenShareError}</p>
            </div>
          )}

          <button
            onClick={handleStart}
            disabled={startTest.isPending}
            className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-bold text-white transition-colors disabled:opacity-50"
          >
            {startTest.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Maximize className="w-4 h-4" />}
            Enable Fullscreen, Camera &amp; Screen Share, Start Test
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0620] text-white flex flex-col select-none" onDragStart={(e) => e.preventDefault()}>
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold">Proctored Test</span>
        </div>
        <div className={`font-mono text-lg font-bold tabular-nums ${secondsLeft < 60 ? 'text-red-400' : 'text-white'}`}>
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>
        <div className="flex items-center gap-3">
          <video ref={videoRef} autoPlay muted playsInline className="w-14 h-10 rounded-lg border border-white/20 object-cover bg-black" />
        </div>
      </header>

      {violationBanner && (
        <div className="bg-red-950/50 border-b border-red-900/40 px-6 py-2.5 flex items-center justify-between text-sm">
          <span className="text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {VIOLATION_LABEL[violationBanner.type]} — violation {violationBanner.count} of {violationBanner.limit} allowed
          </span>
          <button onClick={() => setViolationBanner(null)} className="text-red-400 hover:text-red-200">Dismiss</button>
        </div>
      )}

      <main className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <span className="text-sm text-zinc-400">Question {currentIndex + 1} of {questions.length}</span>
          <span className="text-sm text-zinc-400">{question?.marks} mark{question?.marks === 1 ? '' : 's'}</span>
        </div>

        {question && (
          <div className="bg-[#150C29] border border-white/10 rounded-2xl p-6 flex-1">
            <p className="text-base text-white mb-6">{question.questionText}</p>

            {question.questionType === 'mcq' ? (
              <div className="space-y-2.5">
                {(question.options ?? []).map((opt, i) => (
                  <label key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${answerFor(currentIndex).selectedOption === opt ? 'border-violet-500 bg-violet-500/10' : 'border-white/10 hover:border-white/20'}`}>
                    <input type="radio" name={`q-${currentIndex}`} checked={answerFor(currentIndex).selectedOption === opt} onChange={() => setAnswer(currentIndex, { selectedOption: opt })} className="accent-violet-500" />
                    <span className="text-sm text-zinc-200">{opt}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                value={answerFor(currentIndex).answerText ?? ''}
                onChange={(e) => setAnswer(currentIndex, { answerText: e.target.value })}
                rows={6}
                placeholder="Type your answer…"
                className="w-full px-4 py-3 rounded-xl bg-[#0B0620] border border-white/10 text-sm text-white placeholder-zinc-600 resize-none focus:outline-none focus:border-violet-500"
              />
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-white/10 text-sm font-medium text-zinc-300 hover:bg-white/5 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>

          {currentIndex === questions.length - 1 ? (
            <button
              onClick={() => handleFinalSubmit(true)}
              disabled={submitTestMutation.isPending}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-green-600 hover:bg-green-700 text-sm font-bold text-white transition-colors disabled:opacity-50"
            >
              {submitTestMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Submit Test
            </button>
          ) : (
            <button
              onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-6">
          {questions.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                i === currentIndex ? 'bg-violet-600 text-white' : answers[i]?.selectedOption || answers[i]?.answerText ? 'bg-green-500/20 text-green-300' : 'bg-white/5 text-zinc-400'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </main>

      <footer className="px-6 py-2.5 border-t border-white/10 flex items-center gap-2 text-xs text-zinc-500">
        <Camera className="w-3.5 h-3.5" />
        <MonitorUp className="w-3.5 h-3.5" />
        Camera &amp; screen share active · Fullscreen enforced · Extensions monitored · All activity is logged
      </footer>
    </div>
  );
}
