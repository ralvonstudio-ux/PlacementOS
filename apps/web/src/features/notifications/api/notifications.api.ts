import { apiClient, extractErrorMessage } from '@/services/api';
import type { ApiResponse, Notification } from '@placementos/types';

const BASE = '/notifications';

export interface NotificationsResult {
  notifications: Notification[];
  unreadCount: number;
}

export const notificationsApi = {
  async listMine(): Promise<NotificationsResult> {
    try {
      const res = await apiClient.get<ApiResponse<NotificationsResult>>(`${BASE}/mine`);
      return res.data.data ?? { notifications: [], unreadCount: 0 };
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async markRead(id: string): Promise<Notification> {
    try {
      const res = await apiClient.patch<ApiResponse<Notification>>(`${BASE}/${id}/read`);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async markAllRead(): Promise<void> {
    try {
      await apiClient.patch(`${BASE}/read-all`);
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },
};
