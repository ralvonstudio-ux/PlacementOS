import { apiClient, extractErrorMessage } from '@/services/api';
import type {
  ApiResponse,
  Notification,
  SendStaffMessagePayload,
  NotificationBroadcastSummary,
  NotificationBroadcastRecipient,
} from '@placementos/types';

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

  async listUnacknowledged(): Promise<Notification[]> {
    try {
      const res = await apiClient.get<ApiResponse<Notification[]>>(`${BASE}/unacknowledged`);
      return res.data.data ?? [];
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

  async acknowledge(id: string): Promise<Notification> {
    try {
      const res = await apiClient.patch<ApiResponse<Notification>>(`${BASE}/${id}/acknowledge`);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async send(payload: SendStaffMessagePayload): Promise<{ sentCount: number }> {
    try {
      const res = await apiClient.post<ApiResponse<{ sentCount: number }>>(`${BASE}/send`, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async listBroadcasts(): Promise<NotificationBroadcastSummary[]> {
    try {
      const res = await apiClient.get<ApiResponse<NotificationBroadcastSummary[]>>(`${BASE}/broadcasts`);
      return res.data.data ?? [];
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async getBroadcastRecipients(broadcastId: string): Promise<NotificationBroadcastRecipient[]> {
    try {
      const res = await apiClient.get<ApiResponse<NotificationBroadcastRecipient[]>>(`${BASE}/broadcasts/${broadcastId}/recipients`);
      return res.data.data ?? [];
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },
};
