/**
 * TEMPORARY probe: confirm OpenRouter image-editing (Nano Banana) contract before
 * building the feature. Sends a public test image + a text prompt and reports the
 * response shape (where/how the edited image comes back). No secrets returned.
 * DELETE after wiring.
 *
 * GET /api/diagnostics/img-edit
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const URL_ = 'https://openrouter.ai/api/v1/chat/completions';
const TEST_IMAGE = 'https://picsum.photos/seed/polynize-test/768/768';
const PROMPT = 'Add the large, bold, white text "POLYNIZE" across the top center of this image. Keep everything else the same.';

async function tryModel(model: string, apiKey: string) {
  try {
    const res = await fetch(URL_, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.OPENROUTER_REFERER ?? 'https://polynize.ai',
        'X-Title': 'Polynize img-edit probe',
      },
      body: JSON.stringify({
        model,
        modalities: ['image', 'text'],
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PROMPT },
              { type: 'image_url', image_url: { url: TEST_IMAGE } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      return { ok: false, status: res.status, detail: (await res.text().catch(() => '')).slice(0, 500) };
    }
    const data = (await res.json()) as {
      choices?: {
        finish_reason?: string;
        message?: { content?: unknown; images?: unknown };
      }[];
      usage?: unknown;
    };
    const msg = data.choices?.[0]?.message;
    const images = (msg?.images as { type?: string; image_url?: { url?: string } }[] | undefined) ?? undefined;
    const first = Array.isArray(images) ? images[0] : undefined;
    const firstUrl = first?.image_url?.url ?? '';
    return {
      ok: true,
      finish_reason: data.choices?.[0]?.finish_reason ?? null,
      messageKeys: msg ? Object.keys(msg) : [],
      imagesIsArray: Array.isArray(images),
      imageCount: Array.isArray(images) ? images.length : 0,
      firstImageType: first?.type ?? null,
      firstUrlPrefix: firstUrl.slice(0, 40),
      firstUrlIsDataUri: firstUrl.startsWith('data:'),
      firstUrlLength: firstUrl.length,
      contentType: typeof msg?.content,
      usage: data.usage ?? null,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function GET() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'no OPENROUTER_API_KEY' }, { status: 500 });
  return NextResponse.json({
    nano_banana_pro: await tryModel('google/gemini-3-pro-image-preview', apiKey),
    nano_banana_2: await tryModel('google/gemini-3.1-flash-image-preview', apiKey),
    nano_banana_ga: await tryModel('google/gemini-2.5-flash-image', apiKey),
  });
}
