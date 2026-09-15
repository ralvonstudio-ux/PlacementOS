import { Home, BookOpen, History, CalendarClock, MessageSquare } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { cn } from '@/lib/utils';

/** Mobile-only tab bar that replaces the sidebar drawer for the faculty portal —
 *  the five destinations a trainer reaches for most, always one tap away instead
 *  of behind a hamburger menu. Renders nothing for other roles or on desktop
 *  (the sidebar still owns navigation there). */
const FACULTY_TABS = [
  { label: 'Home', icon: Home, path: '/faculty', end: true },
  { label: 'Classes', icon: BookOpen, path: '/faculty/batches', end: false },
  { label: 'History', icon: History, path: '/faculty/attendance', end: false },
  // No dedicated faculty timetable view exists yet — the day-by-day training
  // plan is the closest schedule-shaped page until one is built.
  { label: 'Timetable', icon: CalendarClock, path: '/faculty/training-plan', end: false },
  { label: 'Messages', icon: MessageSquare, path: '/messages', end: false },
] as const;

export function BottomNav() {
  const { user } = useAuth();
  if (user?.role !== 'faculty') return null;

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-lg border-t border-gray-100 pb-[env(safe-area-inset-bottom)] print:hidden"
      aria-label="Primary"
    >
      <div className="grid grid-cols-5">
        {FACULTY_TABS.map(({ label, icon: Icon, path, end }) => (
          <NavLink
            key={path}
            to={path}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                isActive ? 'text-violet-600' : 'text-gray-400'
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className={cn('flex items-center justify-center w-9 h-9 rounded-xl transition-colors', isActive && 'bg-violet-50')}>
                  <Icon className="w-5 h-5" strokeWidth={isActive ? 2.25 : 2} />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
