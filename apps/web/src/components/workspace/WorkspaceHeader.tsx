import { ReactNode } from 'react';
import { BackLink } from './BackLink';

interface WorkspaceHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /** When set, renders a "‹ back" link above the title — for pages reached
   *  from a role whose sidebar isn't permanently docked (e.g. principal). */
  backTo?: string;
  backLabel?: string;
}

export const WorkspaceHeader = ({ title, subtitle, action, backTo, backLabel }: WorkspaceHeaderProps) => {
  return (
    <div>
      {backTo && <BackLink to={backTo} label={backLabel ?? 'Back'} />}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8 sm:mb-10">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight leading-tight break-words">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm sm:text-base text-gray-500 mt-1.5 leading-relaxed">{subtitle}</p>
          )}
        </div>
        {action && (
          <div className="sm:ml-6 shrink-0 sm:mt-1">{action}</div>
        )}
      </div>
    </div>
  );
};
