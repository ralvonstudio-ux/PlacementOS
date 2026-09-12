import { apiClient, extractErrorMessage } from '@/services/api';
import type { ApiResponse, LeaveRequest, CreateLeaveRequestPayload, RejectLeaveRequestPayload } from '@placementos/types';

const BASE = '/leave-requests';

export const leaveRequestsApi = {
  async create(payload: CreateLeaveRequestPayload): Promise<LeaveRequest> {
    try {
      const res = await apiClient.post<ApiResponse<LeaveRequest>>(BASE, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async listMine(): Promise<LeaveRequest[]> {
    try {
      const res = await apiClient.get<ApiResponse<LeaveRequest[]>>(`${BASE}/mine`);
      return res.data.data ?? [];
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async listPending(): Promise<LeaveRequest[]> {
    try {
      const res = await apiClient.get<ApiResponse<LeaveRequest[]>>(`${BASE}/pending`);
      return res.data.data ?? [];
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async approve(id: string): Promise<LeaveRequest> {
    try {
      const res = await apiClient.patch<ApiResponse<LeaveRequest>>(`${BASE}/${id}/approve`);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async reject(id: string, payload: RejectLeaveRequestPayload = {}): Promise<LeaveRequest> {
    try {
      const res = await apiClient.patch<ApiResponse<LeaveRequest>>(`${BASE}/${id}/reject`, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async cancel(id: string): Promise<LeaveRequest> {
    try {
      const res = await apiClient.patch<ApiResponse<LeaveRequest>>(`${BASE}/${id}/cancel`);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },
};
