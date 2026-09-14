import { LucideIcon, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type AccentColor = 'blue' | 'amber' | 'green' | 'emerald' | 'purple' | 'rose' | 'indigo';

const ACCENT_MAP: Record<
  AccentColor,
  { iconBg: string; iconColor: string; badgeBg: string; arrowHover: string }
> = {
  blue: {
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    badgeBg: 'bg-blue-50 text-blue-700',
    arrowHover: 'group-hover:text-blue-500',
  },
  amber: {
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    badgeBg: 'bg-amber-50 text-amber-700',
    arrowHover: 'group-hover:text-amber-500',
  },
  green: {
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600',
    badgeBg: 'bg-green-50 text-green-700',
    arrowHover: 'group-hover:text-green-500',
  },
  emerald: {
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    badgeBg: 'bg-emerald-50 text-emerald-700',
    arrowHover: 'group-hover:text-emerald-500',
  },
  purple: {
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    badgeBg: 'bg-purple-50 text-purple-700',
    arrowHover: 'group-hover:text-purple-500',
  },
  rose: {
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
    badgeBg: 'bg-rose-50 text-rose-700',
    arrowHover: 'group-hover:text-rose-500',
  },
  indigo: {
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
    badgeBg: 'bg-indigo-50 text-indigo-700',
    arrowHover: 'group-hover:text-indigo-500',
  },
};

interface ActionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  accent?: AccentColor;
  /** Optional badge — e.g. "12 pending" */
  badge?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export const ActionCard = ({
  icon: Icon,
  title,
  description,
  accent = 'blue',
  badge,
  onClick,
  disabled = false,
}: ActionCardProps) => {
  const colors = ACCENT_MAP[accent];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        // Compact icon tile on phones (icon + label only); full description
        // card from `sm` up — big cards ate too much vertical space stacked
        // one-per-row on narrow screens.
        'group relative flex flex-col items-center text-center gap-1 bg-white rounded-2xl p-2 w-full',
        'sm:items-start sm:text-left sm:gap-0 sm:p-6',
        'border border-gray-100 shadow-sm',
        'transition-all duration-200',
        disabled
          ? 'opacity-60 cursor-not-allowed'
          : 'hover:shadow-lg hover:-translate-y-0.5 cursor-pointer active:translate-y-0 active:shadow-md'
      )}
    >
      {badge && (
        <span
          className={cn(
            'sm:hidden absolute top-2 right-2 text-[9px] font-bold leading-none px-1.5 py-1 rounded-full',
            colors.badgeBg
          )}
        >
          {badge}
        </span>
      )}

      {/* Icon */}
      <div
        className={cn(
          'w-8 h-8 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0',
          colors.iconBg
        )}
      >
        <Icon className={cn('w-4 h-4 sm:w-6 sm:h-6', colors.iconColor)} strokeWidth={1.75} />
      </div>

      {/* Content */}
      <div className="sm:mt-5 sm:flex-1 w-full min-w-0">
        <h3 className="text-xs sm:text-[17px] font-semibold text-gray-900 leading-tight line-clamp-2 sm:line-clamp-none">
          {title}
        </h3>
        <p className="hidden sm:block text-sm text-gray-500 mt-1 leading-relaxed">
          {description}
        </p>
      </div>

      {/* Footer — full badge + arrow, desktop only */}
      <div className="hidden sm:flex mt-5 items-center w-full">
        {badge && (
          <span className={cn('text-xs font-medium px-2.5 py-1 rounded-lg', colors.badgeBg)}>
            {badge}
          </span>
        )}
        <ArrowRight
          className={cn(
            'w-4 h-4 ml-auto text-gray-300 transition-colors duration-200',
            colors.arrowHover
          )}
        />
      </div>
    </button>
  );
};
