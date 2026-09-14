import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { importApi, ImportSessionListOptions } from '../api/import.api';
import type { ImportType, DuplicateStrategy } from '@placementos/types';

export const importKeys = {
  all: ['import'] as const,
  templates: () => [...importKeys.all, 'templates'] as const,
  sessions: (opts: ImportSessionListOptions) => [...importKeys.all, 'sessions', opts] as const,
  session: (id: string) => [...importKeys.all, 'session', id] as const,
};

export const useImportTemplates = () =>
  useQuery({ queryKey: importKeys.templates(), queryFn: importApi.listTemplates, staleTime: Infinity });

export const useImportSessions = (opts: ImportSessionListOptions = {}) =>
  useQuery({ queryKey: importKeys.sessions(opts), queryFn: () => importApi.list(opts) });

export const useImportSession = (id: string | null) =>
  useQuery({
    queryKey: importKeys.session(id ?? ''),
    queryFn: () => importApi.getById(id!),
    enabled: !!id,
  });

export const useUploadImport = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ importType, file }: { importType: ImportType; file: File }) => importApi.upload(importType, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: importKeys.all }),
  });
};

export const useUpdateImportMapping = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, columnMapping }: { id: string; columnMapping: Record<string, string> }) => importApi.updateMapping(id, columnMapping),
    onSuccess: (session) => qc.setQueryData(importKeys.session(session._id), session),
  });
};

export const useSetDuplicateStrategy = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, duplicateStrategy }: { id: string; duplicateStrategy: DuplicateStrategy }) => importApi.setDuplicateStrategy(id, duplicateStrategy),
    onSuccess: (session) => qc.setQueryData(importKeys.session(session._id), session),
  });
};

export const useUpdateImportRow = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rowNumber, raw }: { id: string; rowNumber: number; raw: Record<string, string> }) => importApi.updateRow(id, rowNumber, raw),
    onSuccess: (session) => qc.setQueryData(importKeys.session(session._id), session),
  });
};

export const useDeleteImportRow = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rowNumber }: { id: string; rowNumber: number }) => importApi.deleteRow(id, rowNumber),
    onSuccess: (session) => qc.setQueryData(importKeys.session(session._id), session),
  });
};

export const useConfirmImport = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => importApi.confirm(id),
    onSuccess: (session) => {
      qc.setQueryData(importKeys.session(session._id), session);
      qc.invalidateQueries({ queryKey: importKeys.all });
    },
  });
};

export const useCancelImport = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => importApi.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: importKeys.all }),
  });
};

export const useRollbackImport = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => importApi.rollback(id),
    onSuccess: (session) => {
      qc.setQueryData(importKeys.session(session._id), session);
      qc.invalidateQueries({ queryKey: importKeys.all });
    },
  });
};
