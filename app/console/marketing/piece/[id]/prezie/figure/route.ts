/**
 * FIGURE endpoints for a prezie (D33): the iteration loop.
 *
 * POST    draw a new figure, or revise an existing one when `figure_id` is given.
 * DELETE  remove a figure.
 * PATCH   reorder.
 *
 * A revision is the primary operation, not an afterthought, because this is a conversation:
 * "we start from one point and we keep on building" (Marrs). The figure's brief accumulates
 * inside `generateFigure`, so what was agreed on turn one survives turn four.
 *
 * Team-scope only. Every figure is sanitised and scoped before it is stored, in `figure.ts`,
 * because these render from an unauthenticated URL.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { getPiece, type MarketingPiece } from '@/lib/marketing/piece-store';
import {
  getPrezie,
  savePrezie,
  conceptSlugFromRef,
  type Prezie,
} from '@/lib/marketing/prezie-store';
import { discussFigure, generateFigure, type FigureTurn } from '@/lib/marketing/figure-generate';
import { conceptBodyForPiece, DraftError } from '@/lib/marketing/draft';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const conceptOf = (piece: MarketingPiece) => conceptSlugFromRef(piece.concept_ref);

const AskSchema = z.object({
  prezie_id: z.string().trim().min(1).max(200),
  /** What the operator just said. The whole interface is this one field. */
  ask: z.string().trim().min(1).max(4000),
  /** Present when refining an existing figure rather than adding one. */
  figure_id: z.string().trim().max(200).optional(),
  /**
   * 'discuss' talks about what to draw without drawing it; 'draw' commits.
   *
   * Marrs asked for this after finding the loop was trial and error: "she explains to me the
   * figure that she can draw, when I agree on it she draws it". Talking costs a sentence and
   * drawing costs a turn, so the disagreement belongs in the cheap step.
   */
  mode: z.enum(['discuss', 'draw']).default('draw'),
  /** The conversation so far, so a proposal builds on the last one and the draw honours it. */
  history: z
    .array(z.object({ role: z.enum(['operator', 'april']), text: z.string().max(6000) }))
    .max(24)
    .optional(),
});
const IdSchema = z.object({
  prezie_id: z.string().trim().min(1).max(200),
  figure_id: z.string().trim().min(1).max(200),
});
const OrderSchema = z.object({
  prezie_id: z.string().trim().min(1).max(200),
  order: z.array(z.string().trim().min(1).max(200)).min(1).max(24).optional(),
  /**
   * Set whether ONE figure owns the screen's touches, without asking April.
   *
   * She has the same flag and is told to set it, but Marrs has now been blocked twice waiting
   * for her to do something she could have done, and this is a one-bit fact about the figure
   * that he knows for certain. A switch he owns is deterministic; a prompt rule is a hope.
   */
  figure_id: z.string().trim().min(1).max(200).optional(),
  interactive: z.boolean().optional(),
});

/** Everything the client needs to render the loop; the css/html go too, for the preview. */
const view = (p: Prezie) => ({
  prezie_id: p.prezie_id,
  name: p.name,
  url: `/console/prezie/${p.concept}/${p.prezie_id}`,
  figures: (p.figures ?? []).map((f) => ({
    figure_id: f.figure_id,
    name: f.name,
    brief: f.brief,
    taps: f.taps,
    interactive: f.interactive === true,
  })),
});

async function load(owner: string, pieceId: string, prezieId: string) {
  const piece = await getPiece(owner, pieceId);
  if (!piece) return { error: NextResponse.json({ error: 'piece not found' }, { status: 404 }) };
  const concept = conceptOf(piece);
  const prezie = await getPrezie(concept, prezieId);
  if (!prezie) {
    return { error: NextResponse.json({ error: 'That prezie is gone. Reload.' }, { status: 409 }) };
  }
  return { piece, prezie };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof AskSchema>;
  try {
    body = AskSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const found = await load(user.email, id, body.prezie_id);
  if ('error' in found) return found.error;
  const { piece, prezie } = found;

  const figures = prezie.figures ?? [];
  const current = body.figure_id
    ? figures.find((f) => f.figure_id === body.figure_id) ?? null
    : null;
  if (body.figure_id && !current) {
    return NextResponse.json({ error: 'That figure is gone. Reload.' }, { status: 409 });
  }

  try {
    // The concept is handed over so a figure can carry a real number rather than a placeholder.
    const conceptBody = await conceptBodyForPiece(user.email, piece).catch(() => '');
    const history = (body.history ?? []) as FigureTurn[];

    // TALKING FIRST. Nothing is saved and no figure changes: this is the cheap step where the
    // picture gets agreed, and where she can say what she cannot draw before it costs a turn.
    if (body.mode === 'discuss') {
      const reply = await discussFigure(
        body.ask,
        { concept: conceptBody, angle: piece.angle },
        history,
        current
      );
      return NextResponse.json({ ok: true, reply });
    }

    // DRAWING. The agreed conversation goes in with the ask, so what was settled while talking
    // is what gets built rather than only the last thing said.
    const agreed = history.length
      ? `${history.map((t) => `${t.role === 'operator' ? 'I said' : 'You said'}: ${t.text}`).join('\n\n')}\n\nSo draw this: ${body.ask}`
      : body.ask;

    const { figure, note } = await generateFigure(
      agreed,
      { concept: conceptBody, angle: piece.angle },
      current
    );

    const next: Prezie = {
      ...prezie,
      figures: current
        ? figures.map((f) => (f.figure_id === current.figure_id ? figure : f))
        : [...figures, figure],
      updated_at: new Date().toISOString(),
    };
    await savePrezie(next);
    return NextResponse.json({ ok: true, note, figure_id: figure.figure_id, prezie: view(next) });
  } catch (e) {
    if (e instanceof DraftError && e.reason === 'empty') {
      return NextResponse.json(
        { error: 'That came back unusable. Try describing it a different way.' },
        { status: 502 }
      );
    }
    console.error('[prezie.figure] failed:', e);
    return NextResponse.json(
      { error: 'April is unavailable right now. Try again in a moment.' },
      { status: 502 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let body: z.infer<typeof IdSchema>;
  try {
    body = IdSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }
  const found = await load(user.email, id, body.prezie_id);
  if ('error' in found) return found.error;
  const { prezie } = found;

  const next: Prezie = {
    ...prezie,
    figures: (prezie.figures ?? []).filter((f) => f.figure_id !== body.figure_id),
    updated_at: new Date().toISOString(),
  };
  await savePrezie(next);
  return NextResponse.json({ ok: true, prezie: view(next) });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let body: z.infer<typeof OrderSchema>;
  try {
    body = OrderSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }
  const found = await load(user.email, id, body.prezie_id);
  if ('error' in found) return found.error;
  const { prezie } = found;

  const have = prezie.figures ?? [];

  // Setting the flag on one figure. Deliberately the same verb as reordering: both are the
  // operator arranging what already exists, neither costs a generation.
  if (body.figure_id && typeof body.interactive === 'boolean') {
    if (!have.some((f) => f.figure_id === body.figure_id)) {
      return NextResponse.json({ error: 'That figure is gone. Reload.' }, { status: 409 });
    }
    const next: Prezie = {
      ...prezie,
      figures: have.map((f) =>
        f.figure_id === body.figure_id
          ? { ...f, interactive: body.interactive === true ? true : undefined }
          : f
      ),
      updated_at: new Date().toISOString(),
    };
    await savePrezie(next);
    return NextResponse.json({ ok: true, prezie: view(next) });
  }
  if (!body.order) {
    return NextResponse.json({ error: 'nothing to change' }, { status: 400 });
  }
  // Reorder by the ids given, then append anything the client did not mention, so a stale
  // client can never silently drop a figure it had not loaded.
  const order = body.order;
  const ordered = order
    .map((fid) => have.find((f) => f.figure_id === fid))
    .filter((f): f is NonNullable<typeof f> => Boolean(f));
  const rest = have.filter((f) => !order.includes(f.figure_id));

  const next: Prezie = {
    ...prezie,
    figures: [...ordered, ...rest],
    updated_at: new Date().toISOString(),
  };
  await savePrezie(next);
  return NextResponse.json({ ok: true, prezie: view(next) });
}
