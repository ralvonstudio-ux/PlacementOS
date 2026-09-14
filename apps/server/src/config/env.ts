import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000'),
  MONGODB_URI: z.string({ required_error: 'MONGODB_URI is required' }),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  INSTITUTE_NAME: z.string().default('Training & Placement Cell'),
  // JWT
  JWT_ACCESS_SECRET: z.string({ required_error: 'JWT_ACCESS_SECRET is required' }),
  JWT_REFRESH_SECRET: z.string({ required_error: 'JWT_REFRESH_SECRET is required' }),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),
  // Integration credential encryption — reserved for future provider-credential storage.
  INTEGRATION_ENCRYPTION_KEY: z.string().optional(),
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().default(600),
  // AI — OpenAI (question extraction, TPO assistant)
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  AI_MAX_CONCURRENCY: z.coerce.number().default(4),
  // Judge0 (code execution for coding-type test questions) — optional; when unset, the
  // "Run" endpoint and coding auto-grading both degrade to a clear "not configured" result
  // instead of failing the whole request.
  JUDGE0_API_URL: z.string().optional(),
  JUDGE0_API_KEY: z.string().optional(),
  JUDGE0_API_HOST: z.string().default('judge0-ce.p.rapidapi.com'),
  // Cloudflare R2 (file storage)
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().default('placementos-uploads'),
  R2_PUBLIC_URL: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
