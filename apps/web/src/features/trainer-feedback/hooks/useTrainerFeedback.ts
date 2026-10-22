import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trainerFeedbackApi } from '../api/trainer-feedback.api';
import type { CreateTrainerFeedbackPayload, TrainerFeedbackListFilters } from '@placementos/types';

export const trainerFeedbackKeys = {
  all: ['trainer-feedback'] as const,
  myTrainers: () => [...trainerFeedbackKeys.all, 'my-trainers'] as const,
  list: (filters: TrainerFeedbackListFilters) => [...trainerFeedbackKeys.all, 'list', filters] as const,
  overview: () => [...trainerFeedbackKeys.all, 'overview'] as const,
};

export const useMyTrainers = () =>
  useQuery({ queryKey: trainerFeedbackKeys.myTrainers(), queryFn: trainerFeedbackApi.myTrainers });

export const useSubmitTrainerFeedback = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTrainerFeedbackPayload) => trainerFeedbackApi.submit(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: trainerFeedbackKeys.all }),
  });
};

export const useTrainerFeedbackList = (filters: TrainerFeedbackListFilters) =>
  useQuery({ queryKey: trainerFeedbackKeys.list(filters), queryFn: () => trainerFeedbackApi.list(filters) });

export const useTrainerFeedbackOverview = () =>
  useQuery({ queryKey: trainerFeedbackKeys.overview(), queryFn: trainerFeedbackApi.overview });
