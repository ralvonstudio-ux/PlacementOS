import { apiClient, extractErrorMessage } from '@/services/api';
import type { ApiResponse, ExtractContentResult } from '@placementos/types';

const BASE = '/content-extraction';

export const contentExtractionApi = {
  /** Uploads a PDF or image and returns its transcribed text — shared by the Academic
   *  Plan, Worksheet, and Test creation flows so faculty can upload instead of pasting. */
  async extract(file: File): Promise<ExtractContentResult> {
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await apiClient.post<ApiResponse<ExtractContentResult>>(`${BASE}/extract`, form);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },
};
