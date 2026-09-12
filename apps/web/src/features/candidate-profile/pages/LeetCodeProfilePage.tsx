import { useState, useEffect } from 'react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { useMyProfile, useSaveMyProfile, useMyLeetCodeStats } from '../hooks/useCandidateProfile';
import { LeetCodeStatsCard } from '../components/LeetCodeStatsCard';
import { extractErrorMessage } from '@/services/api';

export function LeetCodeProfilePage() {
  const { data: profile } = useMyProfile();
  const { mutateAsync: saveProfile, isPending: isSaving } = useSaveMyProfile();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const hasUsername = !!profile?.leetcodeUsername;
  const { data: stats, isLoading, isError, error: fetchError, refetch, isFetching } = useMyLeetCodeStats(hasUsername);

  useEffect(() => setUsername(profile?.leetcodeUsername ?? ''), [profile]);

  async function handleSaveUsername() {
    setError('');
    try {
      await saveProfile({ leetcodeUsername: username.trim() });
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <PageContainer narrow>
      <WorkspaceHeader title="LeetCode Profile" subtitle="Link your LeetCode account to track your solved-question stats" />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Your LeetCode username"
            className="flex-1 h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
          />
          <button
            onClick={handleSaveUsername}
            disabled={isSaving || !username.trim()}
            className="h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50 shrink-0"
          >
            Save
          </button>
        </div>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>

      {hasUsername && (
        <LeetCodeStatsCard
          username={profile?.leetcodeUsername ?? ''}
          stats={stats}
          isLoading={isLoading}
          isError={isError}
          errorMessage={extractErrorMessage(fetchError)}
          isFetching={isFetching}
          onRefresh={() => refetch()}
        />
      )}
    </PageContainer>
  );
}
