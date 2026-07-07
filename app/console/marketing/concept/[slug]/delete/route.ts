/**
 * POST /console/marketing/concept/[slug]/delete — delete a concept doc.
 *
 * Team-scope only; owner from the session, so a slug alone can't delete another
 * owner's concept. Removes the concept from the bucket (or the interim store).
 * The concept's completed job record, if any, is inert (not listed anywhere), so
 * it is left as-is. Returns { ok: true }.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/console-auth';
import { deleteConcept } from '@/lib/marketing/concept-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    await deleteConcept(user.email, slug);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[concept.delete] failed:', err);
    return NextResponse.json({ error: 'could not delete the concept' }, { status: 500 });
  }
}
