import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { adminFacultyApi } from '@/features/admin/api/faculty.api';

interface FacultyPickerProps {
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

/** Checkbox roster of all active faculty — the "send message" composer's faculty-audience
 *  counterpart to CandidatePicker. Faculty have no batch to scope by, so this just lists
 *  everyone (up to a generous cap) rather than requiring a filter first. */
export function FacultyPicker({ selected, onChange }: FacultyPickerProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['messages', 'all-faculty'],
    queryFn: () => adminFacultyApi.list({ limit: 500 }),
  });
  const faculty = data?.data ?? [];

  if (isLoading) {
    return <div className="space-y-2 py-2">{[1, 2, 3].map((i) => <div key={i} className="h-9 bg-gray-100 rounded-lg animate-pulse" />)}</div>;
  }
  if (faculty.length === 0) {
    return <p className="text-sm text-gray-400 py-6 text-center">No active faculty found.</p>;
  }

  const allSelected = faculty.every((f) => selected.has(f._id));

  function toggleAll() {
    if (allSelected) onChange(new Set());
    else onChange(new Set(faculty.map((f) => f._id)));
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
        <Users className="w-3.5 h-3.5" /> Select all ({faculty.length})
      </label>
      <div className="max-h-56 overflow-y-auto divide-y divide-gray-50">
        {faculty.map((f) => (
          <label key={f._id} className="flex items-center gap-2.5 px-1 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
            <input type="checkbox" checked={selected.has(f._id)} onChange={() => toggleOne(f._id)} className="rounded accent-violet-600" />
            <span className="font-medium">{f.fullName}</span>
            <span className="text-xs text-gray-400">{f.employeeId}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
