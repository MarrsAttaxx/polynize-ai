/**
 * POST /console/marketing/concept/[slug]/develop — turn a concept into a piece.
 *
 * The bridge from the concept bank into production: creates a piece in the
 * concept's stream, seeded with a starting script scaffold derived from the
 * concept's key beats, and returns its id so the client lands on the Script
 * screen. Idempotent per (concept, format): re-developing returns the existing
 * piece instead of duplicating. Team-scope only; owner from the session.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/console-auth';
import { getConcept } from '@/lib/marketing/concept-store';
import {
  listSavedPieces,
  savePiece,
  type MarketingPiece,
} from '@/lib/marketing/piece-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// v1 develops into short-form video; a format picker / multi-format fan-out
// (long-form, carousel, LinkedIn post) is the richer version.
const DEFAULT_FORMAT = 'short_form_video';

const SECTIONS = new Set([
  'framing',
  'core thesis',
  'who it is for',
  'key beats',
  'proof or story',
  'where it lands',
  'source voice',
]);

function sectionOf(line: string): string | null {
  const t = line.trim().replace(/^#+\s*/, '').replace(/:$/, '').toLowerCase();
  return SECTIONS.has(t) ? t : null;
}

/** Build a starting script from the concept: HOOK + the key beats + CTA. */
function scaffoldFromConcept(framing: string, bodyMd: string): string {
  const beats: string[] = [];
  let inBeats = false;
  for (const line of bodyMd.split('\n')) {
    const section = sectionOf(line);
    if (section) {
      inBeats = section === 'key beats';
      continue;
    }
    if (!inBeats) continue;
    const m = line.match(/^\s*(?:[-*]|\d+[.)])\s+(.*\S)/);
    if (m) beats.push(m[1].trim());
  }
  const parts: string[] = ['HOOK', framing.trim(), ''];
  beats.forEach((b, i) => parts.push(`BEAT ${i + 1}`, b, ''));
  parts.push('CTA', '');
  return parts.join('\n').trimEnd() + '\n';
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let concept;
  try {
    concept = await getConcept(user.email, slug);
  } catch (err) {
    console.error('[concept.develop] concept read failed:', err);
    return NextResponse.json({ error: 'could not read the concept' }, { status: 502 });
  }
  if (!concept) {
    return NextResponse.json({ error: 'concept not found' }, { status: 404 });
  }

  try {
    // Idempotent: reuse an existing piece for this concept + format.
    const existing = (await listSavedPieces(user.email)).find(
      (p) => p.concept_ref === concept.concept_ref && p.format === DEFAULT_FORMAT
    );
    if (existing) {
      return NextResponse.json({ pieceId: existing.piece_id, reused: true });
    }

    const piece: MarketingPiece = {
      piece_id: crypto.randomUUID(),
      owner: user.email,
      stream: concept.stream,
      format: DEFAULT_FORMAT,
      title: concept.title,
      concept_ref: concept.concept_ref,
      stage: 'script',
      script: scaffoldFromConcept(concept.framing, concept.body_md),
    };
    await savePiece(user.email, piece);
    return NextResponse.json({ pieceId: piece.piece_id });
  } catch (err) {
    console.error('[concept.develop] create failed:', err);
    return NextResponse.json({ error: 'could not create the piece' }, { status: 500 });
  }
}
