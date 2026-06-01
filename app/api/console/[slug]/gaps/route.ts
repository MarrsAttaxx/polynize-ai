/**
 * GET /api/console/[slug]/gaps — the derived Gap Register.
 * Read endpoint (auth required, not team scope). Spec §8.2.
 *
 * Aggregates the three sources (gaps_to_close + scope_uncertainty +
 * decisions_deferred) at request time via deriveGapRegister.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { isValidConsoleSlug } from '@/app/console/_config/clients';
import {
  authorizeClientAccess,
  requireConsoleAuth,
} from '@/lib/console-api-auth';
import { loadBlueprintV2, deriveGapRegister } from '@/lib/blueprint/load-v2';

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

  const v2 = await loadBlueprintV2(slug);
  if (!v2)
    return NextResponse.json(
      { error: 'No Stage 2 Blueprint for this engagement' },
      { status: 404 }
    );

  return NextResponse.json({ slug, gaps: deriveGapRegister(v2) });
}
