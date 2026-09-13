import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trainingScheduleApi, TrainingScheduleListOptions } from '../api/training-schedule.api';
import type {
  TrainingScheduleEntry,
  CreatePeriodSlotPayload,
  UpdatePeriodSlotPayload,
  MasterGridQuery,
  SetMasterGridCellPayload,
  CreateSubstitutePayload,
  UpdateSubstitutePayload,
} from '@placementos/types';

export const trainingScheduleKeys = {
  all: ['training-schedule'] as const,
  list: (opts: TrainingScheduleListOptions) => [...trainingScheduleKeys.all, 'list', opts] as const,
  periods: () => [...trainingScheduleKeys.all, 'periods'] as const,
  conflicts: (placementYear: string) => [...trainingScheduleKeys.all, 'conflicts', placementYear] as const,
  masterGrid: (query: MasterGridQuery) => [...trainingScheduleKeys.all, 'master-grid', query] as const,
  substitutes: (opts: Record<string, unknown>) => [...trainingScheduleKeys.all, 'substitutes', opts] as const,
  needsSubstitute: (date: string) => [...trainingScheduleKeys.all, 'needs-substitute', date] as const,
};

export const useTrainingScheduleList = (opts: TrainingScheduleListOptions = {}) =>
  useQuery({
    queryKey: trainingScheduleKeys.list(opts),
    queryFn: () => trainingScheduleApi.list(opts),
  });

/** Deduped {batch, track} pairs from a schedule entry list — "my batches" for the logged-in faculty member. */
export const useMyBatchTracks = () => {
  const query = useTrainingScheduleList();
  const pairs = new Map<string, { batch: string; track: string }>();
  for (const entry of query.data ?? []) {
    const key = `${entry.batch}::${entry.track}`;
    if (!pairs.has(key)) pairs.set(key, { batch: entry.batch, track: entry.track });
  }
  return { ...query, batchTracks: [...pairs.values()] };
};

export const useCreateTrainingScheduleEntry = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<TrainingScheduleEntry, '_id' | 'instituteId' | 'createdAt' | 'updatedAt'>) => trainingScheduleApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: trainingScheduleKeys.all }),
  });
};

export const useDeleteTrainingScheduleEntry = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => trainingScheduleApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: trainingScheduleKeys.all }),
  });
};

export const useUpdateTrainingScheduleEntry = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Omit<TrainingScheduleEntry, '_id' | 'instituteId' | 'createdAt' | 'updatedAt'>> }) =>
      trainingScheduleApi.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: trainingScheduleKeys.all }),
  });
};

// ── Period slots ────────────────────────────────────────────────────────────
export const usePeriodSlots = () =>
  useQuery({ queryKey: trainingScheduleKeys.periods(), queryFn: trainingScheduleApi.listPeriods });

export const useCreatePeriodSlot = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePeriodSlotPayload) => trainingScheduleApi.createPeriod(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: trainingScheduleKeys.periods() }),
  });
};

export const useUpdatePeriodSlot = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePeriodSlotPayload }) => trainingScheduleApi.updatePeriod(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: trainingScheduleKeys.periods() }),
  });
};

export const useDeletePeriodSlot = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => trainingScheduleApi.deletePeriod(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: trainingScheduleKeys.periods() }),
  });
};

export const useReorderPeriodSlots = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => trainingScheduleApi.reorderPeriods(orderedIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: trainingScheduleKeys.periods() }),
  });
};

// ── Conflicts & master grid ─────────────────────────────────────────────────
export const useConflicts = (placementYear: string) =>
  useQuery({
    queryKey: trainingScheduleKeys.conflicts(placementYear),
    queryFn: () => trainingScheduleApi.getConflicts(placementYear),
    enabled: !!placementYear,
  });

export const useMasterGrid = (query: MasterGridQuery) =>
  useQuery({
    queryKey: trainingScheduleKeys.masterGrid(query),
    queryFn: () => trainingScheduleApi.getMasterGrid(query),
    enabled: !!query.placementYear,
  });

export const useSetMasterGridCell = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SetMasterGridCellPayload) => trainingScheduleApi.setMasterGridCell(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: trainingScheduleKeys.all }),
  });
};

// ── Substitutes ────────────────────────────────────────────────────────────
export const useSubstitutes = (opts: { date?: string; status?: string; facultyId?: string } = {}) =>
  useQuery({
    queryKey: trainingScheduleKeys.substitutes(opts),
    queryFn: () => trainingScheduleApi.listSubstitutes(opts),
  });

export const useNeedsSubstitute = (date: string) =>
  useQuery({
    queryKey: trainingScheduleKeys.needsSubstitute(date),
    queryFn: () => trainingScheduleApi.getNeedsSubstitute(date),
    enabled: !!date,
  });

export const useCreateSubstitute = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSubstitutePayload) => trainingScheduleApi.createSubstitute(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: trainingScheduleKeys.all }),
  });
};

export const useUpdateSubstitute = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateSubstitutePayload }) => trainingScheduleApi.updateSubstitute(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: trainingScheduleKeys.all }),
  });
};

export const useDeleteSubstitute = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => trainingScheduleApi.removeSubstitute(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: trainingScheduleKeys.all }),
  });
};
