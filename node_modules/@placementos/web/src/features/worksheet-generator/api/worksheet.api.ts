import { apiClient, extractErrorMessage } from '@/services/api';
import type {
  ApiResponse,
  PaginatedResponse,
  GenerateWorksheetPayload,
  WorksheetDraft,
  SaveWorksheetPayload,
  GeneratedWorksheet,
  WorksheetListOptions,
} from '@placementos/types';

const BASE = '/worksheet-generator';

export const worksheetApi = {
  async generate(payload: GenerateWorksheetPayload): Promise<WorksheetDraft> {
    try {
      const res = await apiClient.post<ApiResponse<WorksheetDraft>>(`${BASE}/generate`, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async save(payload: SaveWorksheetPayload): Promise<GeneratedWorksheet> {
    try {
      const res = await apiClient.post<ApiResponse<GeneratedWorksheet>>(BASE, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async list(opts: WorksheetListOptions = {}): Promise<PaginatedResponse<GeneratedWorksheet>> {
    try {
      const res = await apiClient.get<PaginatedResponse<GeneratedWorksheet>>(BASE, { params: opts });
      return res.data;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async getById(id: string): Promise<GeneratedWorksheet> {
    try {
      const res = await apiClient.get<ApiResponse<GeneratedWorksheet>>(`${BASE}/${id}`);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async remove(id: string): Promise<void> {
    try {
      await apiClient.delete(`${BASE}/${id}`);
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },
};
