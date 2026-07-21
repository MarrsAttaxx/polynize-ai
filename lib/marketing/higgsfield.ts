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
// Cap polling under Vercel's serverless function ceiling (~300s) so a slow
// generation surfaces as a clean timeout rather than the function being killed.
const TIMING = { maxPollTime: 240_000, pollInterval: 3_000 };

let v1Client: HiggsfieldClient | null = null;
function v1(): HiggsfieldClient {
  if (!v1Client) v1Client = new HiggsfieldClient({ ...creds(), ...TIMING });
  return v1Client;
}
let v2Client: ReturnType<typeof createHiggsfieldClient> | null = null;
function v2() {
  if (!v2Client) v2Client = createHiggsfieldClient({ ...creds(), ...TIMING });
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
    // The current Higgsfield generation endpoints (e.g. /higgsfield-ai/soul/standard)
    // take the input FLAT (top-level prompt, width_and_height, ...) and are polled
    // via /requests/{id}/status, which is exactly what the v2 subscribe client does.
    // (The old /v1/text2image/soul endpoint is retired; it wanted a { params }
    // wrapper. Confirmed against prod: the flat body on the new endpoint returns a
    // completed image.)
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
    const msg = err instanceof Error ? err.message : 'generation error';
    console.error('[higgsfield.generate] failed:', err);
    // "Unavailable model" is a Higgsfield account/plan gate (the generation model
    // is not enabled on the API key), NOT a bad request. Surface it clearly so the
    // user knows it is an account action, not a console bug. (Soul ID setup works
    // on a different, ungated endpoint, so it can succeed while this is gated.)
    const friendly = /unavailable model/i.test(msg)
      ? 'Higgsfield has not enabled this image model on your account yet. Soul text-to-image generation needs model access on your Higgsfield plan or API key (this is separate from Soul ID setup, which is why that worked). Enable it in your Higgsfield account or ask Higgsfield to turn it on, then try again.'
      : msg;
    return { status: 'error', urls: [], error: friendly };
  }
}

/**
 * Train a reusable identity (Soul ID) from reference photo URLs. Does NOT block on
 * training (which can take minutes and would blow the poll/function cap): returns
 * as soon as the identity is created; it keeps training server-side and shows as
 * completed on a later list.
 */
export async function createSoulIdentity(name: string, imageUrls: string[]) {
  const soul = await v1().createSoulId(
    {
      name,
      input_images: imageUrls.map((u) => ({
        type: InputImageType.IMAGE_URL,
        image_url: u,
      })),
    },
    false
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
