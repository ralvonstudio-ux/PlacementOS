import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { testsApi } from '../api/tests.api';
import type { CreateTestPayload, GenerateTestDraftPayload, ReviewTestPayload, SubmitAnswerPayload, LogViolationPayload } from '@placementos/types';

export const testKeys = {
  all: ['tests'] as const,
  list: (batch?: string) => [...testKeys.all, 'list', batch ?? ''] as const,
  review: (id: string) => [...testKeys.all, 'review', id] as const,
  mine: () => [...testKeys.all, 'mine'] as const,
};

export const useTestList = (batch?: string) =>
  useQuery({ queryKey: testKeys.list(batch), queryFn: () => testsApi.list(batch) });

export const useCreateTest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTestPayload) => testsApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: testKeys.all }),
  });
};

export const useGenerateTestDraft = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: GenerateTestDraftPayload) => testsApi.generateDraft(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: testKeys.all }),
  });
};

export const useUpdateTest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateTestPayload> }) => testsApi.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: testKeys.all }),
  });
};

export const useSubmitTestForApproval = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => testsApi.submitForApproval(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: testKeys.all }),
  });
};

export const useReviewTest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ReviewTestPayload }) => testsApi.review(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: testKeys.all }),
  });
};

export const usePublishTest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => testsApi.publish(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: testKeys.all }),
  });
};

export const useCloseTest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => testsApi.close(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: testKeys.all }),
  });
};

export const useDeleteTest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => testsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: testKeys.all }),
  });
};

export const useTestReview = (id: string | null) =>
  useQuery({ queryKey: testKeys.review(id ?? ''), queryFn: () => testsApi.getReview(id!), enabled: !!id });

export const useMyTests = () =>
  useQuery({ queryKey: testKeys.mine(), queryFn: testsApi.listMine });

export const useStartTest = () => useMutation({ mutationFn: (testId: string) => testsApi.start(testId) });

export const useSubmitTestAnswer = () =>
  useMutation({ mutationFn: ({ attemptId, payload }: { attemptId: string; payload: SubmitAnswerPayload }) => testsApi.submitAnswer(attemptId, payload) });

export const useLogTestViolation = () =>
  useMutation({ mutationFn: ({ attemptId, payload }: { attemptId: string; payload: LogViolationPayload }) => testsApi.logViolation(attemptId, payload) });

export const useSubmitTest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attemptId: string) => testsApi.submit(attemptId),
    onSuccess: () => qc.invalidateQueries({ queryKey: testKeys.mine() }),
  });
};
