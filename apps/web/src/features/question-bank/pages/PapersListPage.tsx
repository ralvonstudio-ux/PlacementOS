import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Trash2 } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useMyBatchTracks } from '@/features/training-schedule/hooks/useTrainingSchedule';
import { usePapers, useDeletePaper } from '../hooks/useQuestionBank';

export function PapersListPage() {
  const navigate = useNavigate();
  const { batchTracks } = useMyBatchTracks();
  const [selected, setSelected] = useState<{ batch: string; track: string } | null>(null);

  useEffect(() => {
    if (!selected && batchTracks.length > 0) setSelected(batchTracks[0]);
  }, [batchTracks, selected]);

  const { data: papers = [], isLoading } = usePapers(selected?.batch, selected?.track);
  const { mutate: deletePaper } = useDeletePaper();

  return (
    <PageContainer>
      <WorkspaceHeader
        title="Question Papers"
        subtitle="Papers generated for your batches"
        action={
          <button
            onClick={() => navigate(`/faculty/question-bank/papers/generate${selected ? `?batch=${encodeURIComponent(selected.batch)}&track=${encodeURIComponent(selected.track)}` : ''}`)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors"
          >
            <Plus className="w-4 h-4" />
            Generate Paper
          </button>
        }
      />

      {batchTracks.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {batchTracks.map((bt) => (
            <button
              key={`${bt.batch}-${bt.track}`}
              onClick={() => setSelected(bt)}
              className={`h-9 px-4 rounded-full text-sm font-medium border transition-colors ${
                selected?.batch === bt.batch && selected?.track === bt.track ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-violet-300'
              }`}
            >
              {bt.batch} · {bt.track}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl" />)}
          </div>
        ) : papers.length === 0 ? (
          <EmptyState icon={FileText} title="No papers yet" description="Generate your first question paper." action={{ label: 'Generate Paper', onClick: () => navigate('/faculty/question-bank/papers/generate') }} />
        ) : (
          <div className="divide-y divide-gray-50">
            {papers.map((p) => (
              <div key={p._id} className="flex items-center gap-4 px-5 py-4">
                <button onClick={() => navigate(`/faculty/question-bank/papers/${p._id}`)} className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-semibold text-gray-900 truncate">{p.config.examType}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{p.totalMarksAssembled} marks · {new Date(p.createdAt).toLocaleDateString()}</p>
                </button>
                <button onClick={() => deletePaper(p._id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0" aria-label="Delete paper">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
