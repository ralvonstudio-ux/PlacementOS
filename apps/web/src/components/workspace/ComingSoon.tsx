import { Construction } from 'lucide-react';
import { PageContainer } from './PageContainer';
import { WorkspaceHeader } from './WorkspaceHeader';

interface Props {
  title: string;
  subtitle?: string;
}

/** Placeholder for a feature area whose page hasn't been built out yet — keeps every nav link
 *  navigable (no dead routes) while that page's real UI is still in progress. */
export function ComingSoon({ title, subtitle }: Props) {
  return (
    <PageContainer>
      <WorkspaceHeader title={title} subtitle={subtitle} />
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-24 px-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mb-5">
          <Construction className="w-8 h-8 text-violet-400" strokeWidth={1.5} />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1.5">Coming soon</h3>
        <p className="text-sm text-gray-500 max-w-sm">This screen is still being built. Check back shortly.</p>
      </div>
    </PageContainer>
  );
}
