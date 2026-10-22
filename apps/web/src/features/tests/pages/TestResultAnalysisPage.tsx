import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ShieldAlert } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTestResultAnalysis } from '../hooks/useTests';
import { ResultReport } from '../components/ResultReport';

/** Staff view of one candidate's attempt — reached from the test's Review screen. */
export function TestResultAnalysisPage() {
  const { id, attemptId } = useParams<{ id: string; attemptId: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useTestResultAnalysis(id ?? null, attemptId ?? null);

  const back = (
    <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100" title="Back to review">
      <ChevronLeft className="w-5 h-5" />
    </button>
  );

  if (isLoading) return <div className="p-8 space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}</div>;
  if (!data) return <div className="p-8"><EmptyState icon={ShieldAlert} title="Not found" description="Couldn't load this attempt's result analysis." /></div>;
  return <ResultReport data={data} backAction={back} />;
}
