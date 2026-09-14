import type { UserRole } from '@placementos/types';

// Single source of truth for where each role lands after login.
export const getHomePathForRole = (role: UserRole): string => {
  if (role === 'faculty') return '/faculty';
  // Admin lands on its own dashboard (teacher accounts + trainer assignment),
  // but keeps full access to the TPO area too — every /tpo route allows 'admin'.
  if (role === 'admin') return '/admin';
  if (role === 'tpo') return '/tpo';
  if (role === 'candidate') return '/candidate';
  return '/login';
};
