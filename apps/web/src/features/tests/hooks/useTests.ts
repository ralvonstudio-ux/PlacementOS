import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { testsApi } from '../api/tests.api';
import type {
  CreateTestPayload,
  CreateAssignmentPayload,
  StartTestPayload,
  SendAccessCodePayload,
  GenerateTestDraftPayload,
  ReviewTestPayload,
  SubmitAnswerPayload,
  LogViolationPayload,
  RunCodePayload,
} from '@placementos/types';

export const testKeys = {
  all: ['tests'] as const,
  list: () => [...testKeys.all, 'list'] as const,
  review: (id: string) => [...testKeys.all, 'review', id] as const,
  mine: () => [...testKeys.all, 'mine'] as const,
  assignments: (testId: string) => [...testKeys.all, 'assignments', testId] as const,
  allAssignments: () => [...testKeys.all, 'assignments', 'all'] as const,
};

export const useTestList = () =>
  useQuery({ queryKey: testKeys.list(), queryFn: () => testsApi.list() });

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

export const useCreateAssignment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ testId, payload }: { testId: string; payload: CreateAssignmentPayload }) => testsApi.createAssignment(testId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: testKeys.all }),
  });
};

export const useAssignments = (testId: string) =>
  useQuery({ queryKey: testKeys.assignments(testId), queryFn: () => testsApi.listAssignments(testId), enabled: !!testId });

export const useAllAssignments = () =>
  useQuery({ queryKey: testKeys.allAssignments(), queryFn: () => testsApi.listAllAssignments() });

export const useSendAccessCode = () =>
  useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SendAccessCodePayload }) => testsApi.sendAssignmentAccessCode(id, payload),
  });

export const useCloseAssignment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: string) => testsApi.closeAssignment(assignmentId),
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

export const useStartTest = () =>
  useMutation({ mutationFn: ({ assignmentId, payload }: { assignmentId: string; payload: StartTestPayload }) => testsApi.start(assignmentId, payload) });

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

export const useRunCode = () =>
  useMutation({
    mutationFn: ({ attemptId, questionIndex, payload }: { attemptId: string; questionIndex: number; payload: RunCodePayload }) =>
      testsApi.runCode(attemptId, questionIndex, payload),
  });
