/**
 * The polynize-agents bucket (Lightsail object storage, S3-compatible, private,
 * ap-southeast-2). The console is the single writer/reader of concept docs (D16
 * / agent-socket-contract); agents that produce large binary blobs write direct
 * and return a ref (D17) — this helper is the console's access to it.
 *
 * DORMANT until the four AGENTS_S3_* env vars are set: isBucketConfigured() is
 * false, and callers fall back to the interim store. Server-side only.
 */

import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

let cached: S3Client | null = null;

export function bucketName(): string | undefined {
  return process.env.AGENTS_BUCKET;
}

export function isBucketConfigured(): boolean {
  return Boolean(
    process.env.AGENTS_BUCKET &&
      process.env.AGENTS_BUCKET_REGION &&
      process.env.AGENTS_S3_ACCESS_KEY_ID &&
      process.env.AGENTS_S3_SECRET_ACCESS_KEY
  );
}

function client(): S3Client {
  if (!isBucketConfigured()) {
    throw new Error('polynize-agents bucket is not configured (AGENTS_S3_* env)');
  }
  if (!cached) {
    cached = new S3Client({
      region: process.env.AGENTS_BUCKET_REGION,
      credentials: {
        accessKeyId: process.env.AGENTS_S3_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.AGENTS_S3_SECRET_ACCESS_KEY as string,
      },
    });
  }
  return cached;
}

/** Read an object as text, or null if it does not exist. */
export async function getObjectText(key: string): Promise<string | null> {
  try {
    const res = await client().send(
      new GetObjectCommand({ Bucket: bucketName(), Key: key })
    );
    return (await res.Body?.transformToString()) ?? null;
  } catch (e) {
    const name = (e as { name?: string })?.name;
    if (name === 'NoSuchKey' || name === 'NotFound') return null;
    throw e;
  }
}

export async function putObjectText(
  key: string,
  body: string,
  contentType = 'text/markdown; charset=utf-8'
): Promise<void> {
  await client().send(
    new PutObjectCommand({
      Bucket: bucketName(),
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

/**
 * Write BYTES, for the rendered video of a podcast clip.
 *
 * The bucket is private and Descript's own download url is a signed link that expires, but
 * `lib/marketing/publish.ts` notes that "Metricool fetches by URL" and a post can be scheduled days
 * ahead. An expiring url is therefore a dead link at the moment it matters most, so the file has to
 * land somewhere permanent and be served from a route we own.
 */
export async function putObject(
  key: string,
  body: Uint8Array,
  contentType: string
): Promise<void> {
  await client().send(
    new PutObjectCommand({
      Bucket: bucketName(),
      Key: key,
      Body: body,
      ContentType: contentType,
      // A clip is immutable once rendered, so it can be cached hard by anything in front of it.
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );
}

/** Read an object as BYTES plus its content type, or null if it is not there. */
export async function getObjectBytes(
  key: string
): Promise<{ bytes: Uint8Array; contentType: string; length: number } | null> {
  try {
    const res = await client().send(
      new GetObjectCommand({ Bucket: bucketName(), Key: key })
    );
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) return null;
    return {
      bytes,
      contentType: res.ContentType ?? 'application/octet-stream',
      length: bytes.byteLength,
    };
  } catch (e) {
    const name = (e as { name?: string })?.name;
    if (name === 'NoSuchKey' || name === 'NotFound') return null;
    throw e;
  }
}

/** Delete an object (idempotent — S3 returns success even if it was absent). */
export async function deleteObject(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: bucketName(), Key: key }));
}

/** List all object keys under a prefix (paginated). */
export async function listKeys(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const res = await client().send(
      new ListObjectsV2Command({
        Bucket: bucketName(),
        Prefix: prefix,
        ContinuationToken: token,
      })
    );
    for (const obj of res.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}
