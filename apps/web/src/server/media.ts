import 'server-only';
import { randomUUID } from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { checkFile, EXTENSIONS, MEDIA_RULES, type MediaKind } from '@/lib/media-rules';

// Course media in the private S3 bucket. Browsers upload directly with presigned POST forms;
// the app never proxies file bytes.

let client: S3Client | undefined;

function s3() {
  // Credentials from the default chain: the `lwk` profile locally, the instance role in AWS.
  client ??= new S3Client({ region: process.env.AWS_REGION ?? 'af-south-1' });
  return client;
}

function bucket() {
  const name = process.env.MEDIA_BUCKET;
  if (!name) throw new Error('MEDIA_BUCKET is not set');
  return name;
}

export class MediaError extends Error {}

export const lessonMediaPrefix = (courseId: string, lessonId: string) =>
  `courses/${courseId}/lessons/${lessonId}/`;
export const coverPrefix = (courseId: string) => `courses/${courseId}/cover/`;

export type UploadTicket = { url: string; fields: Record<string, string>; key: string };

/**
 * A 15-minute upload form for one object under `prefix`. S3 itself enforces the key, the
 * content type and the size limit, so a tampered browser request is rejected by S3.
 */
export async function createUpload(
  prefix: string,
  kind: MediaKind,
  contentType: string,
  size: number,
): Promise<UploadTicket> {
  const problem = checkFile(kind, contentType, size);
  if (problem) throw new MediaError(problem);
  const key = `${prefix}${randomUUID()}.${EXTENSIONS[contentType]}`;
  const { url, fields } = await createPresignedPost(s3(), {
    Bucket: bucket(),
    Key: key,
    Conditions: [
      ['content-length-range', 1, MEDIA_RULES[kind].maxBytes],
      ['eq', '$Content-Type', contentType],
    ],
    Fields: { 'Content-Type': contentType },
    Expires: 15 * 60,
  });
  return { url, fields, key };
}

/** Confirm an uploaded object exists and matches the rules before it is attached. */
export async function verifyUpload(key: string, prefix: string, kind: MediaKind) {
  if (!key.startsWith(prefix) || key.includes('..')) {
    throw new MediaError('That upload does not belong here.');
  }
  let head;
  try {
    head = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
  } catch {
    throw new MediaError('The upload was not found. Please try again.');
  }
  const problem = checkFile(kind, head.ContentType ?? '', head.ContentLength ?? 0);
  if (problem) {
    await deleteMedia(key);
    throw new MediaError(problem);
  }
}

/** Best effort: a leftover object costs storage but never breaks the app. */
export async function deleteMedia(key: string | null | undefined) {
  if (!key) return;
  try {
    await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
  } catch (error) {
    console.error('Could not delete media', key, error);
  }
}

/** Short-lived link for viewing a private file (editor previews and cover images). */
export async function signedMediaUrl(key: string, expiresInSeconds = 3600) {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket(), Key: key }), {
    expiresIn: expiresInSeconds,
  });
}
