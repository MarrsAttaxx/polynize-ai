/**
 * GET /api/console/[slug]/engagement-model — benchmarking/uplift/motions.
 * Read endpoint (auth required, not team scope). Spec §8.2.
 * 404 if the engagement model does not exist yet (Lead / pre-Modelling).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { isValidConsoleSlug } from '@/app/console/_config/clients';
import { readClientFile } from '@/lib/github-client';
import {
  authorizeClientAccess,
  requireConsoleAuth,
} from '@/lib/console-api-auth';
import { EngagementModelSchema } from '@/lib/blueprint/schema-v2';

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
    const raw = await readClientFile(slug, 'modelling/engagement-model.json');
    const json = JSON.parse(raw);
    const parsed = EngagementModelSchema.safeParse(json);
    if (!parsed.success)
      return NextResponse.json(
        { error: 'engagement-model.json failed validation' },
        { status: 422 }
      );
    return NextResponse.json(parsed.data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Not Found|404/i.test(msg))
      return NextResponse.json(
        { error: 'No engagement model yet (pending Modelling phase)' },
        { status: 404 }
      );
    return NextResponse.json({ error: 'Read failed', detail: msg }, { status: 500 });
  }
}
