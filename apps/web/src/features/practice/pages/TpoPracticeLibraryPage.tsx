import { useMemo, useState } from 'react';
import { BookMarked, ChevronDown, ChevronUp, Pencil, Plus, Send, Trash2, UserCheck } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchBar } from '@/components/ui/SearchBar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { usePracticeQuestions, useDeletePracticeQuestion } from '../hooks/usePractice';
import { AddPracticeQuestionModal } from '../components/AddPracticeQuestionModal';
import { AssignQuestionsModal } from '../components/AssignQuestionsModal';
import type { PracticeCategory, PracticeQuestion } from '@placementos/types';

const CATEGORIES: { value: PracticeCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'gd', label: 'Group Discussion' },
  { value: 'pi', label: 'Personal Interview' },
  { value: 'aptitude', label: 'Aptitude' },
  { value: 'reasoning', label: 'Reasoning' },
  { value: 'company', label: 'Company' },
];

const CATEGORY_LABEL: Record<PracticeCategory, string> = {
  gd: 'Group Discussion',
  pi: 'Personal Interview',
  aptitude: 'Aptitude',
  reasoning: 'Reasoning',
  company: 'Company',
};

function audienceLabel(q: PracticeQuestion): string {
  if (q.audience === 'batches') return `${q.batches?.length ?? 0} batch${q.batches?.length === 1 ? '' : 'es'}`;
  if (q.audience === 'students') return `${q.candidateIds?.length ?? 0} student${q.candidateIds?.length === 1 ? '' : 's'}`;
  return 'All students';
}

/** Shared by trainers (/faculty/practice) and TPOs (/tpo/practice): add, edit, delete and target practice content. */
export function TpoPracticeLibraryPage() {
  const [category, setCategory] = useState<PracticeCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<PracticeQuestion | null>(null);
  const [deleting, setDeleting] = useState<PracticeQuestion | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignIds, setAssignIds] = useState<string[] | null>(null);

  const { data, isLoading } = usePracticeQuestions({ category: category === 'all' ? undefined : category, search: search || undefined, limit: 200 });
  const { mutate: deleteQuestion, isPending: isDeleting } = useDeletePracticeQuestion();

  const questions = useMemo(() => data?.data ?? [], [data]);
  const allSelected = questions.length > 0 && questions.every((q) => selected.has(q._id));

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <PageContainer>
      <WorkspaceHeader
        title="GD, PI & Aptitude"
        subtitle="Group discussion, personal interview, aptitude and reasoning questions with solutions — edit them and choose who sees what"
        action={
          <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors">
            <Plus className="w-4 h-4" /> Add Question
          </button>
        }
      />

      <SectionTitle>Filter</SectionTitle>
      <div className="mb-4 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button key={c.value} onClick={() => { setCategory(c.value); setSelected(new Set()); }} className={`h-8 px-3.5 rounded-full text-xs font-medium border transition-colors ${category === c.value ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-violet-300'}`}>
            {c.label}
          </button>
        ))}
      </div>
      <SearchBar className="mb-4 max-w-md" placeholder="Search questions or tags…" value={search} onChange={setSearch} />

      {questions.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(questions.map((q) => q._id)))}
              className="rounded accent-violet-600"
            />
            Select all ({questions.length})
          </label>
          {selected.size > 0 && (
            <button onClick={() => setAssignIds(Array.from(selected))} className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-violet-600 hover:bg-violet-700 text-xs font-semibold text-white transition-colors">
              <Send className="w-3.5 h-3.5" /> Assign {selected.size} selected to…
            </button>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3 animate-pulse">{[1, 2, 3, 4].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl" />)}</div>
        ) : questions.length === 0 ? (
          <EmptyState icon={BookMarked} title="No questions found" description="Add a question, or change the filter." action={{ label: 'Add Question', onClick: () => setShowAdd(true) }} />
        ) : (
          <div className="divide-y divide-gray-50">
            {questions.map((q) => {
              const open = expanded.has(q._id);
              return (
                <div key={q._id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={selected.has(q._id)} onChange={() => toggleSelected(q._id)} className="mt-1 rounded accent-violet-600" aria-label="Select question" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{q.questionText}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{CATEGORY_LABEL[q.category]}</span>
                        {q.companyName && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">{q.companyName}</span>}
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{q.questionType === 'mcq' ? 'MCQ' : 'Open-ended'}</span>
                        {q.difficulty && <span className="text-[11px] text-gray-400">{q.difficulty}</span>}
                        <button onClick={() => setAssignIds([q._id])} className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors" title="Change who can see this question">
                          <UserCheck className="w-3 h-3" /> {audienceLabel(q)}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button onClick={() => toggleExpanded(q._id)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors" aria-label={open ? 'Hide solution' : 'Show solution'}>
                        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <button onClick={() => setEditing(q)} className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors" aria-label="Edit question">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleting(q)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" aria-label="Delete question">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {open && (
                    <div className="mt-3 ml-7 rounded-xl bg-gray-50 px-4 py-3 space-y-2 text-sm text-gray-600">
                      {q.questionType === 'mcq' && (
                        <>
                          <ul className="space-y-1">
                            {(q.options ?? []).map((o, i) => (
                              <li key={i} className={o === q.correctAnswer ? 'font-semibold text-green-700' : ''}>{String.fromCharCode(65 + i)}. {o}{o === q.correctAnswer ? ' ✓' : ''}</li>
                            ))}
                          </ul>
                        </>
                      )}
                      {q.questionType === 'open_ended' && (q.guidancePoints?.length ?? 0) > 0 && (
                        <ul className="space-y-1 list-disc pl-4">
                          {q.guidancePoints!.map((p, i) => <li key={i}>{p}</li>)}
                        </ul>
                      )}
                      {q.explanation && (
                        <p><span className="font-semibold text-gray-700">{q.questionType === 'mcq' ? 'Solution: ' : 'Model answer: '}</span>{q.explanation}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAdd && <AddPracticeQuestionModal onClose={() => setShowAdd(false)} />}
      {editing && <AddPracticeQuestionModal key={editing._id} question={editing} onClose={() => setEditing(null)} />}
      {assignIds && <AssignQuestionsModal questionIds={assignIds} onClose={() => setAssignIds(null)} onDone={() => { setAssignIds(null); setSelected(new Set()); }} />}
      {deleting && (
        <ConfirmDialog
          title="Delete this question?"
          description="It will disappear from every student's list straight away. Practice sheets that include it will no longer show it."
          confirmLabel="Delete"
          isLoading={isDeleting}
          onCancel={() => setDeleting(null)}
          onConfirm={() => deleteQuestion(deleting._id, { onSuccess: () => { setSelected((p) => { const n = new Set(p); n.delete(deleting._id); return n; }); setDeleting(null); } })}
        />
      )}
    </PageContainer>
  );
}
