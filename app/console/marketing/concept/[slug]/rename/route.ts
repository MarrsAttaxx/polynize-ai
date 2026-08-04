/**
 * POST /console/marketing/concept/[slug]/rename — change a concept's display name.
 *
 * Marrs needs this because the generated names do not come out right and a concept is the
 * thing everything else hangs off: if it is called the wrong thing, the whole stream is
 * unreadable. The SLUG never moves (see `renameConcept`), so nothing keyed to it breaks.
 *
 * Team-scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { renameConcept } from '@/lib/marketing/concept-store';
import { stripEmDashes } from '@/lib/em-dash';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({ title: z.string().trim().min(1).max(200) });

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

  try {
    const next = await renameConcept(user.email, slug, stripEmDashes(body.title));
    if (!next) return NextResponse.json({ error: 'concept not found' }, { status: 404 });
    return NextResponse.json({ ok: true, title: next.title });
  } catch (err) {
    console.error('[concept.rename] failed:', err);
    return NextResponse.json({ error: 'could not rename it' }, { status: 502 });
  }
}
