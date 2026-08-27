/**
 * /console/marketing/stream/[stream]/media/generate
 *   GET  -> options for the Generate panel: whether Higgsfield is configured, the
 *           account's live Soul styles, and its Soul IDs.
 *   POST -> refine the rough prompt (April) then generate images via the chosen
 *           model. Returns the result image URLs (NOT saved; the client saves the
 *           chosen ones through ./add). Team-scope only; stream from the route.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { isStreamId } from '@/lib/marketing/streams';
import { imageModelById, providerOf } from '@/lib/marketing/higgsfield-models';
import {
  isHiggsfieldConfigured,
  getSoulStyleList,
  listSoulIdentities,
} from '@/lib/marketing/higgsfield';
import { complete } from '@/lib/llm';
import { stripEmDashes } from '@/lib/em-dash';
import { generateHostedImages, frameFor } from '@/lib/marketing/image-generate';
import { openRouterKey } from '@/lib/marketing/openrouter-image';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ stream: string }> }
) {
  const { stream } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!isStreamId(stream)) {
    return NextResponse.json({ error: 'unknown stream' }, { status: 400 });
  }
  if (!isHiggsfieldConfigured()) {
    return NextResponse.json({ configured: false, soulStyles: [], soulIds: [] });
  }
  let soulStyles: unknown[] = [];
  let soulIds: unknown[] = [];
  try {
    soulStyles = await getSoulStyleList();
  } catch (err) {
    console.error('[media.generate] soul styles failed:', err);
  }
  try {
    soulIds = await listSoulIdentities();
  } catch (err) {
    console.error('[media.generate] soul ids failed:', err);
  }
  return NextResponse.json({ configured: true, soulStyles, soulIds });
}

const GenSchema = z.object({
  modelId: z.string().min(1).max(60),
  prompt: z.string().trim().min(1).max(2000),
  aspectRatio: z.string().max(20).optional(),
  size: z.string().max(30).optional(),
  soulId: z.string().max(120).optional(),
  styleId: z.string().max(120).optional(),
  referenceUrl: z.string().url().max(2000).optional(),
  batchSize: z.union([z.literal(1), z.literal(4)]).optional(),
});

const REFINE_SYSTEM = `You are an image-prompt specialist for a marketing team. Turn the user's rough idea into ONE strong, vivid, specific prompt for an AI image model. Be concrete about subject, composition, lighting, style, and mood. If the user wants text ON the image, include the exact words to render inside double quotes. Return ONLY the final prompt: no preamble, no options, no explanation. Never use em-dashes.`;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ stream: string }> }
) {
  const { stream } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!isStreamId(stream)) {
    return NextResponse.json({ error: 'unknown stream' }, { status: 400 });
  }
  let body: z.infer<typeof GenSchema>;
  try {
    body = GenSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  /**
   * THE KEY CHECK MOVED BELOW THE MODEL (D62). It used to refuse before knowing which model was
   * asked for, so a Gemini model, which needs only an OpenRouter key, would have been turned away
   * for a missing Higgsfield one.
   */
  const model = imageModelById(body.modelId);
  if (!model) {
    return NextResponse.json({ error: 'unknown model' }, { status: 400 });
  }

  // April sharpens the rough idea into a strong image prompt. Fall back to the
  // user's own words if the refine call fails, so generation still proceeds.
  let refinedPrompt = body.prompt.trim();
  try {
    const raw = await complete({
      system: REFINE_SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Model: ${model.label} (${model.blurb}).\nRough idea:\n"""\n${body.prompt.trim()}\n"""`,
        },
      ],
      /**
       * ABOVE THE REASONING FLOOR. The production model is a thinking model whose reasoning
       * tokens are mandatory, undisableable, and counted against max_tokens: measured at roughly
       * 800-950 on this codebase. A ceiling below that is spent entirely on reasoning and returns
       * an EMPTY string, which on screen looks like the agent not answering at all rather than
       * like an error. Same fault that truncated drafts (decision log, 2026-07-20); the short
       * conversational calls were missed at the time.
       */
      maxTokens: 2000,
      temperature: 0.7,
      json: false,
      apiKey: process.env.APRIL_OPENROUTER_API_KEY,
    });
    const cleaned = stripEmDashes(raw.trim());
    if (cleaned) refinedPrompt = cleaned;
  } catch (err) {
    console.error('[media.generate] prompt refine failed, using raw prompt:', err);
  }

  if (providerOf(model) === 'higgsfield' && !isHiggsfieldConfigured()) {
    return NextResponse.json(
      { error: 'Image generation is not configured (Higgsfield keys missing).' },
      { status: 400 }
    );
  }
  if (providerOf(model) === 'openrouter' && !openRouterKey()) {
    return NextResponse.json(
      { error: `${model.label} needs an OpenRouter key. Add it in Vercel, or pick another model.` },
      { status: 400 }
    );
  }

  /**
   * ONE CALL, BOTH PROVIDERS, ALREADY HOSTED (D62). The frame is what the dispatcher needs rather
   * than a provider-specific size string: Higgsfield is asked for the nearest native size it
   * allows, and an OpenRouter result is cropped to exactly this, since that provider has no
   * dimension parameter at all.
   */
  const gen = await generateHostedImages(
    model,
    {
      prompt: refinedPrompt,
      count: body.batchSize ?? 1,
      frame: frameFor(model, body.size, body.aspectRatio),
      referenceUrl: body.referenceUrl,
      soulId: body.soulId,
      styleId: body.styleId,
    },
    { stream, requestOrigin: new URL(req.url).origin }
  );
  if (gen.urls.length === 0) {
    return NextResponse.json(
      { error: gen.error ?? 'Generation returned no images.', refinedPrompt },
      { status: 502 }
    );
  }
  const urls = gen.urls;

  return NextResponse.json({ ok: true, urls, refinedPrompt, status: 'completed' });
}
