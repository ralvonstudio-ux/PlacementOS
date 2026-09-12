import { apiClient, extractErrorMessage } from '@/services/api';
import type {
  TrainingPlan,
  GenerateTrainingPlanPayload,
  TrainingPlanGenerationResult,
  SetTrainingPlanDayStatusPayload,
  EditTrainingPlanDayPayload,
  MoveTrainingPlanDayPayload,
  TrainingPlanTpoOverviewEntry,
  TrainingPlanAlert,
} from '@placementos/types';

const BASE = '/training-plan';

export interface PlanTarget {
  batch: string;
  track: string;
}

export const trainingPlanApi = {
  generate: async (payload: GenerateTrainingPlanPayload): Promise<TrainingPlanGenerationResult> => {
    try {
      const res = await apiClient.post<{ data: TrainingPlanGenerationResult }>(`${BASE}/generate`, payload);
      return res.data.data;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  getMine: async (target: PlanTarget): Promise<TrainingPlan | null> => {
    try {
      const res = await apiClient.get<{ data: TrainingPlan | null }>(`${BASE}/mine`, {
        params: { batch: target.batch, track: target.track },
      });
      return res.data.data;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  setDayStatus: async (planId: string, payload: SetTrainingPlanDayStatusPayload): Promise<TrainingPlan> => {
    try {
      const res = await apiClient.patch<{ data: TrainingPlan }>(`${BASE}/${planId}/days`, payload);
      return res.data.data;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  editDay: async (planId: string, payload: EditTrainingPlanDayPayload): Promise<TrainingPlan> => {
    try {
      const res = await apiClient.patch<{ data: TrainingPlan }>(`${BASE}/${planId}/days/edit`, payload);
      return res.data.data;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  moveDay: async (planId: string, payload: MoveTrainingPlanDayPayload): Promise<TrainingPlan> => {
    try {
      const res = await apiClient.patch<{ data: TrainingPlan }>(`${BASE}/${planId}/days/move`, payload);
      return res.data.data;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  // ── TPO (read-only) ───────────────────────────────────────────────────────

  getTpoOverview: async (): Promise<TrainingPlanTpoOverviewEntry[]> => {
    try {
      const res = await apiClient.get<{ data: TrainingPlanTpoOverviewEntry[] }>(`${BASE}/tpo/overview`);
      return res.data.data;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  getForFaculty: async (facultyId: string, target: PlanTarget): Promise<TrainingPlan> => {
    try {
      const res = await apiClient.get<{ data: TrainingPlan }>(`${BASE}/tpo/${facultyId}`, {
        params: { batch: target.batch, track: target.track },
      });
      return res.data.data;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  // ── Plan Alerts (automation) ──────────────────────────────────────────────

  listAlerts: async (): Promise<TrainingPlanAlert[]> => {
    try {
      const res = await apiClient.get<{ data: TrainingPlanAlert[] }>(`${BASE}/alerts`);
      return res.data.data;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  resolveAlert: async (alertId: string): Promise<TrainingPlanAlert> => {
    try {
      const res = await apiClient.patch<{ data: TrainingPlanAlert }>(`${BASE}/alerts/${alertId}/resolve`);
      return res.data.data;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },
};
