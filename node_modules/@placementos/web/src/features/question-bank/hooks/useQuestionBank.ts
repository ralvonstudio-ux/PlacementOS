import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { questionBankApi, ExtractionJobStatus } from '../api/question-bank.api';
import type { CreateBankQuestionPayload, BankQuestionListOptions, ConfirmExtractedQuestionsPayload, PaperGenerationConfig } from '@placementos/types';

export const questionBankKeys = {
  all: ['question-bank'] as const,
  modules: (batch: string, track: string) => [...questionBankKeys.all, 'modules', batch, track] as const,
  groups: (batch?: string, track?: string) => [...questionBankKeys.all, 'groups', batch ?? '', track ?? ''] as const,
  questions: (opts: BankQuestionListOptions) => [...questionBankKeys.all, 'questions', opts] as const,
  tpoOverview: () => [...questionBankKeys.all, 'tpo-overview'] as const,
};

export const useModules = (batch: string, track: string) =>
  useQuery({
    queryKey: questionBankKeys.modules(batch, track),
    queryFn: () => questionBankApi.listModules(batch, track),
    enabled: !!batch && !!track,
  });

export const useQuestionGroups = (batch?: string, track?: string) =>
  useQuery({
    queryKey: questionBankKeys.groups(batch, track),
    queryFn: () => questionBankApi.listQuestionGroups(batch, track),
  });

export const useQuestions = (opts: BankQuestionListOptions) =>
  useQuery({
    queryKey: questionBankKeys.questions(opts),
    queryFn: () => questionBankApi.listQuestions(opts),
    enabled: !!opts.batch && !!opts.track,
  });

export const useCreateQuestion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateBankQuestionPayload) => questionBankApi.createQuestion(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: questionBankKeys.all }),
  });
};

export const useDeleteQuestion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => questionBankApi.deleteQuestion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: questionBankKeys.all }),
  });
};

export const useQuestionBankTpoOverview = () =>
  useQuery({
    queryKey: questionBankKeys.tpoOverview(),
    queryFn: questionBankApi.getTpoOverview,
  });

// ── AI extraction ────────────────────────────────────────────────────────────

export const useExtractFromImage = () =>
  useMutation({
    mutationFn: ({ file, batch, track, trainingModuleName, detectImages }: { file: File; batch: string; track: string; trainingModuleName: string; detectImages: boolean }) =>
      questionBankApi.extractFromImage(file, batch, track, trainingModuleName, detectImages),
  });

export const useExtractFromPdf = () =>
  useMutation({
    mutationFn: ({ file, batch, track, trainingModuleName }: { file: File; batch: string; track: string; trainingModuleName: string }) =>
      questionBankApi.extractFromPdf(file, batch, track, trainingModuleName),
  });

export const useExtractChapter = () =>
  useMutation({
    mutationFn: ({ files, batch, track, trainingModuleName, detectImages }: { files: File[]; batch: string; track: string; trainingModuleName: string; detectImages: boolean }) =>
      questionBankApi.extractChapter(files, batch, track, trainingModuleName, detectImages),
  });

export const useReExtractSource = () =>
  useMutation({
    mutationFn: ({ sourceId, options }: { sourceId: string; options: { count: number; difficulty: 'easy' | 'medium' | 'hard' | 'mixed'; includeImages?: boolean } }) =>
      questionBankApi.reExtractSource(sourceId, options),
  });

/** Polls an extraction job every 1.5s until it settles (completed/failed). */
export const useExtractionJob = (jobId: string | null) =>
  useQuery<ExtractionJobStatus>({
    queryKey: ['question-bank', 'extraction-job', jobId],
    queryFn: () => questionBankApi.getExtractionJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => (query.state.data?.status === 'processing' ? 1500 : false),
  });

export const useConfirmExtracted = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ConfirmExtractedQuestionsPayload) => questionBankApi.confirmExtracted(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: questionBankKeys.all }),
  });
};

// ── Papers ───────────────────────────────────────────────────────────────────

export const usePapers = (batch?: string, track?: string) =>
  useQuery({
    queryKey: [...questionBankKeys.all, 'papers', batch ?? '', track ?? ''],
    queryFn: () => questionBankApi.listPapers(batch, track),
  });

export const usePaper = (id: string | null) =>
  useQuery({
    queryKey: [...questionBankKeys.all, 'paper', id ?? ''],
    queryFn: () => questionBankApi.getPaper(id!),
    enabled: !!id,
  });

export const useGeneratePaper = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: PaperGenerationConfig) => questionBankApi.generatePaper(config),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...questionBankKeys.all, 'papers'] }),
  });
};

export const useDeletePaper = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => questionBankApi.deletePaper(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...questionBankKeys.all, 'papers'] }),
  });
};
