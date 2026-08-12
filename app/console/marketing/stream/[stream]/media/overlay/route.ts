/**
 * POST /console/marketing/stream/[stream]/media/overlay — composite brand-standard
 * text onto a library image (Space Grotesk, exact colours, exact position, and
 * *asterisk*-highlighted words), rendered deterministically in code (not by an AI
 * model). Returns the hosted URL; the client saves it through ./add. Team-scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { isStreamId } from '@/lib/marketing/streams';
import { isHiggsfieldConfigured } from '@/lib/marketing/higgsfield';
import { renderAndHostOverlay } from '@/lib/marketing/text-overlay';
import { BRAND_HEXES } from '@/lib/marketing/brand-colors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Colours are restricted to the Polynize palette (validated against the shared set)
// so overlays can never go off-brand, even if the client sends something else.
const brandHex = z.string().refine((v) => BRAND_HEXES.has(v), 'not a brand colour');

const BodySchema = z.object({
  imageUrl: z.string().url().max(2000),
  text: z.string().trim().min(1).max(1000),
  position: z.enum(['top', 'upper', 'centre', 'lower', 'bottom']).optional(),
  hAlign: z.enum(['left', 'centre', 'right']).optional(),
  size: z.enum(['small', 'medium', 'large']).optional(),
  baseColor: brandHex.optional(),
  highlightColor: brandHex.optional(),
});

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
  // Hosting the rendered PNG reuses the Higgsfield CDN upload.
  if (!isHiggsfieldConfigured()) {
    return NextResponse.json(
      { error: 'Image hosting is not configured (Higgsfield keys missing).' },
      { status: 400 }
    );
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const res = await renderAndHostOverlay(body.imageUrl, {
    text: body.text.trim(),
    position: body.position ?? 'centre',
    hAlign: body.hAlign ?? 'centre',
    size: body.size ?? 'medium',
    baseColor: body.baseColor ?? '#ffffff',
    highlightColor: body.highlightColor ?? '#69fccb',
  }, {
    // Keyed by stream, url built from the request origin, so the link is right on
    // localhost, on a preview and in production.
    stream,
    requestOrigin: new URL(req.url).origin,
  });
  if (res.error || !res.url) {
    return NextResponse.json({ error: res.error ?? 'Overlay failed.' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, url: res.url });
}
