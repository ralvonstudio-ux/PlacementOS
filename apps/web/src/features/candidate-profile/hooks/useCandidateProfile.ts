import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { candidateProfileApi } from '../api/candidate-profile.api';
import type { SaveCandidateProfilePayload } from '@placementos/types';

export const candidateProfileKeys = {
  all: ['candidate-profile'] as const,
  mine: () => [...candidateProfileKeys.all, 'mine'] as const,
  leetcode: () => [...candidateProfileKeys.all, 'leetcode'] as const,
};

export const useMyProfile = () =>
  useQuery({ queryKey: candidateProfileKeys.mine(), queryFn: candidateProfileApi.getMine });

export const useSaveMyProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveCandidateProfilePayload) => candidateProfileApi.saveMine(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: candidateProfileKeys.mine() }),
  });
};

export const useUploadResume = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => candidateProfileApi.uploadResume(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: candidateProfileKeys.mine() }),
  });
};

/** Polls every 30s while mounted + refetches on window focus, so the widget tracks new LeetCode submissions without a manual refresh. */
export const useMyLeetCodeStats = (enabled: boolean) =>
  useQuery({
    queryKey: candidateProfileKeys.leetcode(),
    queryFn: candidateProfileApi.getMyLeetCodeStats,
    enabled,
    retry: false,
    refetchInterval: enabled ? 30_000 : false,
    refetchOnWindowFocus: true,
  });
