import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../api/notifications.api';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { SendStaffMessagePayload } from '@placementos/types';

export const notificationKeys = {
  all: ['notifications'] as const,
  mine: () => [...notificationKeys.all, 'mine'] as const,
  unacknowledged: () => [...notificationKeys.all, 'unacknowledged'] as const,
  broadcasts: () => [...notificationKeys.all, 'broadcasts'] as const,
  broadcastRecipients: (broadcastId: string) => [...notificationKeys.all, 'broadcasts', broadcastId, 'recipients'] as const,
};

// Polling, not a socket — there's no push/websocket layer in this app yet (see the test
// notification flow this backs). 30s keeps the bell reasonably live without hammering the API.
const POLL_INTERVAL_MS = 30_000;
// A 'high' priority message must interrupt the recipient fast — the blocking overlay
// polls much more aggressively than the regular inbox/bell.
const UNACK_POLL_INTERVAL_MS = 8_000;

const canReceive = (role?: string) => role === 'candidate' || role === 'faculty';

export const useMyNotifications = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: notificationKeys.mine(),
    queryFn: notificationsApi.listMine,
    enabled: canReceive(user?.role),
    refetchInterval: POLL_INTERVAL_MS,
  });
};

/** Backs the global blocking overlay — every 'high' priority message this user hasn't
 *  acknowledged yet, for candidates and faculty alike. */
export const useUnacknowledgedNotifications = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: notificationKeys.unacknowledged(),
    queryFn: notificationsApi.listUnacknowledged,
    enabled: canReceive(user?.role),
    refetchInterval: UNACK_POLL_INTERVAL_MS,
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

export const useAcknowledgeNotification = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.acknowledge(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
};

export const useSendStaffMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SendStaffMessagePayload) => notificationsApi.send(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.broadcasts() }),
  });
};

export const useBroadcasts = () =>
  useQuery({ queryKey: notificationKeys.broadcasts(), queryFn: notificationsApi.listBroadcasts });

export const useBroadcastRecipients = (broadcastId: string | null) =>
  useQuery({
    queryKey: notificationKeys.broadcastRecipients(broadcastId ?? ''),
    queryFn: () => notificationsApi.getBroadcastRecipients(broadcastId!),
    enabled: !!broadcastId,
  });
