import { useMemo } from 'react';
import { Award, RefreshCw, Loader2, Flame, CalendarDays } from 'lucide-react';
import type { LeetCodeStats } from '@placementos/types';

interface LeetCodeStatsCardProps {
  username: string;
  stats?: LeetCodeStats;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  isFetching: boolean;
  onRefresh: () => void;
  /** Compact mode drops the heatmap for tighter spaces (e.g. the dashboard). */
  compact?: boolean;
}

const DAY_SECONDS = 86_400;
const HEATMAP_DAYS = 371;

function heatColor(count: number): string {
  if (count <= 0) return 'bg-gray-100';
  if (count <= 2) return 'bg-emerald-200';
  if (count <= 4) return 'bg-emerald-400';
  return 'bg-emerald-600';
}

interface HeatDay {
  date: Date;
  count: number;
}

function buildWeeks(calendar: Record<string, number> | undefined | null): (HeatDay | null)[][] {
  const safeCalendar = calendar ?? {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days: HeatDay[] = [];
  for (let i = HEATMAP_DAYS - 1; i >= 0; i--) {
    const date = new Date(today.getTime() - i * DAY_SECONDS * 1000);
    const utcDayStart = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 1000);
    days.push({ date, count: safeCalendar[String(utcDayStart)] ?? 0 });
  }

  const leadingBlanks: null[] = Array(days[0].date.getDay()).fill(null);
  const padded: (HeatDay | null)[] = [...leadingBlanks, ...days];

  const weeks: (HeatDay | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));
  return weeks;
}

function RingChart({ stats }: { stats: LeetCodeStats }) {
  const total = stats.totalQuestions || 1;
  const easyDeg = (stats.easySolved / total) * 360;
  const mediumDeg = (stats.mediumSolved / total) * 360;
  const hardDeg = (stats.hardSolved / total) * 360;
  const c1 = easyDeg;
  const c2 = c1 + mediumDeg;
  const c3 = c2 + hardDeg;

  return (
    <div
      className="w-32 h-32 rounded-full flex items-center justify-center shrink-0"
      style={{
        background: `conic-gradient(#22c55e 0deg ${c1}deg, #f59e0b ${c1}deg ${c2}deg, #ef4444 ${c2}deg ${c3}deg, #e5e7eb ${c3}deg 360deg)`,
      }}
    >
      <div className="w-[88px] h-[88px] rounded-full bg-white flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-gray-900">{stats.totalSolved}</span>
        <span className="text-[11px] text-gray-400">/ {stats.totalQuestions}</span>
      </div>
    </div>
  );
}

function DifficultyRow({ label, solved, total, accent }: { label: string; solved: number; total: number; accent: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className={`font-semibold ${accent}`}>{label}</span>
      <span className="font-medium text-gray-500 tabular-nums">
        {solved}/{total}
      </span>
    </div>
  );
}

export function LeetCodeStatsCard({ username, stats, isLoading, isError, errorMessage, isFetching, onRefresh, compact }: LeetCodeStatsCardProps) {
  const weeks = useMemo(() => (stats ? buildWeeks(stats.submissionCalendar) : []), [stats]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-base font-semibold text-gray-900">{username}</span>
          {stats?.ranking && <span className="text-xs text-gray-400">· Rank #{stats.ranking.toLocaleString()}</span>}
        </div>
        <button onClick={onRefresh} disabled={isFetching} className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-700 disabled:opacity-50">
          {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Live
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="h-32 bg-gray-100 rounded-full w-32 animate-pulse" />
          <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
        </div>
      ) : isError ? (
        <p className="text-sm text-red-600">{errorMessage}</p>
      ) : stats ? (
        <>
          <div className="flex items-center gap-6 flex-wrap">
            <RingChart stats={stats} />
            <div className="flex-1 min-w-[140px] space-y-2">
              <DifficultyRow label="Easy" solved={stats.easySolved} total={stats.easyTotal} accent="text-emerald-600" />
              <DifficultyRow label="Medium" solved={stats.mediumSolved} total={stats.mediumTotal} accent="text-amber-600" />
              <DifficultyRow label="Hard" solved={stats.hardSolved} total={stats.hardTotal} accent="text-red-600" />
            </div>
            <div className="flex-1 min-w-[140px] border-l border-gray-100 pl-6">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-2">
                <Award className="w-3.5 h-3.5" /> Badges
              </div>
              <p className="text-xl font-bold text-gray-900">{stats.badgeCount}</p>
              {stats.recentBadge && (
                <div className="flex items-center gap-2 mt-2">
                  <img src={stats.recentBadge.iconUrl} alt="" className="w-6 h-6 rounded" />
                  <span className="text-[11px] text-gray-500 truncate">{stats.recentBadge.name}</span>
                </div>
              )}
            </div>
          </div>

          {!compact && (
            <div className="mt-6 pt-5 border-t border-gray-100">
              <div className="flex items-center justify-between mb-3 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" /> {stats.totalActiveDays} active days
                </span>
                <span className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-orange-500" /> Max streak {stats.maxStreak}d
                </span>
              </div>
              <div className="flex gap-[3px] overflow-x-auto pb-1">
                {weeks.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-[3px]">
                    {week.map((day, di) =>
                      day ? (
                        <div
                          key={di}
                          title={`${day.date.toLocaleDateString()}: ${day.count} submission${day.count === 1 ? '' : 's'}`}
                          className={`w-[10px] h-[10px] rounded-[2px] ${heatColor(day.count)}`}
                        />
                      ) : (
                        <div key={di} className="w-[10px] h-[10px]" />
                      )
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[11px] text-gray-300 mt-4">Updated {new Date(stats.fetchedAt).toLocaleTimeString()} · auto-refreshes every 30s</p>
        </>
      ) : null}
    </div>
  );
}
