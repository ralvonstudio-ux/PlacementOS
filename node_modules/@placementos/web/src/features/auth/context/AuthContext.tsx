import { createContext, useContext } from 'react';
import type { AuthUser } from '@placementos/types';

export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Accepts either an email or an admin-issued username. */
  login: (identifier: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  /** Re-fetches /auth/me. */
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuthContext = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used inside AuthProvider');
  return ctx;
};
