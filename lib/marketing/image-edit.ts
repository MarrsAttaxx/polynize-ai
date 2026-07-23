/**
 * Image editing (add text, restyle) via OpenRouter's Nano Banana (Google Gemini
 * 2.5 Flash Image). Higgsfield's own models are text-to-image only, so editing an
 * EXISTING image (e.g. rendering text onto it) goes through OpenRouter, which the
 * console already uses for LLM calls.
 *
 * Flow: source image URL + a text instruction -> OpenRouter returns a base64 data
 * URI -> we upload those bytes to the Higgsfield CDN (the same host as generated
 * images) to get a durable public URL for the media library, so no extra storage
 * (Vercel Blob etc.) is needed. Server-side only. Never throws to the caller.
 */

import { uploadReferenceImage, isHiggsfieldConfigured } from './higgsfield';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Nano Banana = Gemini 2.5 Flash Image (GA). The 3.x image previews 404 on this
// account's OpenRouter access; 2.5 Flash Image is GA and does image editing + text
// rendering. Confirmed against prod (returns an edited image as a base64 data URI).
const MODEL = 'google/gemini-2.5-flash-image';

export type EditResult = { url?: string; error?: string };

/** Editing needs OpenRouter (to generate) AND Higgsfield (to host the result). */
export function isImageEditConfigured(): boolean {
  const hasKey = Boolean(process.env.APRIL_OPENROUTER_API_KEY ?? process.env.OPENROUTER_API_KEY);
  return hasKey && isHiggsfieldConfigured();
}

export async function editImage(imageUrl: string, prompt: string): Promise<EditResult> {
  const apiKey = process.env.APRIL_OPENROUTER_API_KEY ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) return { error: 'Image editing is not configured (OpenRouter key missing).' };

  let dataUri: string | undefined;
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.OPENROUTER_REFERER ?? 'https://polynize.ai',
        'X-Title': 'Polynize image edit',
      },
      body: JSON.stringify({
        model: MODEL,
        modalities: ['image', 'text'],
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      console.error(`[image-edit] openrouter ${res.status}: ${detail}`);
      return { error: 'The image editor is unavailable right now. Try again in a moment.' };
    }
    const data = (await res.json()) as {
      choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[];
    };
    dataUri = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  } catch (e) {
    console.error(`[image-edit] call threw: ${e instanceof Error ? e.message : String(e)}`);
    return { error: 'Network error reaching the image editor. Try again.' };
  }

  if (!dataUri || !dataUri.startsWith('data:')) {
    return { error: 'The editor did not return an image. Try rephrasing the instruction.' };
  }
  const m = dataUri.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) return { error: 'The editor returned an unreadable image.' };
  const bytes = Buffer.from(m[2], 'base64');

  try {
    const url = await uploadReferenceImage(bytes, m[1]);
    return { url };
  } catch (e) {
    console.error(`[image-edit] host upload failed: ${e instanceof Error ? e.message : String(e)}`);
    return { error: 'The image was created but could not be saved. Try again.' };
  }
}
