import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { practiceApi } from '../api/practice.api';
import type { CreatePracticeQuestionPayload, UpdatePracticeQuestionPayload, PracticeQuestionListOptions, CreatePracticeSheetPayload } from '@placementos/types';

export const practiceKeys = {
  all: ['practice'] as const,
  questions: (opts: PracticeQuestionListOptions) => [...practiceKeys.all, 'questions', opts] as const,
  companies: () => [...practiceKeys.all, 'companies'] as const,
  sheets: () => [...practiceKeys.all, 'sheets'] as const,
  mySheets: () => [...practiceKeys.all, 'my-sheets'] as const,
  mySheetQuestions: (id: string) => [...practiceKeys.all, 'my-sheets', id] as const,
};

export const usePracticeQuestions = (opts: PracticeQuestionListOptions = {}) =>
  useQuery({ queryKey: practiceKeys.questions(opts), queryFn: () => practiceApi.listQuestions(opts) });

export const usePracticeCompanies = () =>
  useQuery({ queryKey: practiceKeys.companies(), queryFn: practiceApi.listCompanies });

export const useCreatePracticeQuestion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePracticeQuestionPayload) => practiceApi.createQuestion(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: practiceKeys.all }),
  });
};

export const useUpdatePracticeQuestion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePracticeQuestionPayload }) => practiceApi.updateQuestion(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: practiceKeys.all }),
  });
};

export const useDeletePracticeQuestion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => practiceApi.deleteQuestion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: practiceKeys.all }),
  });
};

export const usePracticeSheets = () =>
  useQuery({ queryKey: practiceKeys.sheets(), queryFn: practiceApi.listSheets });

export const useCreatePracticeSheet = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePracticeSheetPayload) => practiceApi.createSheet(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: practiceKeys.sheets() }),
  });
};

export const useDeletePracticeSheet = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => practiceApi.deleteSheet(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: practiceKeys.sheets() }),
  });
};

export const useMyPracticeSheets = () =>
  useQuery({ queryKey: practiceKeys.mySheets(), queryFn: practiceApi.listMySheets });

export const useMySheetQuestions = (sheetId: string | null) =>
  useQuery({
    queryKey: practiceKeys.mySheetQuestions(sheetId ?? ''),
    queryFn: () => practiceApi.getMySheetQuestions(sheetId!),
    enabled: !!sheetId,
  });
