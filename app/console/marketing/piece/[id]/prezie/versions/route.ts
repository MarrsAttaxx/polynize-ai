/**
 * PREZIE versions for a piece (D31 amended 2026-08-01).
 *
 * POST    build a NEW version with April, from the concept + narrative (and the script if
 *         one exists yet) plus the operator's direction.
 * PUT     save hand edits to one version, in place.
 * DELETE  remove a version.
 *
 * Two guarantees this route exists to provide:
 *
 * 1. GENERATION NEVER OVERWRITES. It always creates a new version, so a regeneration
 *    cannot eat the one that was already working. Marrs asked for iterations he can click
 *    between; the corollary is that nothing he made is replaced unless he says so.
 * 2. A HAND EDIT COSTS NO LLM CALL. Changing "medium" to "high" is a PUT and nothing else.
 *
 * Prezies are stored against the CONCEPT rather than the piece, so they outlive the piece
 * and can be reused (a podcast segment, a talk). The piece is recorded on the version so
 * the stage can show the ones built for it first.
 *
 * Team-scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { getCurrentUser } from '@/lib/console-auth';
import { getPiece, type MarketingPiece } from '@/lib/marketing/piece-store';
import {
  getPrezie,
  savePrezie,
  deletePrezie,
  listPreziesForConcept,
  conceptSlugFromRef,
  type Prezie,
} from '@/lib/marketing/prezie-store';
import { generateScene, MAX_FACTS, MAX_NODES } from '@/lib/marketing/scene-generate';
import { sanitiseImportedPrezie, describeImported } from '@/lib/marketing/prezie-import';
import { generatePrezieFromScript } from '@/lib/marketing/prezie-oneshot';
import { conceptBodyForPiece } from '@/lib/marketing/draft';
import { DraftError } from '@/lib/marketing/draft';
import { stripEmDashes } from '@/lib/em-dash';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/** The concept a piece's prezies belong to, or the unfiled bucket. */
const conceptOf = (piece: MarketingPiece) => conceptSlugFromRef(piece.concept_ref);

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

const GenerateSchema = z.object({
  /**
   * A WHOLE PREZIE, drawn elsewhere and pasted in.
   *
   * No LLM call and no generation: the file IS the prezie. The console's job here is to host it, give it
   * his touch sounds and the operator chrome, version it on the concept and hand back the studio URL.
   */
  imported_html: z.string().max(2_000_000).optional(),
  /**
   * Start an EMPTY FIGURE prezie (D33) instead of generating a board. No LLM call: the loop
   * begins with the operator describing the first picture, not with a guess at one.
   */
  figures: z.boolean().optional(),
  /**
   * ONE-SHOT the whole board from the script, instead of starting empty.
   *
   * Marrs got a complete five-figure prezie out of a single Claude pass after a week of failing to get
   * one board out of the figure-by-figure loop. The loop was not the problem; starting from nothing was.
   * This produces the spine and the existing per-figure loop fixes what missed.
   */
  oneshot: z.boolean().optional(),
  narrative: z.string().max(4000).optional(),
  direction: z.string().max(4000).optional(),
  /** The version to refine, when this is a follow-up rather than a fresh build. */
  from: z.string().trim().max(200).optional(),
  name: z.string().trim().max(120).optional(),
});

const SaveSchema = z.object({
  prezie_id: z.string().trim().min(1).max(200),
  name: z.string().trim().max(120).optional(),
  scene: SceneSchema,
});

const DeleteSchema = z.object({ prezie_id: z.string().trim().min(1).max(200) });

/** What the client renders in the version list: everything except the scene bodies. */
const summarise = (list: Prezie[], pieceId: string) =>
  list.map((p) => ({
    prezie_id: p.prezie_id,
    name: p.name,
    concept: p.concept,
    for_this_piece: p.piece_id === pieceId,
    created_at: p.created_at,
    updated_at: p.updated_at,
    url: `/console/prezie/${p.concept}/${p.prezie_id}`,
    node_count: p.imported ? 1 : (p.figures?.length ?? p.scene?.nodes.length ?? 0),
    imported: Boolean(p.imported),
  }));

/** undefined = the read failed; null = there is genuinely no such piece. */
async function loadPiece(owner: string, id: string) {
  try {
    return await getPiece(owner, id);
  } catch (err) {
    console.error('[prezie.versions] piece read failed:', err);
    return undefined;
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const piece = await loadPiece(user.email, id);
  if (piece === undefined) {
    return NextResponse.json({ error: 'could not read the piece' }, { status: 502 });
  }
  if (!piece) return NextResponse.json({ error: 'piece not found' }, { status: 404 });

  const concept = conceptOf(piece);

  // THE ONE-SHOT. A whole board from the script in one call, saved as a new version like any other, so
  // a disappointing pass costs nothing and the one that worked is still there to click back to.
  if (body.oneshot) {
    const script = (piece.script ?? '').trim();
    if (!script) {
      return NextResponse.json(
        { error: 'There is no script yet, and the one-shot builds from the script. Write it first.' },
        { status: 400 }
      );
    }
    try {
      const conceptBody = await conceptBodyForPiece(user.email, piece).catch(() => '');
      const { figures, model } = await generatePrezieFromScript(script, {
        concept: conceptBody,
        angle: piece.angle,
        direction: body.direction,
      });
      const now = new Date().toISOString();
      const prezie: Prezie = {
        prezie_id: randomUUID(),
        concept,
        piece_id: piece.piece_id,
        stream: piece.stream,
        owner: user.email,
        name: stripEmDashes(body.name?.trim() || `${piece.title} one-shot`),
        figures,
        created_at: now,
      };
      await savePrezie(prezie);
      const list = await listPreziesForConcept(concept);
      return NextResponse.json({
        ok: true,
        note: `${figures.length} figure${figures.length === 1 ? '' : 's'} built from the script. Open each one and change what missed.`,
        model,
        prezie: { ...prezie, url: `/console/prezie/${concept}/${prezie.prezie_id}` },
        versions: summarise(list, piece.piece_id),
      });
    } catch (e) {
      if (e instanceof DraftError && e.reason === 'empty') {
        return NextResponse.json(
          { error: 'That came back unusable. Try again, or give some direction first.' },
          { status: 502 }
        );
      }
      if (e instanceof DraftError && e.reason === 'no-concept') {
        return NextResponse.json({ error: 'The script is too short to build a board from.' }, { status: 400 });
      }
      console.error('[prezie.versions] one-shot failed:', e);
      return NextResponse.json(
        { error: 'April is unavailable right now. Try again in a moment.' },
        { status: 502 }
      );
    }
  }

  // AN IMPORT. Stored as-is, because the whole point is that the drawing is already right.
  if (body.imported_html?.trim()) {
    const html = sanitiseImportedPrezie(body.imported_html);
    const seen = describeImported(html);
    if (html.length < 200) {
      return NextResponse.json(
        { error: 'That looks too short to be a prezie. Paste the whole HTML file.' },
        { status: 400 }
      );
    }
    const now = new Date().toISOString();
    const prezie: Prezie = {
      prezie_id: randomUUID(),
      concept,
      piece_id: piece.piece_id,
      stream: piece.stream,
      owner: user.email,
      // His own <title> is the best name available, since he chose it when he made the thing.
      name: stripEmDashes(body.name?.trim() || seen.title || piece.title),
      imported: { html },
      created_at: now,
    };
    await savePrezie(prezie);
    const list = await listPreziesForConcept(concept);
    return NextResponse.json({
      ok: true,
      note: seen.looks_like_document
        ? 'Imported. It has your touch sounds and the operator strip on it now.'
        : 'Imported, though that did not look like a whole HTML document. Open it and check.',
      prezie: { ...prezie, url: `/console/prezie/${concept}/${prezie.prezie_id}` },
      versions: summarise(list, piece.piece_id),
    });
  }

  // An empty figure prezie is created directly. There is nothing to generate yet, and asking
  // April for an opening guess is what produced boards that ignored what he wanted.
  if (body.figures) {
    const now = new Date().toISOString();
    const prezie: Prezie = {
      prezie_id: randomUUID(),
      concept,
      piece_id: piece.piece_id,
      stream: piece.stream,
      owner: user.email,
      name: stripEmDashes(body.name?.trim() || piece.title),
      figures: [],
      created_at: now,
    };
    await savePrezie(prezie);
    const list = await listPreziesForConcept(concept);
    return NextResponse.json({
      ok: true,
      note: 'Started an empty prezie. Describe the first figure.',
      prezie: { ...prezie, url: `/console/prezie/${concept}/${prezie.prezie_id}` },
      versions: summarise(list, piece.piece_id),
    });
  }

  try {
    // Refining works from the named version, so a follow-up direction sharpens what is on
    // screen rather than starting again from the concept.
    const base = body.from ? await getPrezie(concept, body.from) : null;
    const { note, ...scene } = await generateScene(
      user.email,
      piece,
      body.direction ?? '',
      base?.scene ?? null,
      // The angle is the standing brief for the piece, so it applies even if the operator
      // cleared the narrative box.
      body.narrative?.trim() || piece.angle?.trim() || ''
    );

    const now = new Date().toISOString();
    const prezie: Prezie = {
      prezie_id: randomUUID(),
      concept,
      piece_id: piece.piece_id,
      stream: piece.stream,
      owner: user.email,
      name: stripEmDashes(body.name?.trim() || scene.title || piece.title),
      scene,
      created_at: now,
    };
    await savePrezie(prezie);

    const list = await listPreziesForConcept(concept);
    return NextResponse.json({
      ok: true,
      note,
      prezie: { ...prezie, url: `/console/prezie/${concept}/${prezie.prezie_id}` },
      versions: summarise(list, piece.piece_id),
    });
  } catch (e) {
    if (e instanceof DraftError && e.reason === 'no-concept') {
      return NextResponse.json(
        { error: 'Nothing to build from yet. Give it a narrative, or write the script first.' },
        { status: 400 }
      );
    }
    if (e instanceof DraftError && e.reason === 'empty') {
      return NextResponse.json(
        { error: 'That came back unusable. Try again, or give more direction.' },
        { status: 502 }
      );
    }
    console.error('[prezie.versions] build failed:', e);
    return NextResponse.json(
      { error: 'April is unavailable right now. Try again in a moment.' },
      { status: 502 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof SaveSchema>;
  try {
    body = SaveSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid prezie' }, { status: 400 });
  }

  const piece = await loadPiece(user.email, id);
  if (piece === undefined) {
    return NextResponse.json({ error: 'could not read the piece' }, { status: 502 });
  }
  if (!piece) return NextResponse.json({ error: 'piece not found' }, { status: 404 });

  const concept = conceptOf(piece);
  const existing = await getPrezie(concept, body.prezie_id);
  if (!existing) {
    return NextResponse.json({ error: 'That version is gone. Reload the page.' }, { status: 409 });
  }

  // The operator's own words go through the em-dash rule too: it applies to every
  // user-facing string this repo emits, not only the generated ones.
  const next: Prezie = {
    ...existing,
    name: stripEmDashes(body.name?.trim() || existing.name),
    scene: {
      title: stripEmDashes(body.scene.title ?? body.scene.concept),
      concept: stripEmDashes(body.scene.concept),
      nodes: body.scene.nodes.map((n) => ({
        label: stripEmDashes(n.label),
        colour: n.colour,
        facts: n.facts.map((f) => ({
          label: stripEmDashes(f.label),
          value: stripEmDashes(f.value),
        })),
      })),
      close: body.scene.close ? stripEmDashes(body.scene.close) : undefined,
    },
    updated_at: new Date().toISOString(),
  };

  try {
    await savePrezie(next);
  } catch (err) {
    console.error('[prezie.versions] save failed:', err);
    return NextResponse.json({ error: 'could not save' }, { status: 502 });
  }

  const list = await listPreziesForConcept(concept);
  return NextResponse.json({
    ok: true,
    prezie: { ...next, url: `/console/prezie/${concept}/${next.prezie_id}` },
    versions: summarise(list, piece.piece_id),
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof DeleteSchema>;
  try {
    body = DeleteSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const piece = await loadPiece(user.email, id);
  if (piece === undefined) {
    return NextResponse.json({ error: 'could not read the piece' }, { status: 502 });
  }
  if (!piece) return NextResponse.json({ error: 'piece not found' }, { status: 404 });

  const concept = conceptOf(piece);
  if (!(await getPrezie(concept, body.prezie_id))) {
    return NextResponse.json({ error: 'That version is already gone.' }, { status: 409 });
  }

  await deletePrezie(concept, body.prezie_id);
  const list = await listPreziesForConcept(concept);
  return NextResponse.json({ ok: true, versions: summarise(list, piece.piece_id) });
}
