import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { academicPlanApi } from '../api/academic-plan.api';
import type { GenerateAcademicPlanPayload, EditAcademicPlanSessionPayload, AddAcademicPlanSessionPayload } from '@placementos/types';

export const academicPlanKeys = {
  all: ['academic-plan'] as const,
  detail: (batch: string, track: string) => [...academicPlanKeys.all, batch, track] as const,
};

export const useAcademicPlan = (batch: string, track: string) =>
  useQuery({
    queryKey: academicPlanKeys.detail(batch, track),
    queryFn: () => academicPlanApi.get(batch, track),
    enabled: !!batch && !!track,
  });

export const useGenerateAcademicPlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: GenerateAcademicPlanPayload) => academicPlanApi.generate(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: academicPlanKeys.all }),
  });
};

export const useEditAcademicPlanSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, payload }: { planId: string; payload: EditAcademicPlanSessionPayload }) => academicPlanApi.editSession(planId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: academicPlanKeys.all }),
  });
};

export const useAddAcademicPlanSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, payload }: { planId: string; payload: AddAcademicPlanSessionPayload }) => academicPlanApi.addSession(planId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: academicPlanKeys.all }),
  });
};

export const useDeleteAcademicPlanSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, lectureNumber }: { planId: string; lectureNumber: number }) => academicPlanApi.deleteSession(planId, lectureNumber),
    onSuccess: () => qc.invalidateQueries({ queryKey: academicPlanKeys.all }),
  });
};

export const useDeleteAcademicPlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) => academicPlanApi.remove(planId),
    onSuccess: () => qc.invalidateQueries({ queryKey: academicPlanKeys.all }),
  });
};
