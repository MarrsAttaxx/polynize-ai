/**
 * Higgsfield image generation. Server-side only. Wraps the official
 * @higgsfield/client SDK: generation goes through the v2 `subscribe` client
 * (FLUX + Soul, polled to completion), while Soul-ID management, style listing,
 * and reference-image upload use the v1 client. Credentials come from
 * HIGGSFIELD_API_KEY_ID + HIGGSFIELD_API_KEY_SECRET (set in Vercel).
 *
 * Models are NOT hardcoded here: callers pass an endpoint from the model
 * registry (higgsfield-models.ts), so the console stays open to any Higgsfield
 * model by adding a registry entry rather than touching this file.
 */

import { HiggsfieldClient, InputImageType } from '@higgsfield/client';
import { createHiggsfieldClient } from '@higgsfield/client/v2';

function creds() {
  return {
    apiKey: process.env.HIGGSFIELD_API_KEY_ID,
    apiSecret: process.env.HIGGSFIELD_API_KEY_SECRET,
  };
}

export function isHiggsfieldConfigured(): boolean {
  return Boolean(
    process.env.HIGGSFIELD_API_KEY_ID && process.env.HIGGSFIELD_API_KEY_SECRET
  );
}

// Lazy singletons (reused across warm serverless invocations).
let v1Client: HiggsfieldClient | null = null;
function v1(): HiggsfieldClient {
  if (!v1Client) v1Client = new HiggsfieldClient(creds());
  return v1Client;
}
let v2Client: ReturnType<typeof createHiggsfieldClient> | null = null;
function v2() {
  if (!v2Client) v2Client = createHiggsfieldClient(creds());
  return v2Client;
}

export type GenerateResult = {
  status: string;
  urls: string[];
  requestId?: string;
  error?: string;
};

/**
 * Generate images from a model endpoint + input params (async under the hood,
 * polled to completion). Returns the result image URLs, or a clean error /
 * nsfw / failed status. Never throws to the caller.
 */
export async function generateImages(
  endpoint: string,
  input: Record<string, unknown>
): Promise<GenerateResult> {
  try {
    const res = await v2().subscribe(endpoint, { input, withPolling: true });
    if (res.status === 'nsfw') {
      return {
        status: 'nsfw',
        urls: [],
        requestId: res.request_id,
        error: 'The result was flagged and not returned. Try a different prompt.',
      };
    }
    if (res.status === 'failed') {
      return { status: 'failed', urls: [], requestId: res.request_id, error: 'Generation failed.' };
    }
    const urls = (res.images ?? [])
      .map((i) => i.url)
      .filter((u): u is string => Boolean(u));
    return { status: res.status, urls, requestId: res.request_id };
  } catch (err) {
    console.error('[higgsfield.generate] failed:', err);
    return {
      status: 'error',
      urls: [],
      error: err instanceof Error ? err.message : 'generation error',
    };
  }
}

/** Train a reusable identity (Soul ID) from reference photo URLs. */
export async function createSoulIdentity(name: string, imageUrls: string[]) {
  const soul = await v1().createSoulId(
    {
      name,
      input_images: imageUrls.map((u) => ({
        type: InputImageType.IMAGE_URL,
        image_url: u,
      })),
    },
    true
  );
  return { id: soul.id, name: soul.name, status: soul.status };
}

/** List this account's Soul IDs. */
export async function listSoulIdentities() {
  const r = await v1().listSoulIds(1, 100);
  return r.items.map((s) => ({ id: s.id, name: s.name, status: s.status }));
}

/** The account's available Soul styles (a live catalogue). */
export async function getSoulStyleList() {
  return v1().getSoulStyles();
}

/**
 * Upload a reference image (e.g. a person's photo) to the Higgsfield CDN and get
 * back a public URL usable as a generation reference or Soul-ID input.
 */
export async function uploadReferenceImage(
  bytes: Buffer,
  contentType: string
): Promise<string> {
  return v1().upload(bytes, contentType);
}
