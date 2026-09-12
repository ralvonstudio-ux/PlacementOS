import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Library, Plus, ArrowLeft, Trash2, Camera, FileText } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useMyBatchTracks } from '@/features/training-schedule/hooks/useTrainingSchedule';
import { useQuestionGroups, useQuestions, useDeleteQuestion } from '../hooks/useQuestionBank';
import { AddQuestionModal } from '../components/AddQuestionModal';

export function QuestionBankLandingPage() {
  const navigate = useNavigate();
  const { batchTracks, isLoading: loadingBatches } = useMyBatchTracks();
  const [selected, setSelected] = useState<{ batch: string; track: string } | null>(null);
  const [activeModule, setActiveModule] = useState<{ id: string; name: string } | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    if (!selected && batchTracks.length > 0) setSelected(batchTracks[0]);
  }, [batchTracks, selected]);

  const { data: groups = [], isLoading: loadingGroups } = useQuestionGroups(selected?.batch, selected?.track);
  const { data: questionsPage, isLoading: loadingQuestions } = useQuestions(
    activeModule && selected ? { batch: selected.batch, track: selected.track, trainingModuleId: activeModule.id, limit: 100 } : { limit: 0 }
  );
  const { mutate: deleteQuestion } = useDeleteQuestion();

  return (
    <PageContainer>
      <WorkspaceHeader
        title="Question Bank"
        subtitle={activeModule ? activeModule.name : 'Browse and build your question bank by training module'}
        action={
          activeModule && selected ? (
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Question
            </button>
          ) : selected ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/faculty/question-bank/capture?batch=${encodeURIComponent(selected.batch)}&track=${encodeURIComponent(selected.track)}`)}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 text-sm font-semibold text-gray-700 transition-colors"
              >
                <Camera className="w-4 h-4" />
                Capture from Photo/PDF
              </button>
              <button
                onClick={() => navigate('/faculty/question-bank/papers')}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors"
              >
                <FileText className="w-4 h-4" />
                Papers
              </button>
            </div>
          ) : undefined
        }
      />

      {batchTracks.length > 1 && !activeModule && (
        <div className="mb-6 flex flex-wrap gap-2">
          {batchTracks.map((bt) => (
            <button
              key={`${bt.batch}-${bt.track}`}
              onClick={() => setSelected(bt)}
              className={`h-9 px-4 rounded-full text-sm font-medium border transition-colors ${
                selected?.batch === bt.batch && selected?.track === bt.track
                  ? 'bg-violet-600 border-violet-600 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-violet-300'
              }`}
            >
              {bt.batch} · {bt.track}
            </button>
          ))}
        </div>
      )}

      {activeModule && (
        <button onClick={() => setActiveModule(null)} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to modules
        </button>
      )}

      {!activeModule ? (
        loadingBatches || loadingGroups ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : !selected ? (
          <EmptyState icon={Library} title="No batches assigned" description="You need a Training Schedule entry first." />
        ) : groups.length === 0 ? (
          <EmptyState icon={Library} title="No questions yet" description="Once you add training modules, questions will group here." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {groups.map((g) => (
              <button
                key={g.trainingModuleId}
                onClick={() => setActiveModule({ id: g.trainingModuleId, name: g.trainingModuleName })}
                className="text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                <p className="text-sm font-semibold text-gray-900">{g.trainingModuleName}</p>
                <p className="text-xs text-gray-500 mt-1">{g.count} question{g.count === 1 ? '' : 's'}</p>
              </button>
            ))}
          </div>
        )
      ) : loadingQuestions ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (questionsPage?.data.length ?? 0) === 0 ? (
        <EmptyState icon={Library} title="No questions in this module yet" description="Add your first question." action={{ label: 'Add Question', onClick: () => setShowAdd(true) }} />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {questionsPage!.data.map((q) => (
            <div key={q._id} className="flex items-start gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{q.questionText}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{q.questionType.replace(/_/g, ' ')}</span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{q.difficulty}</span>
                  <span className="text-[11px] text-gray-400">{q.marks} mark{q.marks === 1 ? '' : 's'}</span>
                </div>
              </div>
              <button onClick={() => deleteQuestion(q._id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0" aria-label="Delete question">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd && activeModule && selected && (
        <AddQuestionModal batch={selected.batch} track={selected.track} trainingModuleName={activeModule.name} onClose={() => setShowAdd(false)} />
      )}
    </PageContainer>
  );
}
