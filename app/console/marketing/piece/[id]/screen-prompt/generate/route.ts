/**
 * POST /console/marketing/piece/[id]/screen-prompt/generate — generate (or
 * regenerate) the SCREEN PROMPT for a piece from its LOCKED SCRIPT plus the
 * operator's direction (D29 amended).
 *
 * The direction is the operator's creative intent, typed in the chat on the Screen
 * Prompt stage; it wins over the model's own ideas. The route loads the piece
 * server-side (never trusting the client for the script), returns the brief, and the
 * client persists it through the existing /state autosave, so there is a single
 * validated write path. Team-scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { getPiece } from '@/lib/marketing/piece-store';
import { generateScreenPrompt } from '@/lib/marketing/screen-prompt';
import { DraftError } from '@/lib/marketing/draft';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const BodySchema = z.object({
  direction: z.string().max(6000).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(8000),
      })
    )
    .max(10)
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
  const owner = user.email;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse((await req.json().catch(() => ({}))) ?? {});
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  let piece;
  try {
    piece = await getPiece(owner, id);
  } catch (err) {
    console.error('[screen-prompt.generate] piece read failed:', err);
    return NextResponse.json({ error: 'could not read the piece' }, { status: 502 });
  }
  if (!piece) {
    return NextResponse.json({ error: 'piece not found' }, { status: 404 });
  }

  try {
    const { prompt, note } = await generateScreenPrompt(
      owner,
      piece,
      body.direction ?? '',
      body.history ?? []
    );
    return NextResponse.json({ screenPrompt: prompt, note });
  } catch (e) {
    if (e instanceof DraftError) {
      if (e.reason === 'no-concept') {
        return NextResponse.json(
          { error: 'Write the script first. The screen prompt is built from it.' },
          { status: 400 }
        );
      }
      if (e.reason === 'empty') {
        return NextResponse.json(
          { error: 'The screen prompt came back empty. Try again.' },
          { status: 502 }
        );
      }
    }
    return NextResponse.json(
      { error: 'April is unavailable right now. Try again in a moment.' },
      { status: 502 }
    );
  }
}
