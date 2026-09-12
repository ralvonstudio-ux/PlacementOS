import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trainingPlanApi, PlanTarget } from '../api/training-plan.api';
import type {
  GenerateTrainingPlanPayload,
  SetTrainingPlanDayStatusPayload,
  EditTrainingPlanDayPayload,
  MoveTrainingPlanDayPayload,
} from '@placementos/types';

function targetKey(t: PlanTarget) {
  return [t.batch, t.track] as const;
}

export const trainingPlanKeys = {
  all:  ['training-plan'] as const,
  mine: (t: PlanTarget) => [...trainingPlanKeys.all, 'mine', ...targetKey(t)] as const,
  tpoOverview: ['training-plan', 'tpo', 'overview'] as const,
  tpoDetail:   (facultyId: string, t: PlanTarget) => ['training-plan', 'tpo', 'detail', facultyId, ...targetKey(t)] as const,
  alerts: ['training-plan', 'alerts'] as const,
};

export const useMyTrainingPlan = (target: PlanTarget) =>
  useQuery({
    queryKey: trainingPlanKeys.mine(target),
    queryFn:  () => trainingPlanApi.getMine(target),
    enabled:  !!target.batch && !!target.track,
  });

export const useGenerateTrainingPlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: GenerateTrainingPlanPayload) => trainingPlanApi.generate(payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey: trainingPlanKeys.all }),
  });
};

export const useSetPlanDayStatus = (planId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SetTrainingPlanDayStatusPayload) => trainingPlanApi.setDayStatus(planId, payload),
    // Carry-forward can append a brand-new day to the plan, so re-fetch the
    // whole plan rather than patching one day in the cache locally.
    onSuccess: () => qc.invalidateQueries({ queryKey: trainingPlanKeys.all }),
  });
};

export const useEditPlanDay = (planId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: EditTrainingPlanDayPayload) => trainingPlanApi.editDay(planId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: trainingPlanKeys.all }),
  });
};

export const useMovePlanDay = (planId: string) => {
  const qc = useQueryClient();
  return useMutation({
    // Swaps two days at once — always re-fetch rather than patch the cache.
    mutationFn: (payload: MoveTrainingPlanDayPayload) => trainingPlanApi.moveDay(planId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: trainingPlanKeys.all }),
  });
};

// ── TPO (read-only) ────────────────────────────────────────────────────────

export const useTpoPlanOverview = () =>
  useQuery({
    queryKey: trainingPlanKeys.tpoOverview,
    queryFn:  () => trainingPlanApi.getTpoOverview(),
  });

export const useTpoPlanDetail = (facultyId: string, target: PlanTarget) =>
  useQuery({
    queryKey: trainingPlanKeys.tpoDetail(facultyId, target),
    queryFn:  () => trainingPlanApi.getForFaculty(facultyId, target),
    enabled:  !!facultyId && !!target.batch && !!target.track,
  });

// ── Plan Alerts (automation) ───────────────────────────────────────────────

export const usePlanAlerts = () =>
  useQuery({
    queryKey: trainingPlanKeys.alerts,
    queryFn:  () => trainingPlanApi.listAlerts(),
    staleTime: 60_000,
  });

export const useResolvePlanAlert = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alertId: string) => trainingPlanApi.resolveAlert(alertId),
    onSuccess: () => qc.invalidateQueries({ queryKey: trainingPlanKeys.alerts }),
  });
};
