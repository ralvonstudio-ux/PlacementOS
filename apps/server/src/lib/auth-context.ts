export interface AuthContext {
  userId: string;
  instituteId: string;
  displayName: string;
  role: string;
  ip?: string;
  userAgent?: string;
}

export const buildAuthContext = (
  user: {
    userId: string;
    instituteId: string;
    firstName: string;
    lastName: string;
    role: string;
  },
  ip?: string,
  userAgent?: string
): AuthContext => ({
  userId: user.userId,
  instituteId: user.instituteId,
  displayName: `${user.firstName} ${user.lastName}`,
  role: user.role,
  ip,
  userAgent,
});
