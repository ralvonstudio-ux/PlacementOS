import type { ImportStatus } from '@placementos/types';

const STYLES: Record<ImportStatus, string> = {
  mapping: 'bg-gray-100 text-gray-600',
  processing: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
  rolled_back: 'bg-amber-100 text-amber-700',
};

const LABELS: Record<ImportStatus, string> = {
  mapping: 'Mapping',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  rolled_back: 'Rolled Back',
};

export function ImportStatusBadge({ status }: { status: ImportStatus }) {
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STYLES[status]}`}>{LABELS[status]}</span>;
}
