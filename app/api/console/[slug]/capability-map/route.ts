/**
 * GET /api/console/[slug]/capability-map — the v0.5 envelope only.
 * Read endpoint (auth required, not team scope). Spec §8.2.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { isValidConsoleSlug } from '@/app/console/_config/clients';
import { readClientFile } from '@/lib/github-client';
import {
  authorizeClientAccess,
  requireConsoleAuth,
} from '@/lib/console-api-auth';
import { LenientCapabilityMapV05EnvelopeSchema } from '@/lib/blueprint/schema-v2';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await requireConsoleAuth(request);
  if (!auth.ok)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { slug } = await params;
  if (!isValidConsoleSlug(slug))
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  if (!authorizeClientAccess(auth.scope, slug))
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  try {
    const raw = await readClientFile(slug, 'modelling/capability-map.json');
    const json = JSON.parse(raw);
    // Liberal on read (same as the loader): accept the broader real-world
    // vocabulary. The website's strict generation gate is unaffected.
    const parsed = LenientCapabilityMapV05EnvelopeSchema.safeParse(json);
    if (!parsed.success)
      return NextResponse.json(
        { error: 'capability-map.json failed validation' },
        { status: 422 }
      );
    return NextResponse.json(parsed.data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Not Found|404/i.test(msg))
      return NextResponse.json(
        { error: 'No capability map for this engagement' },
        { status: 404 }
      );
    return NextResponse.json({ error: 'Read failed', detail: msg }, { status: 500 });
  }
}
