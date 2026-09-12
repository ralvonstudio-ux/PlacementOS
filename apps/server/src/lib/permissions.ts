import type { UserRole } from '@placementos/types';

export const PERMISSIONS = {
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  CANDIDATES_VIEW: 'candidates.view',
  CANDIDATES_MANAGE: 'candidates.manage',
  FACULTY_MANAGE: 'faculty.manage',
  ATTENDANCE_MARK: 'attendance.mark',
  ATTENDANCE_VIEW: 'attendance.view',
  LEAVE_APPLY: 'leave.apply',
  LEAVE_APPROVE: 'leave.approve',
  TRAINING_SCHEDULE_MANAGE: 'training-schedule.manage',
  TRAINING_PLAN_MANAGE: 'training-plan.manage',
  QUESTION_BANK_MANAGE: 'question-bank.manage',
  QUESTION_BANK_VIEW: 'question-bank.view',
  WORKSHEET_GENERATE: 'worksheet.generate',
  TPO_OVERVIEW_VIEW: 'tpo.overview.view',
  RESUME_MANAGE: 'resume.manage',
  PRACTICE_VIEW: 'practice.view',
  PRACTICE_MANAGE: 'practice.manage',
  TEST_TAKE: 'test.take',
  TEST_MANAGE: 'test.manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  admin: Object.values(PERMISSIONS) as Permission[],
  tpo: Object.values(PERMISSIONS) as Permission[],
  faculty: [
    PERMISSIONS.CANDIDATES_VIEW,
    PERMISSIONS.ATTENDANCE_MARK,
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.LEAVE_APPLY,
    PERMISSIONS.TRAINING_PLAN_MANAGE,
    PERMISSIONS.QUESTION_BANK_MANAGE,
    PERMISSIONS.QUESTION_BANK_VIEW,
    PERMISSIONS.WORKSHEET_GENERATE,
    PERMISSIONS.PRACTICE_MANAGE,
    PERMISSIONS.TEST_MANAGE,
  ],
  candidate: [
    PERMISSIONS.RESUME_MANAGE,
    PERMISSIONS.PRACTICE_VIEW,
    PERMISSIONS.TEST_TAKE,
  ],
};

export const ROLE_META: Record<UserRole, { label: string; description: string }> = {
  admin: { label: 'Administrator', description: 'Full access to all system features' },
  tpo: { label: 'Training & Placement Officer', description: 'Institute-wide oversight — training schedule, attendance, leave approvals, and staff' },
  faculty: { label: 'Faculty', description: 'Manage assigned batches — attendance, training plan, question bank, worksheets' },
  candidate: { label: 'Candidate', description: 'Resume, interview/aptitude practice, and proctored tests' },
};

export const PERMISSION_META: Record<Permission, { label: string; category: string }> = {
  [PERMISSIONS.USERS_VIEW]: { label: 'View users', category: 'Users' },
  [PERMISSIONS.USERS_CREATE]: { label: 'Create users', category: 'Users' },
  [PERMISSIONS.USERS_UPDATE]: { label: 'Update users', category: 'Users' },
  [PERMISSIONS.CANDIDATES_VIEW]: { label: 'View candidates', category: 'Candidates' },
  [PERMISSIONS.CANDIDATES_MANAGE]: { label: 'Manage candidates', category: 'Candidates' },
  [PERMISSIONS.FACULTY_MANAGE]: { label: 'Manage faculty', category: 'Faculty' },
  [PERMISSIONS.ATTENDANCE_MARK]: { label: 'Mark attendance', category: 'Attendance' },
  [PERMISSIONS.ATTENDANCE_VIEW]: { label: 'View attendance', category: 'Attendance' },
  [PERMISSIONS.LEAVE_APPLY]: { label: 'Apply for leave', category: 'Leave' },
  [PERMISSIONS.LEAVE_APPROVE]: { label: 'Approve leave', category: 'Leave' },
  [PERMISSIONS.TRAINING_SCHEDULE_MANAGE]: { label: 'Manage training schedule', category: 'Training Schedule' },
  [PERMISSIONS.TRAINING_PLAN_MANAGE]: { label: 'Manage training plan', category: 'Training Plan' },
  [PERMISSIONS.QUESTION_BANK_MANAGE]: { label: 'Manage question bank', category: 'Question Bank' },
  [PERMISSIONS.QUESTION_BANK_VIEW]: { label: 'View question bank', category: 'Question Bank' },
  [PERMISSIONS.WORKSHEET_GENERATE]: { label: 'Generate worksheets', category: 'Worksheet Generator' },
  [PERMISSIONS.TPO_OVERVIEW_VIEW]: { label: 'View TPO overview', category: 'TPO' },
  [PERMISSIONS.RESUME_MANAGE]: { label: 'Manage own resume', category: 'Candidate Portal' },
  [PERMISSIONS.PRACTICE_VIEW]: { label: 'View practice library', category: 'Candidate Portal' },
  [PERMISSIONS.PRACTICE_MANAGE]: { label: 'Manage practice library', category: 'Candidate Portal' },
  [PERMISSIONS.TEST_TAKE]: { label: 'Take a proctored test', category: 'Candidate Portal' },
  [PERMISSIONS.TEST_MANAGE]: { label: 'Create and review proctored tests', category: 'Candidate Portal' },
};

export const hasPermission = (role: UserRole, permission: Permission): boolean =>
  ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
