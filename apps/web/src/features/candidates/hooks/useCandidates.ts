import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { candidatesApi, CandidateListOptions, CreateCandidatePayload } from '../api/candidates.api';
import type { CreateCandidateLoginPayload } from '@placementos/types';

export const candidateKeys = {
  all: ['candidates'] as const,
  list: (opts: CandidateListOptions) => [...candidateKeys.all, 'list', opts] as const,
};

export const useCandidateList = (opts: CandidateListOptions = {}) =>
  useQuery({ queryKey: candidateKeys.list(opts), queryFn: () => candidatesApi.list(opts) });

export const useCreateCandidate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCandidatePayload) => candidatesApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: candidateKeys.all }),
  });
};

export const useUpdateCandidate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateCandidatePayload> }) => candidatesApi.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: candidateKeys.all }),
  });
};

export const useDeleteCandidate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => candidatesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: candidateKeys.all }),
  });
};

export const useUpdateFacultyNote = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, facultyNote }: { id: string; facultyNote: string }) => candidatesApi.updateFacultyNote(id, facultyNote),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: candidateKeys.all });
      // Also refreshes BatchAttendancePage/BatchRosterPage's roster query, which is
      // keyed separately under 'attendance' since it fetches via listByBatch.
      qc.invalidateQueries({ queryKey: ['attendance', 'batch-candidates'] });
    },
  });
};

export const useCreateCandidateLogin = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CreateCandidateLoginPayload }) => candidatesApi.createLogin(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: candidateKeys.all }),
  });
};
