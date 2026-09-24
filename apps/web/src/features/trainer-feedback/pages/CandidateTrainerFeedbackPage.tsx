import { useState } from 'react';
import { Star, CheckCircle2 } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useMyTrainers } from '../hooks/useTrainerFeedback';
import { SubmitFeedbackModal } from '../components/SubmitFeedbackModal';
import type { TrainerFeedbackEligibleTrainer } from '@placementos/types';

export function CandidateTrainerFeedbackPage() {
  const { data: trainers = [], isLoading } = useMyTrainers();
  const [active, setActive] = useState<TrainerFeedbackEligibleTrainer | null>(null);

  return (
    <PageContainer>
      <WorkspaceHeader title="Trainer Feedback" subtitle="Rate the trainers teaching your batch — your input helps improve training quality" />

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl" />)}
        </div>
      ) : trainers.length === 0 ? (
        <EmptyState icon={Star} title="No trainers to rate yet" description="Once training sessions are scheduled for your batch, you'll be able to rate your trainers here." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {trainers.map((t) => (
            <div key={`${t.facultyId}-${t.track}`} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{t.facultyName}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t.track}{t.department ? ` · ${t.department}` : ''}</p>
              </div>
              {t.alreadySubmitted ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 shrink-0">
                  <CheckCircle2 className="w-4 h-4" /> Submitted
                </span>
              ) : (
                <button
                  onClick={() => setActive(t)}
                  className="h-9 px-4 rounded-lg bg-violet-600 hover:bg-violet-700 text-xs font-semibold text-white transition-colors shrink-0"
                >
                  Rate Trainer
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {active && <SubmitFeedbackModal trainer={active} onClose={() => setActive(null)} />}
    </PageContainer>
  );
}
