/**
 * The SCENE endpoints for a piece (D31).
 *
 * POST  build or refine the scene with April, from the locked script + direction.
 * PUT   save the scene the operator edited by hand.
 *
 * The PUT matters as much as the POST: under D31 the scene is DATA, so changing a word
 * or a colour is direct manipulation and must never cost an LLM round trip. April is for
 * proposing and refining, not for retyping.
 *
 * Team-scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { getPiece } from '@/lib/marketing/piece-store';
import { getScene, saveScene } from '@/lib/marketing/scene-store';
import { generateScene, MAX_FACTS, MAX_NODES } from '@/lib/marketing/scene-generate';
import { DraftError } from '@/lib/marketing/draft';
import { stripEmDashes } from '@/lib/em-dash';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const GenerateSchema = z.object({ direction: z.string().max(4000).optional() });

const SceneSchema = z.object({
  title: z.string().trim().max(200).optional(),
  concept: z.string().trim().min(1).max(200),
  nodes: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(80),
        colour: z.enum(['coral', 'amber', 'gold', 'mint']),
        facts: z
          .array(
            z.object({
              label: z.string().trim().min(1).max(80),
              value: z.string().trim().min(1).max(80),
            })
          )
          .max(MAX_FACTS),
      })
    )
    .min(1)
    .max(MAX_NODES),
  close: z.string().trim().max(300).optional(),
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

  let body: z.infer<typeof GenerateSchema>;
  try {
    body = GenerateSchema.parse((await req.json().catch(() => ({}))) ?? {});
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  let piece;
  try {
    piece = await getPiece(user.email, id);
  } catch (err) {
    console.error('[scene.build] piece read failed:', err);
    return NextResponse.json({ error: 'could not read the piece' }, { status: 502 });
  }
  if (!piece) return NextResponse.json({ error: 'piece not found' }, { status: 404 });

  try {
    // The current scene goes in so a follow-up direction refines rather than restarts.
    const current = await getScene(id);
    const { note, ...scene } = await generateScene(user.email, piece, body.direction ?? '', current);
    await saveScene(id, scene);
    return NextResponse.json({ ok: true, note, scene, url: `/console/scene/${id}` });
  } catch (e) {
    if (e instanceof DraftError && e.reason === 'no-concept') {
      return NextResponse.json(
        { error: 'Write the script first. The scene is built from it.' },
        { status: 400 }
      );
    }
    if (e instanceof DraftError && e.reason === 'empty') {
      return NextResponse.json(
        { error: 'That came back unusable. Try again, or give more direction.' },
        { status: 502 }
      );
    }
    console.error('[scene.build] failed:', e);
    return NextResponse.json(
      { error: 'April is unavailable right now. Try again in a moment.' },
      { status: 502 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let parsed: z.infer<typeof SceneSchema>;
  try {
    parsed = SceneSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid scene' }, { status: 400 });
  }

  // The operator's own words still go through the em-dash rule: it applies to every
  // user-facing string this repo emits, not only the generated ones.
  const scene = {
    title: stripEmDashes(parsed.title ?? parsed.concept),
    concept: stripEmDashes(parsed.concept),
    nodes: parsed.nodes.map((n) => ({
      label: stripEmDashes(n.label),
      colour: n.colour,
      facts: n.facts.map((f) => ({
        label: stripEmDashes(f.label),
        value: stripEmDashes(f.value),
      })),
    })),
    close: parsed.close ? stripEmDashes(parsed.close) : undefined,
  };

  try {
    await saveScene(id, scene);
  } catch (err) {
    console.error('[scene.save] failed:', err);
    return NextResponse.json({ error: 'could not save the scene' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, scene });
}
