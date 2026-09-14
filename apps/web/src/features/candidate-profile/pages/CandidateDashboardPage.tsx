import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, MessageSquare, Users2, Calculator, Building2, BookMarked, ShieldCheck } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { ActionCard } from '@/components/ui/ActionCard';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useMyTests } from '@/features/tests/hooks/useTests';
import { useMyProfile, useMyLeetCodeStats, useSaveMyProfile } from '@/features/candidate-profile/hooks/useCandidateProfile';
import { LeetCodeStatsCard } from '@/features/candidate-profile/components/LeetCodeStatsCard';
import { extractErrorMessage } from '@/services/api';

export function CandidateDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: tests = [] } = useMyTests();
  const pendingTests = tests.filter((t) => t.attemptStatus !== 'submitted').length;
  const { data: profile } = useMyProfile();
  const hasLeetCode = !!profile?.leetcodeUsername;
  const { data: leetStats, isLoading: leetLoading, isError: leetError, error: leetFetchError, isFetching: leetFetching, refetch: refetchLeet } = useMyLeetCodeStats(hasLeetCode);

  const { mutateAsync: saveProfile, isPending: isSavingLeetCode } = useSaveMyProfile();
  const [leetUsername, setLeetUsername] = useState('');
  const [leetError2, setLeetError2] = useState('');
  const [editingLeetCode, setEditingLeetCode] = useState(false);

  useEffect(() => setLeetUsername(profile?.leetcodeUsername ?? ''), [profile]);

  async function handleSaveLeetCode() {
    setLeetError2('');
    try {
      await saveProfile({ leetcodeUsername: leetUsername.trim() });
      setEditingLeetCode(false);
    } catch (err) {
      setLeetError2(extractErrorMessage(err));
    }
  }

  return (
    <PageContainer>
      <WorkspaceHeader title={`Welcome${user ? `, ${user.firstName}` : ''}`} subtitle="Everything you need to get placement-ready" />

      <SectionTitle>LeetCode Progress</SectionTitle>
      {hasLeetCode && !editingLeetCode ? (
        <>
          <LeetCodeStatsCard
            username={profile.leetcodeUsername ?? ''}
            stats={leetStats}
            isLoading={leetLoading}
            isError={leetError}
            errorMessage={extractErrorMessage(leetFetchError)}
            isFetching={leetFetching}
            onRefresh={() => refetchLeet()}
            compact
          />
          <button
            onClick={() => setEditingLeetCode(true)}
            className="mt-2 text-xs font-medium text-violet-600 hover:text-violet-700"
          >
            Change LeetCode username
          </button>
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <p className="text-sm text-gray-500 mb-3">Link your LeetCode account to track your solved-question stats right here.</p>
          <div className="flex items-center gap-3">
            <input
              value={leetUsername}
              onChange={(e) => setLeetUsername(e.target.value)}
              placeholder="Your LeetCode username"
              className="flex-1 h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
            />
            <button
              onClick={handleSaveLeetCode}
              disabled={isSavingLeetCode || !leetUsername.trim()}
              className="h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50 shrink-0"
            >
              Save
            </button>
            {hasLeetCode && (
              <button onClick={() => setEditingLeetCode(false)} className="text-sm text-gray-400 hover:text-gray-600 shrink-0">
                Cancel
              </button>
            )}
          </div>
          {leetError2 && <p className="text-sm text-red-600 mt-2">{leetError2}</p>}
        </div>
      )}

      <SectionTitle className="mt-10">Get Started</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mb-2">
        <ActionCard icon={FileText} title="Resume" description="Upload your latest resume" accent="blue" onClick={() => navigate('/candidate/resume')} />
        <ActionCard icon={ShieldCheck} title="Tests" description="Proctored assessments" accent="rose" badge={pendingTests > 0 ? `${pendingTests} pending` : undefined} onClick={() => navigate('/candidate/tests')} />
        <ActionCard icon={BookMarked} title="Practice Sheets" description="Curated sheets for your batch" accent="emerald" onClick={() => navigate('/candidate/practice-sheets')} />
      </div>

      <SectionTitle className="mt-10">Interview Preparation</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ActionCard icon={MessageSquare} title="PI Questions" description="Personal interview practice" accent="purple" onClick={() => navigate('/candidate/practice/pi')} />
        <ActionCard icon={Users2} title="GD Questions" description="Group discussion topics" accent="amber" onClick={() => navigate('/candidate/practice/gd')} />
        <ActionCard icon={Calculator} title="Aptitude & Reasoning" description="Quant and logical reasoning" accent="green" onClick={() => navigate('/candidate/practice/aptitude')} />
        <ActionCard icon={Building2} title="Company Questions" description="Previously asked, by company" accent="blue" onClick={() => navigate('/candidate/practice/company')} />
      </div>
    </PageContainer>
  );
}
