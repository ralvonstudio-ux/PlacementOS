import { apiClient, extractErrorMessage } from '@/services/api';
import type { ApiResponse, PaginatedResponse, ImportSession, ImportType, ImportTemplates, DuplicateStrategy } from '@placementos/types';

const BASE = '/import';

export interface ImportSessionListOptions {
  importType?: ImportType;
  status?: string;
  page?: number;
  limit?: number;
}

export const importApi = {
  async listTemplates(): Promise<ImportTemplates> {
    try {
      const res = await apiClient.get<ApiResponse<ImportTemplates>>(`${BASE}/templates`);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async upload(importType: ImportType, file: File): Promise<ImportSession> {
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('importType', importType);
      const res = await apiClient.post<ApiResponse<ImportSession>>(`${BASE}/sessions`, form);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async list(opts: ImportSessionListOptions = {}): Promise<PaginatedResponse<ImportSession>> {
    try {
      const res = await apiClient.get<PaginatedResponse<ImportSession>>(`${BASE}/sessions`, { params: opts });
      return res.data;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async getById(id: string): Promise<ImportSession> {
    try {
      const res = await apiClient.get<ApiResponse<ImportSession>>(`${BASE}/sessions/${id}`);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async updateMapping(id: string, columnMapping: Record<string, string>): Promise<ImportSession> {
    try {
      const res = await apiClient.patch<ApiResponse<ImportSession>>(`${BASE}/sessions/${id}/mapping`, { columnMapping });
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async setDuplicateStrategy(id: string, duplicateStrategy: DuplicateStrategy): Promise<ImportSession> {
    try {
      const res = await apiClient.patch<ApiResponse<ImportSession>>(`${BASE}/sessions/${id}/duplicates`, { duplicateStrategy });
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async updateRow(id: string, rowNumber: number, raw: Record<string, string>): Promise<ImportSession> {
    try {
      const res = await apiClient.patch<ApiResponse<ImportSession>>(`${BASE}/sessions/${id}/rows/${rowNumber}`, { raw });
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async deleteRow(id: string, rowNumber: number): Promise<ImportSession> {
    try {
      const res = await apiClient.delete<ApiResponse<ImportSession>>(`${BASE}/sessions/${id}/rows/${rowNumber}`);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async confirm(id: string): Promise<ImportSession> {
    try {
      const res = await apiClient.post<ApiResponse<ImportSession>>(`${BASE}/sessions/${id}/confirm`);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async cancel(id: string): Promise<void> {
    try {
      await apiClient.post(`${BASE}/sessions/${id}/cancel`);
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async rollback(id: string): Promise<ImportSession> {
    try {
      const res = await apiClient.post<ApiResponse<ImportSession>>(`${BASE}/sessions/${id}/rollback`);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },
};
