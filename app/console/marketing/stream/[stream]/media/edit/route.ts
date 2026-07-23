/**
 * POST /console/marketing/stream/[stream]/media/edit — edit an existing library
 * image with a text instruction (e.g. "add the words X across the top") via Nano
 * Banana (OpenRouter). Returns the edited image's hosted URL (NOT saved; the
 * client saves it through ./add, same as generated images). Team-scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { isStreamId } from '@/lib/marketing/streams';
import { editImage, isImageEditConfigured } from '@/lib/marketing/image-edit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const BodySchema = z.object({
  imageUrl: z.string().url().max(2000),
  prompt: z.string().trim().min(1).max(2000),
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
  if (!isImageEditConfigured()) {
    return NextResponse.json(
      { error: 'Image editing is not configured (OpenRouter or Higgsfield keys missing).' },
      { status: 400 }
    );
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const res = await editImage(body.imageUrl, body.prompt.trim());
  if (res.error || !res.url) {
    return NextResponse.json({ error: res.error ?? 'Editing failed.' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, url: res.url });
}
