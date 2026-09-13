import { apiClient, extractErrorMessage } from '@/services/api';
import type { ApiResponse, PaginatedResponse, Faculty, FacultyEmploymentStatus, FacultyGender } from '@placementos/types';

const BASE = '/faculty';

export interface FacultyListOptions {
  page?: number;
  limit?: number;
  search?: string;
  track?: string;
  batch?: string;
}

export interface CreateFacultyPayload {
  fullName: string;
  gender: FacultyGender;
  dateOfBirth?: string;
  employeeId: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  department?: string;
  tracks?: string[];
  assignedBatches?: string[];
  experienceYears?: number;
  joiningDate?: string;
  remarks?: string;
}

export interface CreateFacultyLoginPayload {
  loginEmail: string;
  password: string;
}

export const adminFacultyApi = {
  async list(opts: FacultyListOptions = {}): Promise<PaginatedResponse<Faculty>> {
    try {
      const res = await apiClient.get<PaginatedResponse<Faculty>>(BASE, { params: opts });
      return res.data;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  },

  async create(payload: CreateFacultyPayload): Promise<Faculty> {
    try {
      const res = await apiClient.post<ApiResponse<Faculty>>(BASE, payload);
      return res.data.data!;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  },

  async update(id: string, payload: Partial<CreateFacultyPayload>): Promise<Faculty> {
    try {
      const res = await apiClient.patch<ApiResponse<Faculty>>(`${BASE}/${id}`, payload);
      return res.data.data!;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  },

  async changeStatus(id: string, employmentStatus: FacultyEmploymentStatus): Promise<Faculty> {
    try {
      const res = await apiClient.patch<ApiResponse<Faculty>>(`${BASE}/${id}/status`, { employmentStatus });
      return res.data.data!;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  },

  async remove(id: string): Promise<void> {
    try {
      await apiClient.delete(`${BASE}/${id}`);
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  },

  async createLogin(id: string, payload: CreateFacultyLoginPayload): Promise<{ email: string }> {
    try {
      const res = await apiClient.post<ApiResponse<{ email: string }>>(`${BASE}/${id}/login`, payload);
      return res.data.data!;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  },
};
