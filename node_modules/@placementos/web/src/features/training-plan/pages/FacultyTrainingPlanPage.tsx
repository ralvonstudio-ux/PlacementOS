import { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useMyBatchTracks } from '@/features/training-schedule/hooks/useTrainingSchedule';
import { useMyTrainingPlan, useGenerateTrainingPlan, useSetPlanDayStatus } from '../hooks/useTrainingPlan';
import { extractErrorMessage } from '@/services/api';
import type { TrainingPlanStatus } from '@placementos/types';

const STATUS_CYCLE: TrainingPlanStatus[] = ['planned', 'in_progress', 'completed', 'skipped'];
const STATUS_LABEL: Record<TrainingPlanStatus, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  completed: 'Completed',
  skipped: 'Skipped',
};
const STATUS_CLASSES: Record<TrainingPlanStatus, string> = {
  planned: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
  skipped: 'bg-gray-100 text-gray-400 line-through',
};

export function FacultyTrainingPlanPage() {
  const { batchTracks, isLoading: loadingBatches } = useMyBatchTracks();
  const [selected, setSelected] = useState<{ batch: string; track: string } | null>(null);

  useEffect(() => {
    if (!selected && batchTracks.length > 0) setSelected(batchTracks[0]);
  }, [batchTracks, selected]);

  const target = selected ?? { batch: '', track: '' };
  const { data: plan, isLoading: loadingPlan } = useMyTrainingPlan(target);
  const { mutateAsync: generate, isPending: isGenerating } = useGenerateTrainingPlan();
  const [genError, setGenError] = useState('');
  const [genWarnings, setGenWarnings] = useState<string[]>([]);

  async function handleGenerate() {
    if (!selected) return;
    setGenError('');
    setGenWarnings([]);
    try {
      const result = await generate({ batch: selected.batch, track: selected.track });
      setGenWarnings(result.warnings.map((w) => w.message));
    } catch (err) {
      setGenError(extractErrorMessage(err));
    }
  }

  return (
    <PageContainer>
      <WorkspaceHeader
        title="Training Plan"
        subtitle="This week's plan for your batch/track"
        action={
          selected && (
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {plan ? 'Regenerate' : 'Generate Plan'}
            </button>
          )
        }
      />

      {batchTracks.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {batchTracks.map((bt) => (
            <button
              key={`${bt.batch}-${bt.track}`}
              onClick={() => setSelected(bt)}
              className={`h-9 px-4 rounded-full text-sm font-medium border transition-colors ${
                selected?.batch === bt.batch && selected?.track === bt.track
                  ? 'bg-violet-600 border-violet-600 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-violet-300'
              }`}
            >
              {bt.batch} · {bt.track}
            </button>
          ))}
        </div>
      )}

      {genError && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
          <p className="text-sm text-red-600">{genError}</p>
        </div>
      )}
      {genWarnings.length > 0 && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 space-y-1">
          {genWarnings.map((w, i) => <p key={i} className="text-sm text-amber-700">{w}</p>)}
        </div>
      )}

      {loadingBatches || loadingPlan ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : !selected ? (
        <EmptyState icon={Sparkles} title="No batches assigned" description="You need a Training Schedule entry before you can build a plan." />
      ) : !plan ? (
        <EmptyState
          icon={Sparkles}
          title="No plan for this week yet"
          description={`Generate a training plan for ${selected.batch} · ${selected.track}.`}
          action={{ label: 'Generate Plan', onClick: handleGenerate }}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {plan.days.map((day) => (
            <PlanDayRow key={day.date} planId={plan._id} day={day} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}

function PlanDayRow({ planId, day }: { planId: string; day: import('@placementos/types').TrainingPlanDay }) {
  const { mutate: setStatus, isPending } = useSetPlanDayStatus(planId);

  function cycleStatus() {
    const idx = STATUS_CYCLE.indexOf(day.status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    setStatus({ date: day.date, status: next });
  }

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="w-24 shrink-0 text-sm font-semibold text-gray-700">
        {new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{day.title}</p>
        {day.moduleName && day.moduleName !== day.title && <p className="text-xs text-gray-400">{day.moduleName}</p>}
      </div>
      <button
        onClick={cycleStatus}
        disabled={isPending}
        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors disabled:opacity-50 ${STATUS_CLASSES[day.status]}`}
      >
        {day.status === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
        {STATUS_LABEL[day.status]}
      </button>
    </div>
  );
}
