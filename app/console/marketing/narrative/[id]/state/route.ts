/**
 * PUT /console/marketing/narrative/[id]/state: the one write path for a narrative's
 * fields and gate moves (D40). Accepts a partial: article, gate, kit. The gate
 * value is validated against the real set; everything else is normalized by the
 * store, so a malformed payload can never persist a broken narrative.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/console-auth';
import { getNarrative, saveNarrative, type NarrativeGate } from '@/lib/marketing/narrative-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const GATES: NarrativeGate[] = [1, 2, 3, 4, 5, 'shipped'];

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    article?: unknown;
    gate?: unknown;
    kit?: unknown;
  } | null;
  if (!body) return NextResponse.json({ error: 'invalid json' }, { status: 400 });

  let narrative;
  try {
    narrative = await getNarrative(id);
  } catch (err) {
    console.error('[narrative.state] read failed:', err);
    return NextResponse.json({ error: 'could not read the narrative' }, { status: 502 });
  }
  if (!narrative) return NextResponse.json({ error: 'narrative not found' }, { status: 404 });

  if (typeof body.article === 'string') narrative.article = body.article.slice(0, 40000);
  if (body.gate !== undefined) {
    if (!GATES.includes(body.gate as NarrativeGate)) {
      return NextResponse.json({ error: 'invalid gate' }, { status: 400 });
    }
    narrative.gate = body.gate as NarrativeGate;
  }
  if (Array.isArray(body.kit)) {
    narrative.kit = body.kit.filter((x): x is string => typeof x === 'string').slice(0, 40);
  }

  try {
    await saveNarrative(narrative);
    return NextResponse.json({ narrative });
  } catch (err) {
    console.error('[narrative.state] save failed:', err);
    return NextResponse.json({ error: 'save failed' }, { status: 500 });
  }
}
