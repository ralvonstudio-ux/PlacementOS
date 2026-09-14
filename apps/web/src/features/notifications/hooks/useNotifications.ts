import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../api/notifications.api';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { SendStaffMessagePayload } from '@placementos/types';

export const notificationKeys = {
  all: ['notifications'] as const,
  mine: () => [...notificationKeys.all, 'mine'] as const,
};

// Polling, not a socket — there's no push/websocket layer in this app yet (see the test
// notification flow this backs). 30s keeps the bell reasonably live without hammering the API.
const POLL_INTERVAL_MS = 30_000;

export const useMyNotifications = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: notificationKeys.mine(),
    queryFn: notificationsApi.listMine,
    enabled: user?.role === 'candidate',
    refetchInterval: POLL_INTERVAL_MS,
  });
};

export const useMarkNotificationRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
};

export const useMarkAllNotificationsRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
};

export const useSendStaffMessage = () =>
  useMutation({ mutationFn: (payload: SendStaffMessagePayload) => notificationsApi.send(payload) });
