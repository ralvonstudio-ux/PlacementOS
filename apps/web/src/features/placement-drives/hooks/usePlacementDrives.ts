import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { placementDrivesApi } from '../api/placement-drives.api';
import type {
  CreatePlacementDrivePayload,
  PlacementDriveDetail,
  RecordRoundResultPayload,
  SetApplicationStatusPayload,
  DriveStatus,
} from '@placementos/types';

export const driveKeys = {
  all: ['placement-drives'] as const,
  list: () => [...driveKeys.all, 'list'] as const,
  detail: (id: string) => [...driveKeys.all, 'detail', id] as const,
  stats: (year?: string) => [...driveKeys.all, 'stats', year ?? 'all'] as const,
  mine: () => [...driveKeys.all, 'mine'] as const,
};

export const usePlacementDrives = () => useQuery({ queryKey: driveKeys.list(), queryFn: placementDrivesApi.list });

export const usePlacementDrive = (id: string | undefined) =>
  useQuery({ queryKey: driveKeys.detail(id ?? ''), queryFn: () => placementDrivesApi.get(id!), enabled: !!id });

export const usePlacementStats = (placementYear?: string) =>
  useQuery({ queryKey: driveKeys.stats(placementYear), queryFn: () => placementDrivesApi.stats(placementYear) });

export const useMyDrives = () => useQuery({ queryKey: driveKeys.mine(), queryFn: placementDrivesApi.listMine });

/** Every drive mutation returns the refreshed detail — seed it straight into the cache, and
 *  refresh the list/stats which counts and placement numbers feed into. */
function useDriveMutation<V>(fn: (vars: V) => Promise<PlacementDriveDetail>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (detail) => {
      qc.setQueryData(driveKeys.detail(detail.drive._id), detail);
      qc.invalidateQueries({ queryKey: driveKeys.list() });
      qc.invalidateQueries({ queryKey: [...driveKeys.all, 'stats'] });
    },
  });
}

export const useCreateDrive = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePlacementDrivePayload) => placementDrivesApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: driveKeys.list() }),
  });
};

export const useUpdateDrive = () =>
  useDriveMutation(({ id, payload }: { id: string; payload: Partial<CreatePlacementDrivePayload> }) => placementDrivesApi.update(id, payload));

export const useSetDriveStatus = () =>
  useDriveMutation(({ id, status }: { id: string; status: DriveStatus }) => placementDrivesApi.setStatus(id, { status }));

export const useRecordRoundResult = () =>
  useDriveMutation(({ id, payload }: { id: string; payload: RecordRoundResultPayload }) => placementDrivesApi.recordRoundResult(id, payload));

export const useSetApplicationStatus = () =>
  useDriveMutation(({ id, payload }: { id: string; payload: SetApplicationStatusPayload }) => placementDrivesApi.setApplicationStatus(id, payload));

export const useDeleteDrive = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => placementDrivesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: driveKeys.all }),
  });
};

export const useApplyToDrive = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => placementDrivesApi.apply(id), onSuccess: () => qc.invalidateQueries({ queryKey: driveKeys.mine() }) });
};

export const useWithdrawFromDrive = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => placementDrivesApi.withdraw(id), onSuccess: () => qc.invalidateQueries({ queryKey: driveKeys.mine() }) });
};
