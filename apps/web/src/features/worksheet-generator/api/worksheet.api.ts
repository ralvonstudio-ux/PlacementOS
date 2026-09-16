import { apiClient, extractErrorMessage } from '@/services/api';
import type {
  ApiResponse,
  PaginatedResponse,
  GenerateWorksheetPayload,
  GenerateWorksheetFromContentPayload,
  WorksheetDraft,
  WorksheetFromContentDraft,
  SaveWorksheetPayload,
  GeneratedWorksheet,
  WorksheetListOptions,
  UpdateWorksheetPayload,
  GeneratedWorksheetType,
} from '@placementos/types';

const BASE = '/worksheet-generator';

export const worksheetApi = {
  async generate(payload: GenerateWorksheetPayload): Promise<WorksheetDraft> {
    try {
      const res = await apiClient.post<ApiResponse<WorksheetDraft>>(`${BASE}/generate`, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async generateFromContent(payload: GenerateWorksheetFromContentPayload): Promise<WorksheetFromContentDraft> {
    try {
      const res = await apiClient.post<ApiResponse<WorksheetFromContentDraft>>(`${BASE}/generate-from-content`, payload);
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

  async update(id: string, payload: UpdateWorksheetPayload): Promise<GeneratedWorksheet> {
    try {
      const res = await apiClient.patch<ApiResponse<GeneratedWorksheet>>(`${BASE}/${id}`, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  /** Uploads an existing worksheet (photo/PDF) as-is — no AI involved, just attached and saved. */
  async uploadAttachment(params: { file: File; batch: string; track: string; title: string; worksheetType: GeneratedWorksheetType }): Promise<GeneratedWorksheet> {
    try {
      const form = new FormData();
      form.append('file', params.file);
      form.append('batch', params.batch);
      form.append('track', params.track);
      form.append('title', params.title);
      form.append('worksheetType', params.worksheetType);
      const res = await apiClient.post<ApiResponse<GeneratedWorksheet>>(`${BASE}/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  /** Candidate-facing — every worksheet saved for their own batch. */
  async listMine(): Promise<GeneratedWorksheet[]> {
    try {
      const res = await apiClient.get<ApiResponse<GeneratedWorksheet[]>>(`${BASE}/my`);
      return res.data.data ?? [];
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async getMineById(id: string): Promise<GeneratedWorksheet> {
    try {
      const res = await apiClient.get<ApiResponse<GeneratedWorksheet>>(`${BASE}/my/${id}`);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },
};
