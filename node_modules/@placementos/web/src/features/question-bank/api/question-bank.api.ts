import { apiClient, extractErrorMessage } from '@/services/api';
import type {
  ApiResponse,
  PaginatedResponse,
  TrainingModuleRecord,
  BankQuestion,
  BankQuestionGroup,
  BankQuestionSource,
  CreateBankQuestionPayload,
  BankQuestionListOptions,
  ConfirmExtractedQuestionsPayload,
  QuestionExtractionResult,
  TextExtractionResult,
  ModuleCaptureJobResult,
  PaperGenerationConfig,
  GeneratedQuestionPaper,
  TpoOverviewEntry,
} from '@placementos/types';

const BASE = '/question-bank';

export interface ExtractionJobStatus {
  status: 'processing' | 'completed' | 'failed';
  result?: QuestionExtractionResult | TextExtractionResult | ModuleCaptureJobResult;
  error?: string;
  totalPages?: number;
  completedPages?: number;
}

export interface GeneratedPaperSummary {
  _id: string;
  config: PaperGenerationConfig;
  totalMarksAssembled: number;
  createdBy: string;
  createdAt: string;
}

export const questionBankApi = {
  async listModules(batch: string, track: string): Promise<TrainingModuleRecord[]> {
    try {
      const res = await apiClient.get<ApiResponse<TrainingModuleRecord[]>>(`${BASE}/modules`, { params: { batch, track } });
      return res.data.data ?? [];
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async listQuestionGroups(batch?: string, track?: string): Promise<BankQuestionGroup[]> {
    try {
      const res = await apiClient.get<ApiResponse<BankQuestionGroup[]>>(`${BASE}/questions/groups`, { params: { batch, track } });
      return res.data.data ?? [];
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async listQuestions(opts: BankQuestionListOptions): Promise<PaginatedResponse<BankQuestion>> {
    try {
      const res = await apiClient.get<PaginatedResponse<BankQuestion>>(`${BASE}/questions`, { params: opts });
      return res.data;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async createQuestion(payload: CreateBankQuestionPayload): Promise<BankQuestion> {
    try {
      const res = await apiClient.post<ApiResponse<BankQuestion>>(`${BASE}/questions`, payload);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async deleteQuestion(id: string): Promise<void> {
    try {
      await apiClient.delete(`${BASE}/questions/${id}`);
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async getTpoOverview(): Promise<TpoOverviewEntry[]> {
    try {
      const res = await apiClient.get<ApiResponse<TpoOverviewEntry[]>>(`${BASE}/tpo/overview`);
      return res.data.data ?? [];
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  // ── AI extraction ──────────────────────────────────────────────────────────

  async extractFromImage(file: File, batch: string, track: string, trainingModuleName: string, detectImages: boolean): Promise<{ jobId: string }> {
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await apiClient.post<ApiResponse<{ jobId: string }>>(`${BASE}/extract/image`, form, {
        params: { batch, track, trainingModuleName, detectImages },
      });
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async extractFromPdf(file: File, batch: string, track: string, trainingModuleName: string): Promise<TextExtractionResult> {
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await apiClient.post<ApiResponse<TextExtractionResult>>(`${BASE}/extract/pdf`, form, {
        params: { batch, track, trainingModuleName },
      });
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async extractChapter(files: File[], batch: string, track: string, trainingModuleName: string, detectImages: boolean): Promise<{ jobId: string }> {
    try {
      const form = new FormData();
      files.forEach((f) => form.append('images', f));
      form.append('batch', batch);
      form.append('track', track);
      form.append('trainingModuleName', trainingModuleName);
      form.append('detectImages', String(detectImages));
      const res = await apiClient.post<ApiResponse<{ jobId: string }>>(`${BASE}/extract/chapter`, form);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async reExtractSource(sourceId: string, options: { count: number; difficulty: 'easy' | 'medium' | 'hard' | 'mixed'; includeImages?: boolean }): Promise<{ jobId: string }> {
    try {
      const res = await apiClient.post<ApiResponse<{ jobId: string }>>(`${BASE}/sources/${sourceId}/re-extract`, options);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async getExtractionJob(jobId: string): Promise<ExtractionJobStatus> {
    try {
      const res = await apiClient.get<ApiResponse<ExtractionJobStatus>>(`${BASE}/extract/jobs/${jobId}`);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async confirmExtracted(payload: ConfirmExtractedQuestionsPayload): Promise<BankQuestion[]> {
    try {
      const res = await apiClient.post<ApiResponse<BankQuestion[]>>(`${BASE}/extract/confirm`, payload);
      return res.data.data ?? [];
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async getSource(id: string): Promise<BankQuestionSource> {
    try {
      const res = await apiClient.get<ApiResponse<BankQuestionSource>>(`${BASE}/sources/${id}`);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async deleteSource(id: string): Promise<void> {
    try {
      await apiClient.delete(`${BASE}/sources/${id}`);
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  // ── Paper generation ───────────────────────────────────────────────────────

  async generatePaper(config: PaperGenerationConfig): Promise<GeneratedQuestionPaper> {
    try {
      const res = await apiClient.post<ApiResponse<GeneratedQuestionPaper>>(`${BASE}/papers/generate`, config);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async getPaper(id: string): Promise<GeneratedQuestionPaper> {
    try {
      const res = await apiClient.get<ApiResponse<GeneratedQuestionPaper>>(`${BASE}/papers/${id}`);
      return res.data.data!;
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async listPapers(batch?: string, track?: string): Promise<GeneratedPaperSummary[]> {
    try {
      const res = await apiClient.get<ApiResponse<{ data: GeneratedPaperSummary[]; total: number; page: number; limit: number }>>(`${BASE}/papers`, { params: { batch, track } });
      return res.data.data?.data ?? [];
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },

  async deletePaper(id: string): Promise<void> {
    try {
      await apiClient.delete(`${BASE}/papers/${id}`);
    } catch (err) { throw new Error(extractErrorMessage(err)); }
  },
};
