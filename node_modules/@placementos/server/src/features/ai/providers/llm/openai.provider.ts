import OpenAI from 'openai';
import { ILLMProvider, LLMCompletionInput, LLMCompletionOutput } from './llm-provider.interface';
import { env } from '../../../../config/env';
import { logger } from '../../../../lib/logger';
import { Semaphore } from '../../../../lib/semaphore';

// ── Cost map: USD per 1M tokens (input / output) ──────────────────────────────
const COST_MAP: Record<string, [number, number]> = {
  'gpt-4o-mini': [0.15, 0.6],
  'gpt-4o': [5.0, 15.0],
  'gpt-4o-2024-11-20': [2.5, 10.0],
  'gpt-4-turbo': [10.0, 30.0],
};

export function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const [inputRate, outputRate] = COST_MAP[model] ?? [0, 0];
  return (promptTokens / 1_000_000) * inputRate + (completionTokens / 1_000_000) * outputRate;
}

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      maxRetries: 3,
      timeout: 60_000,
    });
  }
  return _client;
}

// Process-wide concurrency cap so no matter how many jobs are in flight at once (across every
// faculty member), only AI_MAX_CONCURRENCY OpenAI calls actually run — everything else queues.
const aiConcurrency = new Semaphore(env.AI_MAX_CONCURRENCY);

const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_BASE_BACKOFF_MS = 1500;
const RATE_LIMIT_MAX_BACKOFF_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { status?: number }).status === 429;
}

function retryAfterMs(err: unknown): number | null {
  const headers = (err as { headers?: Record<string, string> } | undefined)?.headers;
  const raw = headers?.['retry-after'];
  const seconds = raw ? Number(raw) : NaN;
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
}

/** Runs one OpenAI call inside the global concurrency slot, with its own backoff-and-retry loop
 *  for 429s — released between attempts so a slow-recovering call doesn't starve other queued
 *  requests of concurrency while it waits. */
async function callWithBackoff<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= RATE_LIMIT_MAX_ATTEMPTS; attempt++) {
    try {
      return await aiConcurrency.run(fn);
    } catch (err) {
      const isLastAttempt = attempt === RATE_LIMIT_MAX_ATTEMPTS;
      if (!isRateLimitError(err) || isLastAttempt) throw err;

      const backoff = retryAfterMs(err) ?? Math.min(RATE_LIMIT_MAX_BACKOFF_MS, RATE_LIMIT_BASE_BACKOFF_MS * 2 ** (attempt - 1)) + Math.random() * 500;
      logger.warn('[OpenAIProvider] Rate limited — backing off and retrying', { attempt, backoffMs: Math.round(backoff) });
      await sleep(backoff);
    }
  }
  throw new Error('Rate limit retry loop exited without resolving');
}

export const openaiProvider: ILLMProvider = {
  name: 'openai',
  model: env.OPENAI_MODEL,

  isAvailable(): boolean {
    return Boolean(env.OPENAI_API_KEY);
  },

  async complete(input: LLMCompletionInput): Promise<LLMCompletionOutput> {
    const start = Date.now();
    const model = env.OPENAI_MODEL;

    try {
      const userContent: OpenAI.Chat.ChatCompletionContentPart[] | string = input.imageDataUri
        ? [
            { type: 'text', text: input.userPrompt },
            { type: 'image_url', image_url: { url: input.imageDataUri, detail: 'high' } },
          ]
        : input.userPrompt;

      const response = await callWithBackoff(() =>
        getClient().chat.completions.create({
          model,
          temperature: input.temperature ?? 0.4,
          max_tokens: input.maxTokens ?? 600,
          response_format: input.jsonResponse ? { type: 'json_object' } : { type: 'text' },
          messages: [
            { role: 'system', content: input.systemPrompt },
            { role: 'user', content: userContent },
          ],
        })
      );

      const choice = response.choices[0];
      const content = choice.message.content ?? '';
      const promptTokens = response.usage?.prompt_tokens ?? 0;
      const completionTokens = response.usage?.completion_tokens ?? 0;
      const finishReason = choice.finish_reason;

      logger.info('[OpenAIProvider] Completion OK', { model, promptTokens, completionTokens, finishReason, durationMs: Date.now() - start });
      if (finishReason === 'length') {
        logger.warn('[OpenAIProvider] Completion truncated by maxTokens', { model, completionTokens });
      }

      return {
        content,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        model,
        durationMs: Date.now() - start,
        finishReason,
      };
    } catch (err) {
      logger.error('[OpenAIProvider] Completion failed', { model, err });
      throw err;
    }
  },
};
