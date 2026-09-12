import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { useAuth } from '@/features/auth/hooks/useAuth';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

export function FacultyProfilePage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <PageContainer narrow>
      <WorkspaceHeader title="My Profile" subtitle="Your account details" />
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        <Row label="Name" value={`${user.firstName} ${user.lastName}`} />
        <Row label="Email" value={user.email} />
        <Row label="Role" value="Faculty" />
      </div>
      <p className="text-sm text-gray-400 mt-4">To change contact details, ask your TPO to update your Faculty record.</p>
    </PageContainer>
  );
}
