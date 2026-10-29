import { apiClient, extractErrorMessage, ApiError } from '@/services/api';
import type { ApiResponse, LoginPayload, LoginResponse, AuthUser, ChangePasswordPayload, UpdateMePayload } from '@placementos/types';

export const authApi = {
  /** Emails a 6-digit reset code; resolves the same whether or not the account exists. */
  async forgotPassword(identifier: string): Promise<void> {
    try {
      await apiClient.post('/auth/forgot-password', { identifier });
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  },

  async resetPassword(payload: { identifier: string; code: string; newPassword: string }): Promise<void> {
    try {
      await apiClient.post('/auth/reset-password', payload);
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  },

  async login(payload: LoginPayload): Promise<LoginResponse> {
    try {
      const res = await apiClient.post<ApiResponse<LoginResponse>>('/auth/login', payload);
      return res.data.data!;
    } catch (err) {
      throw new ApiError(err);
    }
  },

  // Note: the actual token-refresh-on-401 flow lives in services/api.ts's
  // performRefresh (it rotates the stored refresh token) — this method isn't
  // currently called anywhere, kept only in case a caller needs it.
  async refresh(): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const res = await apiClient.post<ApiResponse<{ accessToken: string; refreshToken: string }>>('/auth/refresh', {
        refreshToken: sessionStorage.getItem('refreshToken'),
        sessionId: sessionStorage.getItem('sessionId'),
      });
      return res.data.data!;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Silently ignore — local state cleared regardless
    }
  },

  async me(): Promise<AuthUser> {
    try {
      const res = await apiClient.get<ApiResponse<AuthUser>>('/auth/me');
      return res.data.data!;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  },

  async changePassword(payload: ChangePasswordPayload): Promise<void> {
    try {
      await apiClient.post('/auth/change-password', payload);
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  },

  async updateMe(payload: UpdateMePayload): Promise<AuthUser> {
    try {
      const res = await apiClient.patch<ApiResponse<AuthUser>>('/auth/me', payload);
      return res.data.data!;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  },
};
