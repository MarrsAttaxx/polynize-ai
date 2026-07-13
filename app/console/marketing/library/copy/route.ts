/**
 * POST /console/marketing/library/copy — copy a concept into another stream
 * (Concept Library). A COPY, never a move: saveConcept runs with forceNew so
 * the source concept is untouched and the copy gets its own slug. Team-scope
 * only; owner from the session (concepts are owner-scoped, so the library can
 * only ever copy the signed-in owner's own concepts across their streams).
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { getConcept, saveConcept } from '@/lib/marketing/concept-store';
import { STREAM_IDS } from '@/lib/marketing/streams';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  slug: z.string().min(1).max(120),
  targetStream: z.enum(STREAM_IDS),
});

export async function POST(req: NextRequest) {
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

  let source;
  try {
    source = await getConcept(user.email, body.slug);
  } catch (err) {
    console.error('[library.copy] source read failed:', err);
    return NextResponse.json({ error: 'could not read the concept' }, { status: 502 });
  }
  if (!source) {
    return NextResponse.json({ error: 'concept not found' }, { status: 404 });
  }
  if (source.stream === body.targetStream) {
    return NextResponse.json(
      { error: 'this concept is already in that stream' },
      { status: 400 }
    );
  }

  try {
    const copy = await saveConcept(
      {
        owner: user.email,
        stream: body.targetStream,
        framing: source.framing,
        title: source.title,
        body_md: source.body_md,
      },
      { forceNew: true }
    );
    return NextResponse.json({ ok: true, slug: copy.framing_slug });
  } catch (err) {
    console.error('[library.copy] save failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'copy failed' },
      { status: 500 }
    );
  }
}
