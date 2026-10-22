import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, Camera, CheckCircle2, Loader2, Maximize, MonitorUp, ShieldAlert, ChevronLeft, ChevronRight, Clock, Layers, FileQuestion, Send, XCircle, Unplug, KeyRound, BarChart3, Info, Globe } from 'lucide-react';
import { isAxiosError } from 'axios';
import { useStartTest, useSubmitTestAnswer, useLogTestViolation, useSubmitTest, useMyTests, useMarkQuestionViewed } from '../hooks/useTests';
import { testsApi, setAttemptSession, lookupClientIp } from '../api/tests.api';
import { CodingQuestionPanel, DEFAULT_STARTER } from '../components/CodingQuestionPanel';
import { extractErrorMessage } from '@/services/api';
import type { TestQuestionForCandidate, TestViolationType, StartTestAttemptResult, CodingLanguage, CodeSubmission } from '@placementos/types';

const PRIMARY_BTN = 'bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 text-white hover:opacity-90 transition-opacity';

type Phase = 'instructions' | 'in_progress' | 'submitted' | 'auto_submitted' | 'disconnected';

interface LocalAnswer {
  selectedOption?: string;
  answerText?: string;
  code?: string;
  language?: CodingLanguage;
  submission?: CodeSubmission;
}
type AnswerPatch = Omit<LocalAnswer, 'submission'>;

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
  multiple_screens: 'A second screen was detected',
};

const HEARTBEAT_MS = 15_000;

/** One id per browser tab per test — the server lets exactly one of these drive an attempt. */
function tabSessionId(assignmentId: string): string {
  const key = `test-session:${assignmentId}`;
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

const screenIsExtended = () => (window.screen as Screen & { isExtended?: boolean }).isExtended === true;

// DevTools heuristic: a docked panel changes the gap between outer and inner window
// dimensions past what normal browser chrome accounts for. Not foolproof — a genuinely
// tiny/undocked window can false-positive — but it's the same signal every browser-based
// proctoring tool uses, since a page has no real way to ask "is DevTools open?".
const DEVTOOLS_THRESHOLD = 160;

// Code autosave is debounced — a keystroke-per-request autosave would flood the server.
const CODE_AUTOSAVE_MS = 1200;

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
    // The hook's `renderers` map is only populated by the real extension — Vite's dev runtime
    // installs a bare stub hook of its own, which must not count.
    test: () => ((window as unknown as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: { renderers?: Map<unknown, unknown> } }).__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers?.size ?? 0) > 0 && !import.meta.env.DEV,
  },
  {
    id: 'honey',
    detail: 'Honey extension detected',
    test: () => !!document.querySelector('honey-extension, #honey-header'),
  },
];

// Generic (not per-product) extension signals: any element, stylesheet or loaded resource
// whose URL points into an extension package. Content scripts that inject UI or assets into
// the page almost always leave one of these.
const EXTENSION_URL = /^(chrome|moz|safari-web|ms-browser)-extension:\/\//i;

function findExtensionResource(): string | null {
  const el = document.querySelector<HTMLElement>(
    '[src^="chrome-extension://"],[href^="chrome-extension://"],[src^="moz-extension://"],[href^="moz-extension://"],[src^="safari-web-extension://"],[href^="safari-web-extension://"]'
  );
  if (el) return el.getAttribute('src') ?? el.getAttribute('href');
  const entry = performance.getEntriesByType('resource').find((e) => EXTENSION_URL.test(e.name));
  return entry?.name ?? null;
}

// Nodes an extension injects straight into <html>/<body>: custom elements, shadow-DOM hosts
// and iframes are all things this app itself never mounts outside the React root.
function looksInjected(node: Node): string | null {
  if (!(node instanceof HTMLElement)) return null;
  if (node.id === 'root' || node.id === '__proctor_adblock_bait__' || node.className.toString().includes('monaco')) return null;
  const tag = node.tagName.toLowerCase();
  if (tag.includes('-')) return `<${tag}>`;
  if (node.shadowRoot) return `<${tag}> with shadow DOM`;
  if (tag === 'iframe') return `iframe ${(node as HTMLIFrameElement).src || ''}`.trim();
  const url = node.getAttribute('src') ?? node.getAttribute('href');
  if (url && EXTENSION_URL.test(url)) return url;
  return null;
}

// Classic ad-blocker bait: a hidden element named like an ad gets hidden or stripped of
// layout by any content-blocking extension — presence of the technique itself (not any one
// named product) is the signal.
function checkAdBlockBait(): boolean {
  const bait = document.getElementById('__proctor_adblock_bait__');
  if (!bait) return false;
  return bait.offsetParent === null || bait.offsetHeight === 0 || getComputedStyle(bait).display === 'none';
}

function ensureAdBlockBait() {
  if (document.getElementById('__proctor_adblock_bait__')) return;
  const bait = document.createElement('div');
  bait.id = '__proctor_adblock_bait__';
  bait.className = 'ad ads adsbox banner-ad textad text_ad text-ad';
  bait.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;';
  document.body.appendChild(bait);
}

/** Everything that would end the test the moment it started — checked (and re-checked) on the
 *  start screen so a candidate can fix it first instead of being terminated. */
function scanEnvironment(): Array<{ id: string; detail: string }> {
  ensureAdBlockBait();
  const found: Array<{ id: string; detail: string }> = [];
  for (const check of EXTENSION_CHECKS) if (check.test()) found.push({ id: check.id, detail: check.detail });
  if (checkAdBlockBait()) found.push({ id: 'adblock', detail: 'Ad-blocking or content-blocking extension detected' });
  const resource = findExtensionResource();
  if (resource) found.push({ id: 'extension-resource', detail: `Extension resource loaded: ${resource.slice(0, 120)}` });
  for (const node of [...Array.from(document.documentElement.children), ...Array.from(document.body.children)]) {
    const what = looksInjected(node);
    if (what) found.push({ id: `injected:${what}`, detail: `Extension-injected element ${what.slice(0, 120)}` });
  }
  if (screenIsExtended()) found.push({ id: 'multiple-screens', detail: 'More than one screen is connected' });
  if (navigator.webdriver) found.push({ id: 'automation', detail: 'This browser is being controlled by automation software' });
  return found;
}

const isAnswered = (q: TestQuestionForCandidate | undefined, a: LocalAnswer | undefined) => {
  if (!q || !a) return false;
  if (q.questionType === 'coding') return !!a.submission;
  return !!(a.selectedOption || a.answerText?.trim());
};

export function TestTakingPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const { data: myTests } = useMyTests();
  const listing = myTests?.find((t) => t._id === assignmentId);

  const [phase, setPhase] = useState<Phase>('instructions');
  const [session, setSession] = useState<StartTestAttemptResult | null>(null);
  const [answers, setAnswers] = useState<Record<number, LocalAnswer>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [violationBanner, setViolationBanner] = useState<{ type: TestViolationType; count: number; limit: number; detail?: string } | null>(null);
  const [cameraError, setCameraError] = useState('');
  const [screenShareError, setScreenShareError] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [finalScore, setFinalScore] = useState<number | undefined>();
  const [agreed, setAgreed] = useState(false);
  const [envProblems, setEnvProblems] = useState<Array<{ id: string; detail: string }>>([]);
  const [terminationReason, setTerminationReason] = useState('');
  const [fullscreenExits, setFullscreenExits] = useState({ used: 0, allowed: 1 });
  // True the moment fullscreen is lost (tab-switch, Esc, etc). `requestFullscreen()` only
  // succeeds when called from a real user gesture, so instead of retrying it automatically
  // (which silently fails and leaves the browser chrome visible for the rest of the attempt —
  // see the fullscreenchange handler below) we block the test behind a recovery overlay whose
  // button click itself provides that gesture.
  const [fullscreenLost, setFullscreenLost] = useState(false);
  // Start-screen setup — each step is switched on by its own button before Start unlocks.
  const [cameraReady, setCameraReady] = useState(false);
  const [screenReady, setScreenReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(() => !!document.fullscreenElement);
  const [enabling, setEnabling] = useState<'' | 'camera' | 'screen' | 'fullscreen'>('');
  const [clientIp, setClientIp] = useState('');
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const attemptIdRef = useRef<string>('');
  const phaseRef = useRef<Phase>('instructions');
  const devtoolsOpenRef = useRef(false);
  const extensionsReportedRef = useRef<Set<string>>(new Set());
  const codeSaveTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const startTest = useStartTest();
  const submitAnswerMutation = useSubmitTestAnswer();
  const logViolationMutation = useLogTestViolation();
  const submitTestMutation = useSubmitTest();
  const markViewedMutation = useMarkQuestionViewed();

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // The video element only mounts once the test is in progress — attach the camera stream then.
  useEffect(() => {
    if (phase === 'in_progress' && videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current;
  }, [phase]);

  const stopMediaStreams = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setCameraReady(false);
    setScreenReady(false);
  }, []);

  // Live camera preview on the start screen, so the candidate can see they're in frame.
  useEffect(() => {
    if (phase === 'instructions' && cameraReady && previewVideoRef.current && streamRef.current) previewVideoRef.current.srcObject = streamRef.current;
  }, [phase, cameraReady]);

  // The candidate's real (public) IP — sent with every attempt call; see lookupClientIp.
  useEffect(() => { lookupClientIp().then(setClientIp); }, []);

  // Fullscreen status on the start screen (Esc or a permission picker can drop it at any time).
  useEffect(() => {
    if (phase !== 'instructions') return;
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    onChange();
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [phase]);

  const exitFullscreenIfActive = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);

  const reportViolation = useCallback(
    async (type: TestViolationType, detail?: string) => {
      if (phaseRef.current !== 'in_progress' || !attemptIdRef.current) return;
      try {
        const result = await logViolationMutation.mutateAsync({ attemptId: attemptIdRef.current, payload: { type, detail } });
        setViolationBanner({ type, count: result.violationCount, limit: result.limit, detail });
        setFullscreenExits({ used: result.fullscreenExitsUsed, allowed: result.allowedFullscreenExits });
        if (result.autoSubmitted) {
          setTerminationReason(result.terminationReason ?? '');
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

    const reportExtension = (id: string, detail: string) => {
      if (extensionsReportedRef.current.has(id)) return;
      extensionsReportedRef.current.add(id);
      reportViolationRef.current('extension_detected', detail);
    };

    // One switch away fires both `blur` and `visibilitychange` — log it once. Blur is checked
    // a beat later: if the page is hidden by then it was a tab switch, already logged as such.
    let blurTimer: ReturnType<typeof setTimeout> | undefined;
    const onVisibilityChange = () => { if (document.hidden) reportViolationRef.current('tab_switch'); };
    const onBlur = () => {
      clearTimeout(blurTimer);
      blurTimer = setTimeout(() => { if (!document.hidden) reportViolationRef.current('window_blur'); }, 250);
    };
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        reportViolationRef.current('fullscreen_exit');
        setFullscreenLost(true);
      } else {
        setFullscreenLost(false);
      }
    };
    const onCopyCutPaste = (e: ClipboardEvent) => { e.preventDefault(); reportViolationRef.current('copy_paste', `${e.type} blocked`); };
    const onContextMenu = (e: MouseEvent) => { e.preventDefault(); reportViolationRef.current('right_click'); };
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      // Block the most common "escape the lockdown" shortcuts outright, not just detect them.
      const devtoolsCombo = e.key === 'F12' || (mod && e.shiftKey && ['i', 'j', 'c', 'k', 'e'].includes(key)) || (e.metaKey && e.altKey && ['i', 'j', 'c'].includes(key));
      if (devtoolsCombo) {
        e.preventDefault();
        reportViolationRef.current('devtools', `Shortcut ${e.key} blocked`);
        return;
      }
      if (mod && ['c', 'v', 'x', 'u', 'p', 's'].includes(key)) {
        e.preventDefault();
        if (['c', 'v', 'x'].includes(key)) reportViolationRef.current('copy_paste', `Ctrl+${key.toUpperCase()} blocked`);
      }
    };
    // Print Screen can't be cancelled, but the clipboard it fills can be wiped right after.
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        navigator.clipboard?.writeText('').catch(() => {});
        reportViolationRef.current('copy_paste', 'Screenshot key pressed');
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('copy', onCopyCutPaste, true);
    document.addEventListener('cut', onCopyCutPaste, true);
    document.addEventListener('paste', onCopyCutPaste, true);
    document.addEventListener('contextmenu', onContextMenu, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('beforeunload', onBeforeUnload);

    const devtoolsInterval = setInterval(() => {
      const isOpen = window.outerWidth - window.innerWidth > DEVTOOLS_THRESHOLD || window.outerHeight - window.innerHeight > DEVTOOLS_THRESHOLD;
      if (isOpen && !devtoolsOpenRef.current) {
        devtoolsOpenRef.current = true;
        reportViolationRef.current('devtools', 'DevTools or a browser side panel was opened');
      } else if (!isOpen) {
        devtoolsOpenRef.current = false;
      }
    }, 1500);

    // Ad-block bait element — see checkAdBlockBait for how this is read.
    ensureAdBlockBait();

    // Plugging in a second screen mid-test (Chrome fires `change` on window.screen).
    const onScreenChange = () => { if (screenIsExtended()) reportViolationRef.current('multiple_screens'); };
    (window.screen as Screen & EventTarget).addEventListener?.('change', onScreenChange);

    const runExtensionChecks = () => {
      for (const check of EXTENSION_CHECKS) {
        if (!extensionsReportedRef.current.has(check.id) && check.test()) reportExtension(check.id, check.detail);
      }
      if (checkAdBlockBait()) reportExtension('adblock', 'Ad-blocking or content-blocking extension detected');
      if (screenIsExtended() && !extensionsReportedRef.current.has('multiple-screens')) {
        extensionsReportedRef.current.add('multiple-screens');
        reportViolationRef.current('multiple_screens');
      }
      const resource = findExtensionResource();
      if (resource) reportExtension('extension-resource', `Extension resource loaded: ${resource.slice(0, 120)}`);
      for (const node of [...Array.from(document.documentElement.children), ...Array.from(document.body.children)]) {
        const what = looksInjected(node);
        if (what) reportExtension(`injected:${what}`, `Extension-injected element ${what.slice(0, 120)}`);
      }
    };
    runExtensionChecks();
    const extensionInterval = setInterval(runExtensionChecks, 2000);

    // Anything an extension injects mid-test is caught the moment it lands, not on the next poll.
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          const what = looksInjected(node);
          if (what) reportExtension(`injected:${what}`, `Extension-injected element ${what.slice(0, 120)}`);
        });
      }
    });
    observer.observe(document.documentElement, { childList: true });
    observer.observe(document.body, { childList: true });

    return () => {
      clearTimeout(blurTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('copy', onCopyCutPaste, true);
      document.removeEventListener('cut', onCopyCutPaste, true);
      document.removeEventListener('paste', onCopyCutPaste, true);
      document.removeEventListener('contextmenu', onContextMenu, true);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('beforeunload', onBeforeUnload);
      clearInterval(devtoolsInterval);
      clearInterval(extensionInterval);
      observer.disconnect();
      (window.screen as Screen & EventTarget).removeEventListener?.('change', onScreenChange);
    };
    // Deliberately just `phase` — see reportViolationRef above for why reportViolation itself
    // must not be a dependency here.
  }, [phase]);

  // This tab's test session — the server refuses any other window/device for the same attempt.
  useEffect(() => {
    if (assignmentId) setAttemptSession(tabSessionId(assignmentId));
  }, [assignmentId]);

  // Start-screen system check: re-scanned every few seconds, since extensions often inject late
  // and a candidate may be disabling them while this screen is open.
  useEffect(() => {
    if (phase !== 'instructions') return;
    const scan = () => setEnvProblems(scanEnvironment());
    scan();
    const id = setInterval(scan, 3000);
    return () => clearInterval(id);
  }, [phase]);

  // Heartbeat: keeps this session's lock alive, and learns if the attempt was ended elsewhere
  // (staff, timeout) or taken over by another window — in which case this one stops.
  useEffect(() => {
    if (phase !== 'in_progress') return;
    const beat = async () => {
      if (!attemptIdRef.current) return;
      try {
        const res = await testsApi.heartbeat(attemptIdRef.current);
        if (res.status === 'submitted') {
          setTerminationReason(res.terminationReason ?? '');
          setPhase(res.autoSubmitted ? 'auto_submitted' : 'submitted');
          stopMediaStreams();
          exitFullscreenIfActive();
        }
      } catch (err) {
        if (isAxiosError(err) && err.response?.status === 409) {
          setPhase('disconnected');
          stopMediaStreams();
          exitFullscreenIfActive();
        }
      }
    };
    const id = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [phase, stopMediaStreams, exitFullscreenIfActive]);

  // ── Countdown timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'in_progress' || secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [phase, secondsLeft]);

  useEffect(() => {
    if (phase === 'in_progress' && secondsLeft === 0 && session) {
      handleFinalSubmit(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, phase]);

  // Release the camera/screen-share and fullscreen if the candidate navigates away mid-test.
  useEffect(() => () => { stopMediaStreams(); exitFullscreenIfActive(); }, [stopMediaStreams, exitFullscreenIfActive]);

  // Best-effort telemetry: tells the result-analysis screen "Skipped" (seen, left blank) apart
  // from "Not Viewed" (never reached). Fire-and-forget — never blocks the exam UI.
  useEffect(() => {
    if (phase !== 'in_progress' || !attemptIdRef.current) return;
    markViewedMutation.mutate({ attemptId: attemptIdRef.current, payload: { questionIndex: currentIndex } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentIndex]);

  async function handleStart() {
    if (!assignmentId) return;
    setError('');
    setCameraError('');
    setScreenShareError('');
    setFullscreenLost(false);

    if (!accessCode.trim()) {
      setError('Enter the access code from your notification to continue.');
      return;
    }

    const problems = scanEnvironment();
    setEnvProblems(problems);
    if (problems.length) {
      setError('Fix the system check problems before starting.');
      return;
    }
    if (!cameraReady || !streamRef.current) {
      setCameraError('Enable your camera first.');
      return;
    }
    if (!screenReady || !screenStreamRef.current) {
      setScreenShareError('Share your entire screen first.');
      return;
    }
    // Start is itself a user gesture, so fullscreen can be (re)entered right here if a picker or
    // Esc dropped it after the candidate switched it on.
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        setError('Fullscreen mode is required to start this test — click "Enter Fullscreen" and try again.');
        return;
      }
    }
    await lookupClientIp();

    try {
      const result = await startTest.mutateAsync({ assignmentId, payload: { accessCode: accessCode.trim() } });
      setSession(result);
      attemptIdRef.current = result.attempt._id;
      setFullscreenExits({ used: result.fullscreenExitsUsed, allowed: result.allowedFullscreenExits });
      // Resuming restores everything — MCQ picks, written answers, code, language and the last
      // code submission — not just the MCQ/text answers.
      const existingAnswers: Record<number, LocalAnswer> = {};
      for (const a of result.attempt.answers) {
        existingAnswers[a.questionIndex] = { selectedOption: a.selectedOption, answerText: a.answerText, code: a.code, language: a.language, submission: a.submission };
      }
      setAnswers(existingAnswers);

      // Remaining time is derived from startedAt + durationMinutes, not reset to full duration
      // on reload — a candidate reopening the tab (or triggering a fullscreen-exit violation
      // that they then resume from) doesn't get extra time for free.
      const startedAtMs = new Date(result.attempt.startedAt).getTime();
      const serverNowMs = new Date(result.serverTime).getTime();
      const elapsedSeconds = Math.max(0, Math.floor((serverNowMs - startedAtMs) / 1000));
      const totalSeconds = result.durationMinutes * 60;
      setSecondsLeft(Math.max(0, totalSeconds - elapsedSeconds));
      // Belt-and-suspenders: if fullscreen somehow isn't actually active the moment the test
      // starts (a browser quirk, or it got dropped between the request above and now), show the
      // same recovery overlay immediately instead of silently running windowed.
      if (!document.fullscreenElement) setFullscreenLost(true);
      setPhase('in_progress');
    } catch (err) {
      // Keep camera, screen share and fullscreen on — a mistyped code shouldn't mean redoing setup.
      setError(extractErrorMessage(err));
    }
  }

  async function enableCamera() {
    setCameraError('');
    setEnabling('camera');
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        setCameraReady(false);
        reportViolationRef.current('no_face', 'Camera stream ended');
      });
      setCameraReady(true);
    } catch {
      setCameraError('Camera access was blocked. Allow camera permission in your browser (lock icon in the address bar) and try again.');
    } finally {
      setEnabling('');
    }
  }

  async function enableScreenShare() {
    setScreenShareError('');
    setEnabling('screen');
    try {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      // Screen sharing is required for the full test duration — only the entire screen shows side
      // panels, popups and other windows, so a tab or window share is refused.
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'monitor' } } as DisplayMediaStreamOptions);
      const surface = (screenStream.getVideoTracks()[0]?.getSettings() as MediaTrackSettings & { displaySurface?: string }).displaySurface;
      if (surface && surface !== 'monitor') {
        screenStream.getTracks().forEach((t) => t.stop());
        throw new Error('not-monitor');
      }
      screenStreamRef.current = screenStream;
      screenStream.getVideoTracks()[0]?.addEventListener('ended', () => {
        setScreenReady(false);
        reportViolationRef.current('screen_share_stopped', 'Screen-share stream ended');
      });
      setScreenReady(true);
    } catch {
      setScreenShareError('You must share your ENTIRE SCREEN (not a tab or window). Please try again.');
    } finally {
      setEnabling('');
    }
  }

  async function enableFullscreen() {
    setError('');
    setEnabling('fullscreen');
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      setError('Your browser blocked fullscreen. Please allow it and click "Enter Fullscreen" again.');
    } finally {
      setEnabling('');
    }
  }

  function answerFor(index: number): LocalAnswer {
    return answers[index] ?? {};
  }

  function saveAnswer(index: number, patch: AnswerPatch) {
    if (attemptIdRef.current) submitAnswerMutation.mutate({ attemptId: attemptIdRef.current, payload: { questionIndex: index, ...patch } });
  }

  function setAnswer(index: number, patch: AnswerPatch) {
    let merged: LocalAnswer = {};
    setAnswers((prev) => {
      merged = { ...prev[index], ...patch };
      return { ...prev, [index]: merged };
    });
    if (patch.code !== undefined && patch.selectedOption === undefined && patch.answerText === undefined) {
      // Code: debounce, and always save code + language together.
      clearTimeout(codeSaveTimersRef.current[index]);
      codeSaveTimersRef.current[index] = setTimeout(() => saveAnswer(index, { code: merged.code, language: merged.language }), CODE_AUTOSAVE_MS);
      return;
    }
    saveAnswer(index, patch);
  }

  // Flush pending debounced code saves — before the final submit, so the server scores the
  // code the candidate actually sees.
  async function flushCodeSaves() {
    const pending = Object.entries(codeSaveTimersRef.current);
    codeSaveTimersRef.current = {};
    await Promise.all(
      pending.map(async ([i, timer]) => {
        clearTimeout(timer);
        const a = answers[Number(i)];
        if (a?.code !== undefined && attemptIdRef.current) {
          await submitAnswerMutation.mutateAsync({ attemptId: attemptIdRef.current, payload: { questionIndex: Number(i), code: a.code, language: a.language } }).catch(() => {});
        }
      })
    );
  }

  function handleResumeFullscreen() {
    document.documentElement.requestFullscreen().catch(() => {});
  }

  const questions: TestQuestionForCandidate[] = session?.questions ?? [];
  const sections = session?.sections?.length ? session.sections : [{ title: 'Questions' }];
  const sectionOf = (i: number) => Math.min(questions[i]?.sectionIndex ?? 0, sections.length - 1);
  const questionsBySection = useMemo(
    () => sections.map((_, si) => questions.map((_, i) => i).filter((i) => Math.min(questions[i]?.sectionIndex ?? 0, sections.length - 1) === si)),
    [questions, sections]
  );

  async function handleFinalSubmit(skipConfirm: boolean) {
    if (!attemptIdRef.current) return;
    if (!skipConfirm) {
      const unanswered = questions.filter((q, i) => q.questionType !== 'coding' && !isAnswered(q, answers[i])).length;
      const unsubmittedCode = questions.filter((q, i) => q.questionType === 'coding' && (!answers[i]?.submission || answers[i]?.submission?.code !== answers[i]?.code)).length;
      const notes = [
        unanswered ? `${unanswered} question(s) unanswered` : '',
        unsubmittedCode ? `${unsubmittedCode} coding problem(s) with code not submitted (they'll be judged automatically)` : '',
      ].filter(Boolean);
      if (!window.confirm(`Submit the test now? You can't change your answers afterwards.${notes.length ? `\n\n• ${notes.join('\n• ')}` : ''}`)) return;
    }
    try {
      await flushCodeSaves();
      const result = await submitTestMutation.mutateAsync(attemptIdRef.current);
      setFinalScore(result.score);
      setPhase('submitted');
      stopMediaStreams();
      exitFullscreenIfActive();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  const question = questions[currentIndex];
  const currentSection = sectionOf(currentIndex);
  const sectionQuestions = questionsBySection[currentSection] ?? [];
  const positionInSection = sectionQuestions.indexOf(currentIndex);
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  if (phase === 'disconnected') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-10 max-w-md text-center">
          <Unplug className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">This window was disconnected</h1>
          <p className="text-sm text-gray-500">Your test is open in another window or device. Only one session can run a test at a time — this has been logged.</p>
          <button onClick={() => navigate('/candidate/tests')} className={`mt-6 h-10 px-5 rounded-xl text-sm font-semibold ${PRIMARY_BTN}`}>Back to Tests</button>
        </div>
      </div>
    );
  }

  if (phase === 'submitted' || phase === 'auto_submitted') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-10 max-w-md text-center">
          {phase === 'auto_submitted' ? (
            <>
              <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h1 className="text-xl font-bold text-gray-900 mb-2">Test ended</h1>
              <p className="text-sm text-gray-500">{terminationReason ? `Reason: ${terminationReason}.` : 'A proctoring rule was broken.'} Your answers so far have been submitted automatically.</p>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h1 className="text-xl font-bold text-gray-900 mb-2">Test submitted</h1>
              {finalScore !== undefined && <p className="text-sm text-gray-500">Auto-graded score: <span className="text-gray-900 font-semibold">{finalScore}</span></p>}
            </>
          )}
          <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
            <button onClick={() => navigate(`/candidate/tests/${assignmentId}/result`)} className={`inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl text-sm font-semibold ${PRIMARY_BTN}`}>
              <BarChart3 className="w-4 h-4" /> View Result &amp; Analysis
            </button>
            <button onClick={() => navigate('/candidate/tests')} className="h-10 px-5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50">
              Back to Tests
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'instructions') {
    const testInstructions = listing?.instructions?.split('\n').map((l) => l.trim()).filter(Boolean) ?? [];
    const setupDone = cameraReady && screenReady && isFullscreen;
    const canStart = setupDone && agreed && !!accessCode.trim() && envProblems.length === 0 && !startTest.isPending;
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="flex items-center justify-between gap-4 px-6 py-3.5 bg-white border-b border-gray-100">
          <div className="flex items-center gap-2.5 min-w-0">
            <ShieldAlert className="w-5 h-5 text-orange-500 shrink-0" />
            <span className="text-base font-semibold text-gray-900 truncate">{listing?.title ?? 'Proctored Test'}</span>
          </div>
          <button onClick={() => { stopMediaStreams(); exitFullscreenIfActive(); navigate('/candidate/tests'); }} className="text-sm text-gray-500 hover:text-gray-800">
            Exit
          </button>
        </header>

        <div className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px] items-start">
          {/* ── Left: everything about the test ── */}
          <div className="space-y-5 min-w-0">
            <section className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6">
              <h1 className="text-xl font-bold text-gray-900">{listing?.title ?? 'Before you start'}</h1>
              {listing?.description && <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{listing.description}</p>}
              {listing && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                  <DetailTile icon={Clock} label="Duration" value={`${listing.durationMinutes} min`} />
                  <DetailTile icon={FileQuestion} label="Questions" value={`${listing.questionCount} · ${listing.totalMarks} marks`} />
                  <DetailTile icon={Layers} label="Sections" value={String(listing.sectionCount)} />
                  <DetailTile icon={ShieldAlert} label="Violations allowed" value={String(listing.violationLimit)} />
                </div>
              )}
            </section>

            <section className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3"><Info className="w-4 h-4 text-violet-500" /> Instructions</h2>
              {testInstructions.length > 0 ? (
                <ol className="list-decimal pl-5 space-y-1.5">
                  {testInstructions.map((line) => <li key={line} className="text-sm text-gray-600">{line}</li>)}
                </ol>
              ) : (
                <ol className="list-decimal pl-5 space-y-1.5 text-sm text-gray-600">
                  <li>Read every question carefully; you can move freely between questions and sections.</li>
                  <li>Your answers are saved automatically as you go.</li>
                  <li>The timer starts when you click Start Test and does not pause.</li>
                  <li>The test is submitted automatically when time runs out.</li>
                </ol>
              )}
            </section>

            <section className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3"><ShieldAlert className="w-4 h-4 text-orange-500" /> Proctoring rules</h2>
              <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
                {[
                  'Switching tabs or windows is logged',
                  'Copy, paste, right-click and screenshots are blocked and logged',
                  'Your camera must stay on, and your ENTIRE screen stay shared, for the full test',
                  'No browser extensions or second screens — detecting one ends your test immediately',
                  'Leaving fullscreen pauses the test; leaving it again ends your test',
                  'The test can only be open in one window/device at a time, and your IP address is logged',
                  'Questions within each section appear in an order unique to you',
                  'A watermark with your candidate ID and a live timestamp is shown on screen throughout',
                  'Exceeding the violation limit auto-submits your test immediately',
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2.5 text-sm text-gray-600">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    {line}
                  </li>
                ))}
              </ul>
            </section>

            <section className={`rounded-2xl border px-5 py-4 ${envProblems.length ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
              <p className={`text-sm font-semibold flex items-center gap-2 ${envProblems.length ? 'text-red-700' : 'text-green-700'}`}>
                {envProblems.length ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                {envProblems.length ? 'System check failed — fix these to start' : 'System check passed'}
              </p>
              {envProblems.length > 0 && (
                <>
                  <ul className="mt-2 space-y-1">
                    {envProblems.map((p) => <li key={p.id} className="text-xs text-red-700">• {p.detail}</li>)}
                  </ul>
                  <p className="mt-2 text-xs text-red-600">Disable or remove every browser extension (or use a fresh Chrome profile / Guest window), disconnect extra monitors, then wait a few seconds — this re-checks automatically.</p>
                </>
              )}
              <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500"><Globe className="w-3.5 h-3.5" /> Your IP address: <span className="font-medium text-gray-700">{clientIp || 'detecting…'}</span></p>
            </section>
          </div>

          {/* ── Right: setup, access code and start ── */}
          <aside className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6 lg:sticky lg:top-6 space-y-5">
            <div>
              <h2 className="text-base font-bold text-gray-900">Get ready</h2>
              <p className="text-xs text-gray-500 mt-0.5">Complete each step, then enter your access code to begin.</p>
            </div>

            <div className="space-y-2.5">
              <SetupStep n={1} icon={Camera} title="Camera" done={cameraReady} busy={enabling === 'camera'} actionLabel={cameraReady ? 'Re-enable' : 'Enable Camera'} onAction={enableCamera} error={cameraError} />
              {cameraReady && (
                <video ref={previewVideoRef} autoPlay muted playsInline className="w-full aspect-video rounded-xl bg-black object-cover border border-gray-200" />
              )}
              <SetupStep n={2} icon={MonitorUp} title="Screen share (entire screen)" done={screenReady} busy={enabling === 'screen'} actionLabel={screenReady ? 'Re-share' : 'Share Screen'} onAction={enableScreenShare} error={screenShareError} />
              <SetupStep n={3} icon={Maximize} title="Fullscreen" done={isFullscreen} busy={enabling === 'fullscreen'} actionLabel="Enter Fullscreen" onAction={enableFullscreen} hideActionWhenDone />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1.5"><KeyRound className="w-3.5 h-3.5" /> Access code (from your notification)</label>
              <input
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && canStart) handleStart(); }}
                placeholder="e.g. K7XPQ2"
                autoCapitalize="characters"
                className="w-full h-12 px-4 rounded-xl bg-white border border-gray-200 text-base font-semibold text-gray-900 tracking-[0.3em] placeholder:tracking-normal placeholder:font-normal placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
              />
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 accent-orange-500" />
              <span className="text-sm text-gray-600">I have read the instructions and agree to be proctored for the duration of this test.</span>
            </label>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              onClick={handleStart}
              disabled={!canStart}
              className={`w-full inline-flex items-center justify-center gap-2 h-12 rounded-xl text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed ${PRIMARY_BTN}`}
            >
              {startTest.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Start Test
            </button>
            {!setupDone && <p className="text-xs text-center text-gray-400">Finish steps 1–3 to unlock Start Test.</p>}
          </aside>
        </div>
      </div>
    );
  }

  const isCoding = question?.questionType === 'coding';
  const sampleCases = question?.testCases?.filter((tc) => !tc.hidden) ?? [];
  const isLast = currentIndex === questions.length - 1;

  // Candidate-specific watermark — tiled across the whole screen, low-opacity and
  // unselectable, so any screenshot or photo of the test carries who took it and when.
  // Rendered inline (no separate clock state) since the countdown timer already forces a
  // re-render every second while the test is in progress, keeping the timestamp live.
  const watermarkLabel = `${session?.attempt.candidateId.slice(-8).toUpperCase() ?? ''} · ${new Date().toLocaleString()}`;

  return (
    <div className="h-screen bg-gray-50 text-gray-900 flex flex-col select-none relative overflow-hidden" onDragStart={(e) => e.preventDefault()}>
      <div className="fixed inset-0 z-30 pointer-events-none select-none overflow-hidden">
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-x-10 gap-y-20 -rotate-[20deg] opacity-[0.06] absolute -inset-32">
          {Array.from({ length: 40 }).map((_, i) => (
            <span key={i} className="text-xs font-semibold text-gray-900 whitespace-nowrap">
              {watermarkLabel}
            </span>
          ))}
        </div>
      </div>

      {fullscreenLost && (
        // Fully opaque: while out of fullscreen the candidate is out of the test — nothing of the
        // paper is visible or reachable until fullscreen is back.
        <div className="fixed inset-0 z-[60] bg-gray-900 flex items-center justify-center p-6">
          <div className="bg-white shadow-lg rounded-2xl p-8 max-w-sm text-center">
            <ShieldAlert className="w-10 h-10 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-gray-900 mb-2">Test paused — you left fullscreen</h2>
            <p className="text-sm text-gray-500 mb-3">This has been logged. Your timer keeps running. Re-enter fullscreen to continue.</p>
            <p className="text-sm font-semibold text-red-600 mb-6">
              Fullscreen exits: {fullscreenExits.used} of {fullscreenExits.allowed} allowed — leaving fullscreen again will end your test.
            </p>
            <button onClick={handleResumeFullscreen} className={`w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-bold ${PRIMARY_BTN}`}>
              <Maximize className="w-4 h-4" /> Resume in Fullscreen
            </button>
          </div>
        </div>
      )}

      <header className="flex items-center justify-between gap-4 px-6 py-3 bg-white border-b border-gray-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <ShieldAlert className="w-4 h-4 text-orange-500 shrink-0" />
          <span className="text-sm font-semibold truncate">{session?.title ?? 'Proctored Test'}</span>
        </div>
        <div className={`font-mono text-lg font-bold tabular-nums flex items-center gap-1.5 ${secondsLeft < 300 ? 'text-red-500' : 'text-gray-900'}`}>
          <Clock className="w-4 h-4" />
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>
        <div className="flex items-center gap-3">
          <video ref={videoRef} autoPlay muted playsInline className="w-14 h-10 rounded-lg border border-gray-200 object-cover bg-black" />
          <button
            onClick={() => handleFinalSubmit(false)}
            disabled={submitTestMutation.isPending || fullscreenLost}
            className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-bold disabled:opacity-50 ${PRIMARY_BTN}`}
          >
            {submitTestMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit Test
          </button>
        </div>
      </header>

      {/* ── Section tabs ── */}
      <nav className="flex items-center gap-1 px-6 bg-white border-b border-gray-100 overflow-x-auto">
        {sections.map((s, si) => {
          const idxs = questionsBySection[si] ?? [];
          const done = idxs.filter((i) => isAnswered(questions[i], answers[i])).length;
          return (
            <button
              key={si}
              onClick={() => idxs.length && setCurrentIndex(idxs[0])}
              disabled={fullscreenLost}
              className={`shrink-0 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${si === currentSection ? 'border-orange-500 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              {s.title} <span className="ml-1 text-xs font-medium text-gray-400">{done}/{idxs.length}</span>
            </button>
          );
        })}
      </nav>

      {violationBanner && (
        <div className="bg-red-50 border-b border-red-100 px-6 py-2 flex items-center justify-between text-sm">
          <span className="text-red-600 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {VIOLATION_LABEL[violationBanner.type]}{violationBanner.detail ? ` (${violationBanner.detail})` : ''} — violation {violationBanner.count} of {violationBanner.limit} allowed
          </span>
          <button onClick={() => setViolationBanner(null)} className="text-red-500 hover:text-red-700">Dismiss</button>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {/* ── Question palette for this section ── */}
        <aside className="hidden md:flex flex-col w-52 shrink-0 bg-white border-r border-gray-100 p-4 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-900 mb-1">{sections[currentSection]?.title}</p>
          {sections[currentSection]?.description && <p className="text-[11px] text-gray-400 mb-3">{sections[currentSection].description}</p>}
          <div className="grid grid-cols-4 gap-2">
            {sectionQuestions.map((qi, n) => (
              <button
                key={qi}
                onClick={() => setCurrentIndex(qi)}
                disabled={fullscreenLost}
                className={`w-9 h-9 rounded-lg text-xs font-semibold transition-colors ${
                  qi === currentIndex ? 'bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 text-white' : isAnswered(questions[qi], answers[qi]) ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-50 text-gray-500 border border-gray-200'
                }`}
              >
                {n + 1}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-1.5 text-[11px] text-gray-400">
            <p className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-50 border border-green-200" /> Answered / code submitted</p>
            <p className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gray-50 border border-gray-200" /> Not answered</p>
          </div>
        </aside>

        <main className="flex-1 min-w-0 flex flex-col px-6 py-5 overflow-y-auto relative">

          <div className="relative z-10 flex items-center justify-between mb-4">
            <span className="text-sm text-gray-500">
              {sections[currentSection]?.title} · Question {positionInSection + 1} of {sectionQuestions.length}
            </span>
            <span className="text-sm text-gray-500">{question?.marks} mark{question?.marks === 1 ? '' : 's'}</span>
          </div>

          {question && isCoding ? (
            <div className="relative z-10 grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 flex-1 min-h-0">
              <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6 xl:overflow-y-auto">
                <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">{question.questionText}</p>
                {sampleCases.length > 0 && (
                  <div className="mt-5 space-y-3">
                    {sampleCases.map((tc, i) => (
                      <div key={i} className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-xs">
                        <p className="font-semibold text-gray-700 mb-1.5">Sample {i + 1}</p>
                        <p className="text-gray-400 mb-0.5">Input</p>
                        <pre className="font-mono text-gray-900 whitespace-pre-wrap mb-2">{tc.input || '(none)'}</pre>
                        <p className="text-gray-400 mb-0.5">Output</p>
                        <pre className="font-mono text-gray-900 whitespace-pre-wrap">{tc.expectedOutput}</pre>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-4 text-[11px] text-gray-400">Languages: {(question.allowedLanguages ?? []).join(', ')}</p>
              </div>
              <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 min-w-0">
                <CodingQuestionPanel
                  attemptId={attemptIdRef.current}
                  questionIndex={currentIndex}
                  question={question}
                  code={answerFor(currentIndex).code ?? question.starterCode?.[answerFor(currentIndex).language ?? question.allowedLanguages?.[0] ?? 'python'] ?? DEFAULT_STARTER[answerFor(currentIndex).language ?? question.allowedLanguages?.[0] ?? 'python']}
                  language={answerFor(currentIndex).language ?? question.allowedLanguages?.[0] ?? 'python'}
                  submission={answerFor(currentIndex).submission}
                  onChange={(patch) => setAnswer(currentIndex, patch)}
                  onSubmitted={(submission) => setAnswers((prev) => ({ ...prev, [currentIndex]: { ...prev[currentIndex], submission } }))}
                  disabled={fullscreenLost}
                />
              </div>
            </div>
          ) : question && (
            <div className="relative z-10 bg-white border border-gray-100 shadow-sm rounded-2xl p-6 max-w-3xl w-full">
              <p className="text-base text-gray-900 mb-6 whitespace-pre-wrap">{question.questionText}</p>

              {question.questionType === 'mcq' ? (
                <div className="space-y-2.5">
                  {(question.options ?? []).map((opt, i) => (
                    <label key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${answerFor(currentIndex).selectedOption === opt ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'} ${fullscreenLost ? 'opacity-50 pointer-events-none' : ''}`}>
                      <input type="radio" name={`q-${currentIndex}`} checked={answerFor(currentIndex).selectedOption === opt} onChange={() => setAnswer(currentIndex, { selectedOption: opt })} disabled={fullscreenLost} className="accent-orange-500" />
                      <span className="text-sm text-gray-700"><span className="font-semibold text-gray-400 mr-2">{String.fromCharCode(65 + i)}.</span>{opt}</span>
                    </label>
                  ))}
                  {answerFor(currentIndex).selectedOption && (
                    <button onClick={() => setAnswer(currentIndex, { selectedOption: '' })} disabled={fullscreenLost} className="text-xs text-gray-400 hover:text-gray-600">Clear response</button>
                  )}
                </div>
              ) : (
                <textarea
                  value={answerFor(currentIndex).answerText ?? ''}
                  onChange={(e) => setAnswer(currentIndex, { answerText: e.target.value })}
                  rows={6}
                  disabled={fullscreenLost}
                  placeholder="Type your answer…"
                  className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 disabled:opacity-50"
                />
              )}
            </div>
          )}

          <div className="relative z-10 flex items-center justify-between mt-5">
            <button
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0 || fullscreenLost}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>

            {isLast ? (
              <button
                onClick={() => handleFinalSubmit(false)}
                disabled={submitTestMutation.isPending || fullscreenLost}
                className={`inline-flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-bold disabled:opacity-50 ${PRIMARY_BTN}`}
              >
                {submitTestMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Submit Test
              </button>
            ) : (
              <button
                onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
                disabled={fullscreenLost}
                className={`inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold disabled:opacity-50 ${PRIMARY_BTN}`}
              >
                {sectionOf(currentIndex + 1) !== currentSection ? `Next: ${sections[sectionOf(currentIndex + 1)]?.title}` : 'Next'} <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Small screens have no side palette — show this section's numbers inline. */}
          <div className="relative z-10 flex md:hidden flex-wrap gap-2 mt-5">
            {sectionQuestions.map((qi, n) => (
              <button
                key={qi}
                onClick={() => setCurrentIndex(qi)}
                className={`w-8 h-8 rounded-lg text-xs font-semibold ${qi === currentIndex ? 'bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 text-white' : isAnswered(questions[qi], answers[qi]) ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}
              >
                {n + 1}
              </button>
            ))}
          </div>
          {error && <p className="relative z-10 mt-3 text-sm text-red-600">{error}</p>}
        </main>
      </div>

      <footer className="px-6 py-2 bg-white border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400">
        <Camera className="w-3.5 h-3.5" />
        <MonitorUp className="w-3.5 h-3.5" />
        Camera &amp; screen share active · Fullscreen enforced · Copy/paste blocked · Extensions monitored · All activity is logged
      </footer>
    </div>
  );
}

function DetailTile({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-100 px-3.5 py-3">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-gray-400"><Icon className="w-3.5 h-3.5" /> {label}</p>
      <p className="text-sm font-semibold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

function SetupStep({ n, icon: Icon, title, done, busy, actionLabel, onAction, error, hideActionWhenDone }: {
  n: number; icon: typeof Clock; title: string; done: boolean; busy: boolean; actionLabel: string; onAction: () => void; error?: string; hideActionWhenDone?: boolean;
}) {
  return (
    <div className={`rounded-xl border px-3.5 py-3 ${done ? 'border-green-200 bg-green-50/60' : 'border-gray-200'}`}>
      <div className="flex items-center gap-3">
        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${done ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
          {done ? <CheckCircle2 className="w-4 h-4" /> : n}
        </span>
        <div className="flex-1 min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900"><Icon className="w-4 h-4 text-gray-400" /> {title}</p>
          <p className={`text-xs ${done ? 'text-green-700' : 'text-gray-400'}`}>{done ? 'Enabled' : 'Not enabled'}</p>
        </div>
        {!(done && hideActionWhenDone) && (
          <button
            onClick={onAction}
            disabled={busy}
            className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold disabled:opacity-60 ${done ? 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50' : PRIMARY_BTN}`}
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {actionLabel}
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
