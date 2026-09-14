import { apiClient, extractErrorMessage } from '@/services/api';
import type {
  ApiResponse, AcademicPlan, GenerateAcademicPlanPayload, EditAcademicPlanSessionPayload, AddAcademicPlanSessionPayload,
} from '@placementos/types';

const BASE = '/academic-plan';

export const academicPlanApi = {
  async generate(payload: GenerateAcademicPlanPayload): Promise<AcademicPlan> {
    try {
      const res = await apiClient.post<ApiResponse<AcademicPlan>>(`${BASE}/generate`, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async get(batch: string, track: string): Promise<AcademicPlan | null> {
    try {
      const res = await apiClient.get<ApiResponse<AcademicPlan | null>>(BASE, { params: { batch, track } });
      return res.data.data ?? null;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async editSession(planId: string, payload: EditAcademicPlanSessionPayload): Promise<AcademicPlan> {
    try {
      const res = await apiClient.patch<ApiResponse<AcademicPlan>>(`${BASE}/${planId}/sessions/${payload.lectureNumber}`, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async addSession(planId: string, payload: AddAcademicPlanSessionPayload): Promise<AcademicPlan> {
    try {
      const res = await apiClient.post<ApiResponse<AcademicPlan>>(`${BASE}/${planId}/sessions`, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async deleteSession(planId: string, lectureNumber: number): Promise<AcademicPlan> {
    try {
      const res = await apiClient.delete<ApiResponse<AcademicPlan>>(`${BASE}/${planId}/sessions/${lectureNumber}`);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async remove(planId: string): Promise<void> {
    try {
      await apiClient.delete(`${BASE}/${planId}`);
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },
};
