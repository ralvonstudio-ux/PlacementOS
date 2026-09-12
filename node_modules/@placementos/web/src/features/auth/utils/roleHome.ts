import type { UserRole } from '@placementos/types';

// Single source of truth for where each role lands after login.
export const getHomePathForRole = (role: UserRole): string => {
  if (role === 'faculty') return '/faculty';
  // No dedicated admin portal exists yet — admins share the TPO area, which already
  // allows the 'admin' role on every one of its routes.
  if (role === 'tpo' || role === 'admin') return '/tpo';
  if (role === 'candidate') return '/candidate';
  return '/login';
};
