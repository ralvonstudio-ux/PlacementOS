import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useUnacknowledgedNotifications, useAcknowledgeNotification } from '../hooks/useNotifications';

/** A couple of short, sharp beeps via the Web Audio API — no audio asset needed, and it
 *  works the instant the tab has any user gesture on record (which, on an authenticated
 *  dashboard, it always will by the time a message like this can arrive). */
function playAlertSound() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const beepAt = (startOffset: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startOffset + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startOffset);
      osc.stop(ctx.currentTime + startOffset + 0.32);
    };
    beepAt(0);
    beepAt(0.4);
    setTimeout(() => ctx.close(), 1000);
  } catch {
    // Audio is a nice-to-have here — the blocking overlay itself is what actually matters.
  }
}

/** App-wide, unskippable overlay for 'high' priority staff messages. Mounted once in
 *  AppLayout so it covers every authenticated page regardless of route. Blurs the whole
 *  screen and plays an alert sound the moment a new high-priority message shows up, and
 *  stays up — blocking the dashboard — until the recipient explicitly acknowledges it. */
export function HighPriorityMessageOverlay() {
  const { data: unacknowledged = [] } = useUnacknowledgedNotifications();
  const { mutate: acknowledge, isPending } = useAcknowledgeNotification();
  const seenIds = useRef<Set<string>>(new Set());
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const current = unacknowledged[0];

  useEffect(() => {
    for (const n of unacknowledged) {
      if (!seenIds.current.has(n._id)) {
        seenIds.current.add(n._id);
        playAlertSound();
      }
    }
  }, [unacknowledged]);

  useEffect(() => {
    if (!current) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [current]);

  if (!current) return null;

  const remaining = unacknowledged.length;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-in fade-in"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="high-priority-message-title"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-red-100 overflow-hidden">
        <div className="bg-red-50 px-5 py-4 flex items-center gap-2.5 border-b border-red-100">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <p className="text-sm font-bold text-red-700 uppercase tracking-wide">High-priority message</p>
          {remaining > 1 && (
            <span className="ml-auto text-xs font-semibold text-red-500 bg-red-100 px-2 py-0.5 rounded-full">
              1 of {remaining}
            </span>
          )}
        </div>

        <div className="px-5 py-5">
          <p id="high-priority-message-title" className="text-base font-semibold text-gray-900">{current.title}</p>
          <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap break-words">{current.body}</p>
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={() => { setDismissingId(current._id); acknowledge(current._id, { onSettled: () => setDismissingId(null) }); }}
            disabled={isPending}
            className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-red-600 hover:bg-red-700 text-sm font-semibold text-white transition-colors disabled:opacity-60"
          >
            {isPending && dismissingId === current._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Acknowledge
          </button>
          <p className="text-xs text-gray-400 text-center mt-2">You must acknowledge this to continue.</p>
        </div>
      </div>
    </div>
  );
}
