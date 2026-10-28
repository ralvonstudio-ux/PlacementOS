import type { ReactNode } from 'react';
import type { DriveApplicationStatus, DriveJobType, DriveRoundResult, DriveRoundType, DriveStatus, PlacementDrive } from '@placementos/types';

export const JOB_TYPE_LABEL: Record<DriveJobType, string> = {
  full_time: 'Full-time',
  internship: 'Internship',
  internship_ppo: 'Internship + PPO',
};

export const ROUND_TYPE_LABEL: Record<DriveRoundType, string> = {
  aptitude: 'Aptitude / Online test',
  technical: 'Technical test',
  coding: 'Coding round',
  group_discussion: 'Group discussion',
  interview: 'Technical interview',
  hr: 'HR interview',
  other: 'Other',
};

export const DRIVE_STATUS_STYLE: Record<DriveStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-gray-100 text-gray-600' },
  open: { label: 'Open', cls: 'bg-green-100 text-green-700' },
  closed: { label: 'Applications closed', cls: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Completed', cls: 'bg-violet-100 text-violet-700' },
};

export const APP_STATUS_STYLE: Record<DriveApplicationStatus, { label: string; cls: string }> = {
  applied: { label: 'Applied', cls: 'bg-blue-50 text-blue-700' },
  shortlisted: { label: 'In process', cls: 'bg-amber-50 text-amber-700' },
  selected: { label: 'Selected', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Not selected', cls: 'bg-red-50 text-red-600' },
  withdrawn: { label: 'Withdrawn', cls: 'bg-gray-100 text-gray-500' },
};

export const ROUND_RESULT_STYLE: Record<DriveRoundResult, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-gray-50 text-gray-400 border-gray-200' },
  cleared: { label: 'Cleared', cls: 'bg-green-50 text-green-700 border-green-200' },
  rejected: { label: 'Rejected', cls: 'bg-red-50 text-red-600 border-red-200' },
  absent: { label: 'Absent', cls: 'bg-gray-100 text-gray-500 border-gray-300' },
};

export function Badge({ cls, children }: { cls: string; children: ReactNode }) {
  return <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>{children}</span>;
}

export function packageLabel(d: Pick<PlacementDrive, 'ctcLpa' | 'stipendPerMonth'>): string {
  const parts = [];
  if (d.ctcLpa) parts.push(`${d.ctcLpa} LPA`);
  if (d.stipendPerMonth) parts.push(`₹${d.stipendPerMonth.toLocaleString('en-IN')}/mo stipend`);
  return parts.join(' · ') || 'Package not disclosed';
}

export function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** One-line summary of who can apply, e.g. "CGPA ≥ 7 · 0 backlogs · CSE, ECE · 2026". */
export function eligibilitySummary(d: PlacementDrive): string {
  const e = d.eligibility;
  const parts: string[] = [];
  if (e.minCgpa !== undefined) parts.push(`CGPA ≥ ${e.minCgpa}`);
  if (e.maxBacklogs !== undefined) parts.push(e.maxBacklogs === 0 ? 'No backlogs' : `≤ ${e.maxBacklogs} backlogs`);
  if (e.departments.length) parts.push(e.departments.join(', '));
  if (e.batches.length) parts.push(`Batch ${e.batches.join(', ')}`);
  if (e.placementYears.length) parts.push(`Class of ${e.placementYears.join(', ')}`);
  if (e.excludePlaced) parts.push('Unplaced only');
  return parts.join(' · ') || 'Open to all students';
}

export const isDeadlinePassed = (d: Pick<PlacementDrive, 'applicationDeadline'>) =>
  !!d.applicationDeadline && Date.now() > new Date(d.applicationDeadline).getTime();
