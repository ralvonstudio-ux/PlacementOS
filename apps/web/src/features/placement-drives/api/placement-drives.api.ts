import { apiClient, extractErrorMessage } from '@/services/api';
import type {
  ApiResponse,
  PlacementDrive,
  PlacementDriveDetail,
  CreatePlacementDrivePayload,
  SetDriveStatusPayload,
  RecordRoundResultPayload,
  SetApplicationStatusPayload,
  PlacementStats,
  DriveForCandidate,
} from '@placementos/types';

const BASE = '/placement-drives';

async function call<T>(fn: () => Promise<{ data: ApiResponse<T> }>): Promise<T> {
  try {
    const res = await fn();
    return res.data.data as T;
  } catch (err) { throw new Error(extractErrorMessage(err)); }
}

export const placementDrivesApi = {
  // ── TPO / admin ────────────────────────────────────────────────────────────
  list: () => call<PlacementDrive[]>(() => apiClient.get(BASE)),
  get: (id: string) => call<PlacementDriveDetail>(() => apiClient.get(`${BASE}/${id}`)),
  create: (payload: CreatePlacementDrivePayload) => call<PlacementDrive>(() => apiClient.post(BASE, payload)),
  update: (id: string, payload: Partial<CreatePlacementDrivePayload>) => call<PlacementDriveDetail>(() => apiClient.patch(`${BASE}/${id}`, payload)),
  remove: (id: string) => call<null>(() => apiClient.delete(`${BASE}/${id}`)),
  setStatus: (id: string, payload: SetDriveStatusPayload) => call<PlacementDriveDetail>(() => apiClient.patch(`${BASE}/${id}/status`, payload)),
  recordRoundResult: (id: string, payload: RecordRoundResultPayload) => call<PlacementDriveDetail>(() => apiClient.post(`${BASE}/${id}/round-results`, payload)),
  setApplicationStatus: (id: string, payload: SetApplicationStatusPayload) => call<PlacementDriveDetail>(() => apiClient.post(`${BASE}/${id}/applications/status`, payload)),
  stats: (placementYear?: string) => call<PlacementStats>(() => apiClient.get(`${BASE}/stats`, { params: placementYear ? { placementYear } : {} })),

  // ── Candidate ──────────────────────────────────────────────────────────────
  listMine: () => call<DriveForCandidate[]>(() => apiClient.get(`${BASE}/mine`)),
  apply: (id: string) => call<null>(() => apiClient.post(`${BASE}/${id}/apply`)),
  withdraw: (id: string) => call<null>(() => apiClient.post(`${BASE}/${id}/withdraw`)),
};
