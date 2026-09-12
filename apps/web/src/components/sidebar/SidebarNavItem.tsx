import { NavLink } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarNavItemProps {
  to: string;
  icon: LucideIcon;
  label: string;
  badge?: number;
  end?: boolean;
}

export const SidebarNavItem = ({ to, icon: Icon, label, badge, end }: SidebarNavItemProps) => {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium border border-transparent',
          'transition-all duration-200',
          isActive
            ? 'bg-gradient-to-r from-violet-600 to-pink-500 text-white font-semibold shadow-sm'
            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn('w-[18px] h-[18px] flex-shrink-0 transition-all duration-200', isActive ? 'text-white' : 'text-gray-400')}
            strokeWidth={isActive ? 2.25 : 1.75}
          />
          <span className={cn('flex-1 leading-none font-medium', isActive && 'font-semibold')}>{label}</span>
          {badge !== undefined && badge > 0 && (
            <span
              className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center transition-colors',
                isActive ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-700'
              )}
            >
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
};
