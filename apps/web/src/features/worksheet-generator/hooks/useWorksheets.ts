import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { worksheetApi } from '../api/worksheet.api';
import type {
  GenerateWorksheetPayload, GenerateWorksheetFromContentPayload, SaveWorksheetPayload,
  WorksheetListOptions, UpdateWorksheetPayload, GeneratedWorksheetType,
} from '@placementos/types';

export const worksheetKeys = {
  all: ['worksheets'] as const,
  list: (opts: WorksheetListOptions) => [...worksheetKeys.all, 'list', opts] as const,
  detail: (id: string) => [...worksheetKeys.all, 'detail', id] as const,
  mine: () => [...worksheetKeys.all, 'mine'] as const,
  mineDetail: (id: string) => [...worksheetKeys.all, 'mine', id] as const,
};

export const useWorksheetList = (opts: WorksheetListOptions = {}) =>
  useQuery({ queryKey: worksheetKeys.list(opts), queryFn: () => worksheetApi.list(opts) });

export const useWorksheet = (id: string) =>
  useQuery({ queryKey: worksheetKeys.detail(id), queryFn: () => worksheetApi.getById(id), enabled: !!id });

export const useGenerateWorksheet = () =>
  useMutation({ mutationFn: (payload: GenerateWorksheetPayload) => worksheetApi.generate(payload) });

export const useGenerateWorksheetFromContent = () =>
  useMutation({ mutationFn: (payload: GenerateWorksheetFromContentPayload) => worksheetApi.generateFromContent(payload) });

export const useSaveWorksheet = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveWorksheetPayload) => worksheetApi.save(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: worksheetKeys.all }),
  });
};

export const useDeleteWorksheet = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => worksheetApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: worksheetKeys.all }),
  });
};

export const useUpdateWorksheet = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateWorksheetPayload) => worksheetApi.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: worksheetKeys.all }),
  });
};

export const useUploadWorksheetAttachment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { file: File; batch: string; track: string; title: string; worksheetType: GeneratedWorksheetType }) =>
      worksheetApi.uploadAttachment(params),
    onSuccess: () => qc.invalidateQueries({ queryKey: worksheetKeys.all }),
  });
};

// ── Candidate-facing ──────────────────────────────────────────────────────

export const useMyWorksheets = () =>
  useQuery({ queryKey: worksheetKeys.mine(), queryFn: () => worksheetApi.listMine() });

export const useMyWorksheet = (id: string) =>
  useQuery({ queryKey: worksheetKeys.mineDetail(id), queryFn: () => worksheetApi.getMineById(id), enabled: !!id });
