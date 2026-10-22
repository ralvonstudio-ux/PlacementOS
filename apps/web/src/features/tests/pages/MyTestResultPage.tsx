import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ShieldAlert } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { useMyTestResult } from '../hooks/useTests';
import { ResultReport } from '../components/ResultReport';

/** A candidate's own Result & Analysis for a test they've submitted. */
export function MyTestResultPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useMyTestResult(assignmentId ?? null);

  const back = (
    <button onClick={() => navigate('/candidate/tests')} className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100" title="Back to tests">
      <ChevronLeft className="w-5 h-5" />
    </button>
  );

  if (isLoading) return <div className="p-8 space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}</div>;
  if (!data) return <div className="p-8"><EmptyState icon={ShieldAlert} title="Result not available" description={error instanceof Error ? error.message : "Couldn't load your result."} /></div>;
  return <ResultReport data={data} backAction={back} />;
}
