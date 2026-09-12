import type { UserRole } from '@placementos/types';

// Single source of truth for where each role lands after login.
export const getHomePathForRole = (role: UserRole): string => {
  if (role === 'faculty') return '/faculty';
  if (role === 'tpo') return '/tpo';
  return '/login';
};
