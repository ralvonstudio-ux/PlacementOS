import type { LeaveStatus } from '@placementos/types';

interface Props {
  status: LeaveStatus;
}

const CONFIG: Record<LeaveStatus, { label: string; classes: string }> = {
  pending: { label: 'Pending', classes: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Approved', classes: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rejected', classes: 'bg-red-100 text-red-800' },
  cancelled: { label: 'Cancelled', classes: 'bg-gray-100 text-gray-600' },
};

export function LeaveStatusBadge({ status }: Props) {
  const cfg = CONFIG[status] ?? { label: status, classes: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-flex items-center rounded-full font-medium text-xs px-2.5 py-1 ${cfg.classes}`}>
      {cfg.label}
    </span>
  );
}
