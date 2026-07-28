/**
 * POST /console/marketing/piece/[id]/screen-prompt/slides — April proposes the SLIDES
 * (what is on screen and what it says) from the script plus the operator's direction.
 *
 * Returns the slides for the client to render as cards and persist through the
 * existing /state autosave, so there is one validated write path. Team-scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { getPiece } from '@/lib/marketing/piece-store';
import { generateSlides } from '@/lib/marketing/slides-generate';
import { DraftError } from '@/lib/marketing/draft';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const BodySchema = z.object({
  direction: z.string().max(4000).optional(),
  current: z
    .array(z.object({ visual: z.string().max(2000), text: z.string().max(2000) }))
    .max(20)
    .optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse((await req.json().catch(() => ({}))) ?? {});
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  let piece;
  try {
    piece = await getPiece(user.email, id);
  } catch (err) {
    console.error('[slides] piece read failed:', err);
    return NextResponse.json({ error: 'could not read the piece' }, { status: 502 });
  }
  if (!piece) return NextResponse.json({ error: 'piece not found' }, { status: 404 });

  try {
    const { slides, note } = await generateSlides(
      user.email,
      piece,
      body.direction ?? '',
      body.current ?? []
    );
    return NextResponse.json({ slides, note });
  } catch (e) {
    if (e instanceof DraftError && e.reason === 'no-concept') {
      return NextResponse.json(
        { error: 'Write the script first. The slides are planned from it.' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'April is unavailable right now. Try again in a moment.' },
      { status: 502 }
    );
  }
}
