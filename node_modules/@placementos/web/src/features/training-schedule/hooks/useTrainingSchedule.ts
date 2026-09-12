import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trainingScheduleApi, TrainingScheduleListOptions } from '../api/training-schedule.api';
import type { TrainingScheduleEntry } from '@placementos/types';

export const trainingScheduleKeys = {
  all: ['training-schedule'] as const,
  list: (opts: TrainingScheduleListOptions) => [...trainingScheduleKeys.all, 'list', opts] as const,
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
