import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { worksheetApi } from '../api/worksheet.api';
import type { GenerateWorksheetPayload, GenerateWorksheetFromContentPayload, SaveWorksheetPayload, WorksheetListOptions } from '@placementos/types';

export const worksheetKeys = {
  all: ['worksheets'] as const,
  list: (opts: WorksheetListOptions) => [...worksheetKeys.all, 'list', opts] as const,
  detail: (id: string) => [...worksheetKeys.all, 'detail', id] as const,
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
