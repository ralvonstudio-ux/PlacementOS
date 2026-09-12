import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveRequestsApi } from '../api/leave-requests.api';
import type { CreateLeaveRequestPayload, RejectLeaveRequestPayload } from '@placementos/types';

export const leaveRequestKeys = {
  all: ['leave-requests'] as const,
  mine: () => [...leaveRequestKeys.all, 'mine'] as const,
  pending: () => [...leaveRequestKeys.all, 'pending'] as const,
};

export const useMyLeaveRequests = () =>
  useQuery({ queryKey: leaveRequestKeys.mine(), queryFn: leaveRequestsApi.listMine });

export const usePendingLeaveRequests = () =>
  useQuery({ queryKey: leaveRequestKeys.pending(), queryFn: leaveRequestsApi.listPending });

export const useCreateLeaveRequest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateLeaveRequestPayload) => leaveRequestsApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: leaveRequestKeys.all }),
  });
};

export const useApproveLeaveRequest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => leaveRequestsApi.approve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: leaveRequestKeys.all }),
  });
};

export const useRejectLeaveRequest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload?: RejectLeaveRequestPayload }) => leaveRequestsApi.reject(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: leaveRequestKeys.all }),
  });
};

export const useCancelLeaveRequest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => leaveRequestsApi.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: leaveRequestKeys.all }),
  });
};
