import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { candidatesApi } from '@/features/candidates/api/candidates.api';
import type { PracticeAudience } from '@placementos/types';

export interface AudienceValue {
  audience: PracticeAudience;
  batches: string[];
  candidateIds: string[];
}

const OPTIONS: { value: PracticeAudience; label: string; hint: string }[] = [
  { value: 'all', label: 'All students', hint: 'Every student in the institute' },
  { value: 'batches', label: 'Selected batches', hint: 'Whole batches / classes' },
  { value: 'students', label: 'Specific students', hint: 'Hand-pick individuals' },
];

/** "Who can see this?" — shared by the add/edit question modal and the bulk-assign modal. */
export function AudiencePicker({ value, onChange }: { value: AudienceValue; onChange: (next: AudienceValue) => void }) {
  const { data: allBatches = [] } = useQuery({ queryKey: ['practice', 'batches'], queryFn: candidatesApi.listBatches });
  const [rosterBatch, setRosterBatch] = useState('');
  // Names for ids we have seen in a roster, so chips can show who was picked.
  const [names, setNames] = useState<Record<string, string>>({});

  const { data: roster = [], isLoading: loadingRoster } = useQuery({
    queryKey: ['practice', 'roster', rosterBatch],
    queryFn: async () => {
      const list = await candidatesApi.listByBatch(rosterBatch);
      setNames((prev) => ({ ...prev, ...Object.fromEntries(list.map((c) => [c._id, c.fullName])) }));
      return list;
    },
    enabled: value.audience === 'students' && !!rosterBatch,
  });

  const toggle = (list: string[], item: string) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  const rosterAllSelected = roster.length > 0 && roster.every((c) => value.candidateIds.includes(c._id));

  function toggleRoster() {
    const rosterIds = roster.map((c) => c._id);
    onChange({
      ...value,
      candidateIds: rosterAllSelected
        ? value.candidateIds.filter((id) => !rosterIds.includes(id))
        : Array.from(new Set([...value.candidateIds, ...rosterIds])),
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange({ ...value, audience: o.value })}
            className={`text-left px-3 py-2.5 rounded-xl border transition-colors ${value.audience === o.value ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:border-violet-300'}`}
          >
            <p className={`text-xs font-semibold ${value.audience === o.value ? 'text-violet-700' : 'text-gray-800'}`}>{o.label}</p>
            <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{o.hint}</p>
          </button>
        ))}
      </div>

      {value.audience === 'batches' && (
        allBatches.length === 0 ? (
          <p className="text-sm text-gray-400">No batches found yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allBatches.map((b) => {
              const on = value.batches.includes(b);
              return (
                <button key={b} type="button" onClick={() => onChange({ ...value, batches: toggle(value.batches, b) })} className={`h-8 px-3.5 rounded-full text-xs font-medium border transition-colors ${on ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-violet-300'}`}>
                  {b}
                </button>
              );
            })}
          </div>
        )
      )}

      {value.audience === 'students' && (
        <div className="space-y-2">
          {value.candidateIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {value.candidateIds.map((id) => (
                <span key={id} className="inline-flex items-center gap-1 text-[11px] font-medium pl-2.5 pr-1.5 py-1 rounded-full bg-violet-50 text-violet-700">
                  {names[id] ?? 'Student'}
                  <button type="button" onClick={() => onChange({ ...value, candidateIds: value.candidateIds.filter((x) => x !== id) })} className="p-0.5 rounded-full hover:bg-violet-100"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}
          <select value={rosterBatch} onChange={(e) => setRosterBatch(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500">
            <option value="">Pick a batch to choose students from…</option>
            {allBatches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          {rosterBatch && (
            loadingRoster ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-9 bg-gray-100 rounded-lg animate-pulse" />)}</div>
            ) : roster.length === 0 ? (
              <p className="text-sm text-gray-400 py-3 text-center">No active students in this batch.</p>
            ) : (
              <div className="rounded-xl border border-gray-100">
                <label className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-500 border-b border-gray-100">
                  <input type="checkbox" checked={rosterAllSelected} onChange={toggleRoster} className="rounded accent-violet-600" />
                  Select all in {rosterBatch} ({roster.length})
                </label>
                <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
                  {roster.map((c) => (
                    <label key={c._id} className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={value.candidateIds.includes(c._id)} onChange={() => onChange({ ...value, candidateIds: toggle(value.candidateIds, c._id) })} className="rounded accent-violet-600" />
                      <span className="font-medium">{c.fullName}</span>
                      <span className="text-xs text-gray-400">{c.rollNumber}</span>
                    </label>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

/** Validation message for an audience selection, or '' when it's usable. */
export function audienceError(v: AudienceValue): string {
  if (v.audience === 'batches' && v.batches.length === 0) return 'Pick at least one batch.';
  if (v.audience === 'students' && v.candidateIds.length === 0) return 'Pick at least one student.';
  return '';
}
