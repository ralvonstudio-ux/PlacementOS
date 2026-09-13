import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Sparkles,
  BookOpen,
  FileCheck2,
  Library,
  Settings,
  LogOut,
  X,
  User2,
  Mail,
  CalendarOff,
  FileText,
  MessageSquare,
  Users2,
  Calculator,
  Building2,
  BookMarked,
  ShieldCheck,
  Code2,
  ClipboardCheck,
  CalendarClock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { SidebarNavItem } from './SidebarNavItem';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { getHomePathForRole } from '@/features/auth/utils/roleHome';

const NAV_ITEMS_FACULTY = [
  { label: 'My Dashboard', icon: LayoutDashboard, path: '/faculty', end: true },
  { label: 'Attendance', icon: ClipboardCheck, path: '/faculty/attendance', end: false },
  { label: 'My Batches', icon: BookOpen, path: '/faculty/batches', end: false },
  { label: 'Academic Plan', icon: Sparkles, path: '/faculty/academic-plan', end: false },
  { label: 'Training Plan', icon: CalendarClock, path: '/faculty/training-plan', end: false },
  { label: 'Question Bank', icon: Library, path: '/faculty/question-bank', end: false },
  { label: 'Worksheets', icon: FileCheck2, path: '/faculty/worksheets', end: false },
  { label: 'Tests', icon: ShieldCheck, path: '/faculty/tests', end: false },
  { label: 'Leave Requests', icon: CalendarOff, path: '/faculty/leave-requests', end: false },
  { label: 'My Profile', icon: User2, path: '/faculty/profile', end: false },
] as const;

const NAV_SECTION_TPO_OVERVIEW = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/tpo', end: true },
  { label: 'Attendance', icon: ClipboardCheck, path: '/tpo/attendance', end: false },
  { label: 'Insights', icon: Sparkles, path: '/tpo/insights', end: false },
] as const;

const NAV_SECTION_TPO_APPROVALS = [
  { label: 'Leave Approvals', icon: ClipboardList, path: '/tpo/leave-approvals', end: false },
] as const;

const NAV_SECTION_TPO_ACADEMICS = [
  { label: 'Training Plan', icon: Sparkles, path: '/tpo/training-plan', end: false },
  { label: 'Question Bank Overview', icon: Library, path: '/tpo/question-bank-overview', end: false },
] as const;

const NAV_SECTION_TPO_STAFF = [
  { label: 'Trainers', icon: Users, path: '/tpo/faculty', end: false },
  { label: 'Students', icon: Users2, path: '/tpo/candidates', end: false },
] as const;

const NAV_SECTION_TPO_TESTS = [
  { label: 'Tests', icon: ShieldCheck, path: '/tpo/tests', end: false },
  { label: 'Practice Library', icon: BookMarked, path: '/tpo/practice', end: false },
] as const;

const NAV_SECTIONS_TPO = [
  { title: 'Overview', items: NAV_SECTION_TPO_OVERVIEW },
  { title: 'Approvals', items: NAV_SECTION_TPO_APPROVALS },
  { title: 'Academics', items: NAV_SECTION_TPO_ACADEMICS },
  { title: 'Assessment', items: NAV_SECTION_TPO_TESTS },
  { title: 'Staff & Students', items: NAV_SECTION_TPO_STAFF },
] as const;

const NAV_ITEMS_CANDIDATE = [
  { label: 'My Dashboard', icon: LayoutDashboard, path: '/candidate', end: true },
  { label: 'Resume', icon: FileText, path: '/candidate/resume', end: false },
  { label: 'PI Questions', icon: MessageSquare, path: '/candidate/practice/pi', end: false },
  { label: 'GD Questions', icon: Users2, path: '/candidate/practice/gd', end: false },
  { label: 'Aptitude & Reasoning', icon: Calculator, path: '/candidate/practice/aptitude', end: false },
  { label: 'Company Questions', icon: Building2, path: '/candidate/practice/company', end: false },
  { label: 'Practice Sheets', icon: BookMarked, path: '/candidate/practice-sheets', end: false },
  { label: 'LeetCode Profile', icon: Code2, path: '/candidate/leetcode', end: false },
  { label: 'Tests', icon: ShieldCheck, path: '/candidate/tests', end: false },
] as const;

const ROLE_LABEL: Record<string, string> = {
  faculty: 'Trainer',
  tpo: 'TPO',
  candidate: 'Student',
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  overlayOnDesktop?: boolean;
}

export const Sidebar = ({ isOpen, onClose, overlayOnDesktop }: SidebarProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const initials = user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() : '?';
  const displayName = user ? `${user.firstName} ${user.lastName}` : 'Loading…';
  const roleLabel = user ? (ROLE_LABEL[user.role] ?? user.role) : '';
  const isTpo = user?.role === 'tpo';
  const isCandidate = user?.role === 'candidate';

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-30 flex h-full w-[260px] flex-col',
        'bg-white/98 backdrop-blur-xl border-r border-gray-100/80 shadow-[1px_0_0_0_rgba(0,0,0,0.04),4px_0_16px_0_rgba(0,0,0,0.03)]',
        'transition-transform duration-200 ease-in-out',
        isOpen ? 'translate-x-0' : '-translate-x-full',
        !overlayOnDesktop && 'lg:translate-x-0'
      )}
    >
      <div className="flex items-center justify-between px-5 py-5 border-b border-gray-100/80">
        <button
          type="button"
          onClick={() => navigate(user ? getHomePathForRole(user.role) : '/')}
          className="flex items-center gap-3 text-left"
          title="Go to dashboard"
        >
          <div className="flex-shrink-0 w-9 h-9 flex items-center justify-center shadow-sm rounded-xl overflow-hidden bg-gradient-to-br from-violet-600 to-pink-500 text-white font-bold">
            P
          </div>
          <div>
            <div className="text-sm font-bold leading-tight tracking-tight text-gray-900">PlacementOS</div>
            <div className="text-[11px] font-medium tracking-wide mt-px text-gray-400">Training &amp; Placement Cell</div>
          </div>
        </button>

        <button
          onClick={onClose}
          className={cn(!overlayOnDesktop && 'lg:hidden', 'p-1.5 rounded-lg transition-colors text-gray-400 hover:text-gray-600 hover:bg-gray-100')}
          aria-label="Close sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {isTpo ? (
          <>
            <p className="px-3 pb-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">TPO Portal</p>
            {NAV_SECTIONS_TPO.map((section, idx) => (
              <div key={section.title} className={idx > 0 ? 'pt-4' : undefined}>
                <p className="px-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{section.title}</p>
                {section.items.map((item) => (
                  <SidebarNavItem key={item.path} to={item.path} icon={item.icon} label={item.label} end={item.end} />
                ))}
              </div>
            ))}
          </>
        ) : isCandidate ? (
          <>
            <p className="px-3 pb-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Student Portal</p>
            {NAV_ITEMS_CANDIDATE.map((item) => (
              <SidebarNavItem key={item.path} to={item.path} icon={item.icon} label={item.label} end={item.end} />
            ))}
          </>
        ) : (
          <>
            <p className="px-3 pb-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Trainer Portal</p>
            {NAV_ITEMS_FACULTY.map((item) => (
              <SidebarNavItem key={item.path} to={item.path} icon={item.icon} label={item.label} end={item.end} />
            ))}
          </>
        )}
      </nav>

      <div className="px-3 py-3 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-3 space-y-0.5 border-t border-gray-100/80">
        <SidebarNavItem to="/messages" icon={Mail} label="Messages" />
        <SidebarNavItem to="/settings" icon={Settings} label="Settings" />

        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-default mt-1 transition-colors hover:bg-gray-50">
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm bg-gradient-to-br from-violet-600 to-pink-500 text-white">
              <span className="text-xs font-bold">{initials}</span>
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-[1.5px] border-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate leading-tight text-gray-900">{displayName}</div>
            <div className="text-xs truncate mt-px text-gray-400">{roleLabel}</div>
          </div>
        </div>

        <button
          onClick={() => void logout()}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-gray-500 hover:bg-red-50 hover:text-red-600"
          type="button"
        >
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  );
};
