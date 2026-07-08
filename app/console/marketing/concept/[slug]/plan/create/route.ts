/**
 * POST /console/marketing/concept/[slug]/plan/create — the Output-plan step (D19/D23).
 *
 * Replaces the old "develop into a script" shortcut. From a concept, the owner's
 * selected outputs fan out to one piece each: every piece shares the concept
 * (concept_ref), carries the plan (format, platforms, icp, pillar, framing), and
 * routes to its format module. Video pieces open on the Script screen; text
 * pieces on the text output screen. Only `built` formats create pieces (coming
 * formats are not selectable), so the step never spawns dead pieces.
 *
 * Idempotent per (concept, format): re-planning an already-created output returns
 * the existing piece rather than duplicating. Team-scope only; owner from session.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { getConcept } from '@/lib/marketing/concept-store';
import {
  listSavedPieces,
  savePiece,
  type MarketingPiece,
} from '@/lib/marketing/piece-store';
import { formatById } from '@/lib/marketing/output-plan';
import { scaffoldScript } from '@/lib/marketing/concept-parse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  formats: z.array(z.string().max(60)).min(1).max(12),
  platforms: z.record(z.string(), z.array(z.string().max(40)).max(10)).optional(),
  icp: z.string().max(60).optional(),
  pillar: z.string().max(120).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  // Keep only formats that actually have a production module. Anything else is
  // "coming" and must not create a piece with nowhere to go.
  const selected = [...new Set(body.formats)]
    .map((id) => formatById(id))
    .filter((f): f is NonNullable<typeof f> => !!f && f.module === 'built');
  if (selected.length === 0) {
    return NextResponse.json(
      { error: 'select at least one available format' },
      { status: 400 }
    );
  }

  let concept;
  try {
    concept = await getConcept(user.email, slug);
  } catch (err) {
    console.error('[concept.plan] concept read failed:', err);
    return NextResponse.json({ error: 'could not read the concept' }, { status: 502 });
  }
  if (!concept) {
    return NextResponse.json({ error: 'concept not found' }, { status: 404 });
  }

  try {
    const existing = await listSavedPieces(user.email);
    const pieces: { pieceId: string; format: string; kind: string; reused: boolean }[] = [];

    for (const fmt of selected) {
      const prior = existing.find(
        (p) => p.concept_ref === concept.concept_ref && p.format === fmt.id
      );
      if (prior) {
        pieces.push({ pieceId: prior.piece_id, format: fmt.id, kind: fmt.kind, reused: true });
        continue;
      }

      const platforms =
        body.platforms?.[fmt.id]?.filter((c) => fmt.channels.includes(c)) ??
        fmt.channels.slice();

      const piece: MarketingPiece = {
        piece_id: crypto.randomUUID(),
        owner: user.email,
        stream: concept.stream,
        format: fmt.id,
        kind: fmt.kind,
        title: concept.title,
        concept_ref: concept.concept_ref,
        framing: concept.framing,
        pillar: body.pillar || undefined,
        icp: body.icp || undefined,
        platforms,
        status: 'draft',
        // Video is a human on-camera capture (D22). Text is authored copy: no
        // media provenance until it gains generated assets.
        ...(fmt.kind === 'video' ? { provenance: 'human_capture' as const } : {}),
        stage: fmt.kind === 'video' ? 'script' : 'draft',
        script: fmt.kind === 'video' ? scaffoldScript(concept.framing, concept.body_md) : '',
        body: fmt.kind === 'video' ? undefined : '',
      };
      await savePiece(user.email, piece);
      pieces.push({ pieceId: piece.piece_id, format: fmt.id, kind: fmt.kind, reused: false });
    }

    // One output → open it directly; several → land on the concept hub listing them.
    const primary = pieces[0];
    const target =
      pieces.length === 1
        ? `/console/marketing/piece/${primary.pieceId}`
        : `/console/marketing/concept/${slug}`;
    return NextResponse.json({ pieces, target });
  } catch (err) {
    console.error('[concept.plan] create failed:', err);
    return NextResponse.json({ error: 'could not create the outputs' }, { status: 500 });
  }
}
