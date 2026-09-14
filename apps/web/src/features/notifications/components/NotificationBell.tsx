import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, KeyRound } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useMyNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '../hooks/useNotifications';

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useMyNotifications();
  const { mutate: markRead } = useMarkNotificationRead();
  const { mutate: markAllRead } = useMarkAllNotificationsRead();

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Only candidates receive notifications today (test access codes) — nothing to show elsewhere.
  if (user?.role !== 'candidate') return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-8.5 h-8.5 rounded-full bg-white border border-[#E8E8E8] hover:bg-violet-50 hover:border-violet-200 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4 text-gray-500" strokeWidth={1.5} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 max-w-[90vw] bg-white rounded-2xl border border-[#E8E8E8] shadow-[0_16px_48px_rgba(0,0,0,0.14)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <p className="text-sm font-semibold text-gray-900">Notifications</p>
            {unreadCount > 0 && (
              <button onClick={() => markAllRead()} className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700">
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">No notifications yet.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {notifications.map((n) => (
                  <button
                    key={n._id}
                    onClick={() => { if (!n.readAt) markRead(n._id); }}
                    className={`w-full text-left px-4 py-3 transition-colors hover:bg-gray-50 ${!n.readAt ? 'bg-violet-50/50' : ''}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <KeyRound className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 break-words">{n.body}</p>
                        <p className="text-[11px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                      </div>
                      {!n.readAt && <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0 mt-1.5" />}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
