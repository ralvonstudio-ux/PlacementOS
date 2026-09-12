import mongoose from 'mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';
import { Readable } from 'stream';

/**
 * Persists training-module page images (for picture-based question generation) via MongoDB
 * GridFS rather than embedding base64 on the owning document — a single upload can run several
 * MB, and a multi-page module capture holds many pages in one job/source, which would blow past
 * MongoDB's 16MB per-document limit if embedded directly.
 */

const BUCKET_NAME = 'question_bank_images';

function getBucket(): GridFSBucket {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB connection not ready — cannot access image store.');
  return new GridFSBucket(db, { bucketName: BUCKET_NAME });
}

export interface StoredImageMeta {
  instituteId: string;
  contentType: string;
}

/** Saves an image buffer to GridFS, tagged with the owning institute for later access checks. */
export async function saveImage(buffer: Buffer, meta: StoredImageMeta): Promise<string> {
  const bucket = getBucket();
  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(`${meta.instituteId}-${Date.now()}`, {
      contentType: meta.contentType,
      metadata: { instituteId: meta.instituteId },
    });
    Readable.from(buffer)
      .pipe(uploadStream)
      .on('error', reject)
      .on('finish', () => resolve(uploadStream.id.toHexString()));
  });
}

/** Reads back an image's bytes + content type. Returns null (never throws) if missing/deleted/wrong-tenant. */
export async function readImage(fileId: string, instituteId: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!ObjectId.isValid(fileId)) return null;
  const bucket = getBucket();
  const files = await bucket.find({ _id: new ObjectId(fileId) }).toArray();
  const file = files[0];
  if (!file || file.metadata?.instituteId !== instituteId) return null;

  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    bucket.openDownloadStream(new ObjectId(fileId))
      .on('data', (chunk) => chunks.push(chunk))
      .on('error', reject)
      .on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: file.contentType ?? 'image/jpeg' }));
  });
}

/** Best-effort delete — swallows "not found" since callers use this to clean up on source-deletion. */
export async function deleteImage(fileId: string): Promise<void> {
  if (!ObjectId.isValid(fileId)) return;
  try {
    await getBucket().delete(new ObjectId(fileId));
  } catch {
    // already gone — fine
  }
}
