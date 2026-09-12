import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

// Cloudflare R2 is S3-API-compatible, so the standard AWS SDK works against it unmodified —
// just point `endpoint` at the account's R2 endpoint instead of AWS.

const REQUIRED_ENV = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'] as const;

function isConfigured(): boolean {
  return REQUIRED_ENV.every((key) => !!process.env[key]?.trim());
}

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!isConfigured()) {
    throw new Error(
      'Cloudflare R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME to enable file uploads.'
    );
  }
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}

function publicUrlFor(key: string): string {
  const base = process.env.R2_PUBLIC_URL?.trim().replace(/\/$/, '');
  if (!base) {
    throw new Error('R2_PUBLIC_URL is not set — cannot build a public URL for uploaded files.');
  }
  return `${base}/${key}`;
}

export interface UploadedFile {
  key: string;
  url: string;
}

/** Uploads a buffer to R2 under `folder/` with a random filename, returning the object key and its public URL. */
export async function uploadToR2(buffer: Buffer, contentType: string, folder: string, instituteId: string): Promise<UploadedFile> {
  const ext = contentType.split('/')[1]?.split('+')[0] || 'bin';
  const key = `${folder}/${instituteId}/${randomUUID()}.${ext}`;

  await getClient().send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));

  return { key, url: publicUrlFor(key) };
}

export async function deleteFromR2(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  }));
}

export const r2Storage = { isConfigured, uploadToR2, deleteFromR2 };
