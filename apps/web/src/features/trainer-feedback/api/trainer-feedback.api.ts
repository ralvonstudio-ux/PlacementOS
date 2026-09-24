import { apiClient, extractErrorMessage } from '@/services/api';
import type {
  ApiResponse,
  TrainerFeedback,
  CreateTrainerFeedbackPayload,
  TrainerFeedbackEligibleTrainer,
  TrainerFeedbackListFilters,
  TrainerFeedbackListItem,
  TrainerFeedbackOverviewItem,
} from '@placementos/types';

const BASE = '/trainer-feedback';

export const trainerFeedbackApi = {
  async submit(payload: CreateTrainerFeedbackPayload): Promise<TrainerFeedback> {
    try {
      const res = await apiClient.post<ApiResponse<TrainerFeedback>>(BASE, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async myTrainers(): Promise<TrainerFeedbackEligibleTrainer[]> {
    try {
      const res = await apiClient.get<ApiResponse<TrainerFeedbackEligibleTrainer[]>>(`${BASE}/my-trainers`);
      return res.data.data ?? [];
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async list(filters: TrainerFeedbackListFilters = {}): Promise<TrainerFeedbackListItem[]> {
    try {
      const res = await apiClient.get<ApiResponse<TrainerFeedbackListItem[]>>(BASE, { params: filters });
      return res.data.data ?? [];
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async overview(): Promise<TrainerFeedbackOverviewItem[]> {
    try {
      const res = await apiClient.get<ApiResponse<TrainerFeedbackOverviewItem[]>>(`${BASE}/overview`);
      return res.data.data ?? [];
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },
};
