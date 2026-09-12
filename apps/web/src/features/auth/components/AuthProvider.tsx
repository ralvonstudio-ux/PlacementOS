import { useState, useEffect, useCallback, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth.api';
import { resetAuthRefreshState, scheduleProactiveRefresh } from '@/services/api';
import { queryClient } from '@/lib/queryClient';
import { AuthContext } from '../context/AuthContext';
import type { AuthUser } from '@placementos/types';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Validate existing session on mount. Session lives in sessionStorage so each
  // browser tab has its own isolated token.
  useEffect(() => {
    const token = sessionStorage.getItem('accessToken');
    if (!token) {
      setIsLoading(false);
      return;
    }

    scheduleProactiveRefresh(token);

    authApi
      .me()
      .then((data) => setUser(data))
      .catch(() => {
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('sessionId');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (identifier: string, password: string): Promise<AuthUser> => {
    const data = await authApi.login({ identifier, password });
    queryClient.clear();
    sessionStorage.setItem('accessToken', data.accessToken);
    sessionStorage.setItem('sessionId', data.sessionId);
    scheduleProactiveRefresh(data.accessToken);
    const mergedUser: AuthUser = {
      ...data.user,
      mustResetPassword: data.mustResetPassword ?? data.user.mustResetPassword,
      mustResetPin: data.mustResetPin ?? data.user.mustResetPin,
    };
    setUser(mergedUser);
    return mergedUser;
  }, []);

  const refreshUser = useCallback(async (): Promise<void> => {
    const data = await authApi.me();
    setUser(data);
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    await authApi.logout();
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('sessionId');
    resetAuthRefreshState();
    queryClient.clear();
    setUser(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: user !== null,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
