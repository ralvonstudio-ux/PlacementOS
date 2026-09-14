import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminFacultyApi, FacultyListOptions, CreateFacultyPayload, CreateFacultyLoginPayload } from '../api/faculty.api';
import type { FacultyEmploymentStatus } from '@placementos/types';

export const adminFacultyKeys = {
  all: ['admin-faculty'] as const,
  list: (opts: FacultyListOptions) => [...adminFacultyKeys.all, 'list', opts] as const,
};

export const useAdminFacultyList = (opts: FacultyListOptions = {}) =>
  useQuery({ queryKey: adminFacultyKeys.list(opts), queryFn: () => adminFacultyApi.list(opts) });

export const useCreateFaculty = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateFacultyPayload) => adminFacultyApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminFacultyKeys.all }),
  });
};

export const useUpdateFaculty = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateFacultyPayload> }) => adminFacultyApi.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminFacultyKeys.all }),
  });
};

export const useChangeFacultyStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, employmentStatus }: { id: string; employmentStatus: FacultyEmploymentStatus }) =>
      adminFacultyApi.changeStatus(id, employmentStatus),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminFacultyKeys.all }),
  });
};

export const useDeleteFaculty = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminFacultyApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminFacultyKeys.all }),
  });
};

export const useCreateFacultyLogin = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CreateFacultyLoginPayload }) => adminFacultyApi.createLogin(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminFacultyKeys.all }),
  });
};
