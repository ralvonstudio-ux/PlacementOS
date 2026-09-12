import { Library } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useQuestionBankTpoOverview } from '../hooks/useQuestionBank';

export function TpoQuestionBankOverviewPage() {
  const { data: overview = [], isLoading } = useQuestionBankTpoOverview();

  return (
    <PageContainer>
      <WorkspaceHeader title="Question Bank Overview" subtitle="Which batch/track has generated what questions and papers" />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}
          </div>
        ) : overview.length === 0 ? (
          <EmptyState icon={Library} title="No material yet" description="Once faculty add questions or generate papers, this overview fills in." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3">Batch</th>
                <th className="px-5 py-3">Track</th>
                <th className="px-5 py-3">Trainer</th>
                <th className="px-5 py-3 text-right">Questions</th>
                <th className="px-5 py-3 text-right">Papers</th>
                <th className="px-5 py-3 text-right">Last Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {overview.map((row) => (
                <tr key={`${row.batch}-${row.track}`}>
                  <td className="px-5 py-3 font-medium text-gray-900">{row.batch}</td>
                  <td className="px-5 py-3 text-gray-600">{row.track}</td>
                  <td className="px-5 py-3 text-gray-600">{row.facultyName}</td>
                  <td className="px-5 py-3 text-right text-gray-700 font-semibold">{row.questionCount}</td>
                  <td className="px-5 py-3 text-right text-gray-700 font-semibold">{row.paperCount}</td>
                  <td className="px-5 py-3 text-right text-gray-400 text-xs">
                    {row.lastActivityAt ? new Date(row.lastActivityAt).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PageContainer>
  );
}
