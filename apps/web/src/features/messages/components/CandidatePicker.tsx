import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { candidatesApi } from '@/features/candidates/api/candidates.api';

interface CandidatePickerProps {
  batch: string;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

/** Checkbox roster for a batch, with a select-all toggle — shared by the "send access code"
 *  and "send message" composers on the Messages page. */
export function CandidatePicker({ batch, selected, onChange }: CandidatePickerProps) {
  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ['messages', 'batch-candidates', batch],
    queryFn: () => candidatesApi.listByBatch(batch),
    enabled: !!batch,
  });

  if (!batch) {
    return <p className="text-sm text-gray-400 py-6 text-center">Pick a batch to see its roster.</p>;
  }
  if (isLoading) {
    return <div className="space-y-2 py-2">{[1, 2, 3].map((i) => <div key={i} className="h-9 bg-gray-100 rounded-lg animate-pulse" />)}</div>;
  }
  if (candidates.length === 0) {
    return <p className="text-sm text-gray-400 py-6 text-center">No active candidates found in this batch.</p>;
  }

  const allSelected = candidates.every((c) => selected.has(c._id));

  function toggleAll() {
    if (allSelected) onChange(new Set());
    else onChange(new Set(candidates.map((c) => c._id)));
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  return (
    <div>
      <label className="flex items-center gap-2 px-1 py-2 text-xs font-semibold text-gray-500 border-b border-gray-100">
        <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded accent-violet-600" />
        <Users className="w-3.5 h-3.5" /> Select all ({candidates.length})
      </label>
      <div className="max-h-56 overflow-y-auto divide-y divide-gray-50">
        {candidates.map((c) => (
          <label key={c._id} className="flex items-center gap-2.5 px-1 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
            <input type="checkbox" checked={selected.has(c._id)} onChange={() => toggleOne(c._id)} className="rounded accent-violet-600" />
            <span className="font-medium">{c.fullName}</span>
            <span className="text-xs text-gray-400">{c.rollNumber}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
