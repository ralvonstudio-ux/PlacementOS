import { useNavigate } from 'react-router-dom';
import { FileText, MessageSquare, Users2, Calculator, Building2, BookMarked, Code2, ShieldCheck } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { ActionCard } from '@/components/ui/ActionCard';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useMyTests } from '@/features/tests/hooks/useTests';
import { useMyProfile, useMyLeetCodeStats } from '@/features/candidate-profile/hooks/useCandidateProfile';
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

  return (
    <PageContainer>
      <WorkspaceHeader title={`Welcome${user ? `, ${user.firstName}` : ''}`} subtitle="Everything you need to get placement-ready" />

      <SectionTitle>Get Started</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-2">
        <ActionCard icon={FileText} title="Resume" description="Build or upload your resume" accent="blue" onClick={() => navigate('/candidate/resume')} />
        <ActionCard icon={ShieldCheck} title="Tests" description="Proctored assessments" accent="rose" badge={pendingTests > 0 ? `${pendingTests} pending` : undefined} onClick={() => navigate('/candidate/tests')} />
        <ActionCard icon={BookMarked} title="Practice Sheets" description="Curated sheets for your batch" accent="emerald" onClick={() => navigate('/candidate/practice-sheets')} />
        <ActionCard icon={Code2} title="LeetCode Profile" description="Track your solved-question stats" accent="indigo" onClick={() => navigate('/candidate/leetcode')} />
      </div>

      {hasLeetCode && (
        <>
          <SectionTitle className="mt-10">LeetCode Progress</SectionTitle>
          <LeetCodeStatsCard
            username={profile.leetcodeUsername ?? ''}
            stats={leetStats}
            isLoading={leetLoading}
            isError={leetError}
            errorMessage={extractErrorMessage(leetFetchError)}
            isFetching={leetFetching}
            onRefresh={() => refetchLeet()}
          />
        </>
      )}

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
