import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, ChevronDown, Clock, Settings, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/hooks/useAuth';

const WORKSPACE_LABELS: Record<string, string> = {
  '/faculty': 'Trainer Workspace',
  '/tpo': 'TPO Dashboard',
  '/candidate': 'Student Portal',
  '/settings': 'Settings',
};

const getLabel = (pathname: string): string => {
  const key = Object.keys(WORKSPACE_LABELS).find((k) => pathname.startsWith(k));
  return key ? WORKSPACE_LABELS[key] : 'PlacementOS';
};

const formatDate = (d: Date): string =>
  d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

const formatTime = (d: Date): string =>
  d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function ProfileMenu({ displayName, roleLabel, onClose }: { displayName: string; roleLabel: string; onClose: () => void }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 bg-white rounded-2xl border border-[#E8E8E8] shadow-[0_16px_48px_rgba(0,0,0,0.14)] overflow-hidden py-1.5"
    >
      <div className="px-4 py-2.5 border-b border-gray-50">
        <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
        <p className="text-xs text-gray-400">{roleLabel}</p>
      </div>
      <button
        type="button"
        onClick={() => {
          onClose();
          navigate('/settings');
        }}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors text-left"
      >
        <Settings className="w-4 h-4 text-gray-400" />
        Settings
      </button>
      <div className="border-t border-gray-50 mt-1 pt-1">
        <button
          type="button"
          onClick={() => {
            onClose();
            void logout();
          }}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors text-left"
        >
          <LogOut className="w-4 h-4" />
          Log Out
        </button>
      </div>
    </div>
  );
}

interface TopbarProps {
  onMenuToggle: () => void;
}

export const Topbar = ({ onMenuToggle }: TopbarProps) => {
  const location = useLocation();
  const { user } = useAuth();

  const ROLE_LABELS: Record<string, string> = { faculty: 'Trainer', tpo: 'TPO', candidate: 'Student' };

  const section = getLabel(location.pathname);
  const now = useNow();
  const date = formatDate(now);
  const time = formatTime(now);

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const initials = user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() : '?';
  const displayName = user ? `${user.firstName} ${user.lastName}` : '';

  return (
    <header className="sticky top-0 z-10 flex h-[60px] items-center border-b px-8 bg-white border-[#E8E8E8]">
      <div className="flex items-center w-full gap-4 max-w-7xl mx-auto">
        <button
          onClick={onMenuToggle}
          className="p-2 -ml-1 rounded-xl transition-colors lg:hidden text-gray-500 hover:bg-violet-50 hover:text-violet-700"
          aria-label="Toggle navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <nav aria-label="breadcrumb" className="flex items-center gap-1.5 shrink-0">
          <span className="text-sm font-semibold text-gray-900">{section}</span>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden lg:flex items-center gap-1.5 h-8.5 px-3.5 rounded-full bg-white border border-[#E8E8E8] text-[12px] font-semibold text-gray-600 select-none tabular-nums">
            <Clock className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.5} />
            {time} IST
          </div>

          <span className="hidden md:flex items-center gap-1.5 h-8.5 px-3.5 rounded-full bg-white border border-[#E8E8E8] text-[12px] font-medium text-gray-500 select-none">
            <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {date}
          </span>

          <div className="relative">
            <button
              onClick={() => setProfileMenuOpen((v) => !v)}
              className={cn(
                'ml-0.5 flex items-center gap-1.5 p-1 rounded-full transition-all duration-200',
                'bg-white border border-[#E8E8E8] hover:bg-violet-50 hover:border-violet-200 shadow-sm'
              )}
              aria-label="Profile"
            >
              <span className="w-7 h-7 rounded-full bg-violet-100 border border-violet-200 flex items-center justify-center text-[11px] font-bold text-violet-700">
                {initials}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden md:block mr-1" />
            </button>
            {profileMenuOpen && (
              <ProfileMenu
                displayName={displayName}
                roleLabel={(user?.role && ROLE_LABELS[user.role]) || 'Staff'}
                onClose={() => setProfileMenuOpen(false)}
              />
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
