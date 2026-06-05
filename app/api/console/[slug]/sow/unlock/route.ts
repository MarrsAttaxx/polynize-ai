/**
 * POST /api/console/[slug]/sow/unlock — reopen a signed SoW for editing.
 *
 * TEAM ONLY (requireTeamScope). Unlocking clears the client signature (an
 * unlocked agreement is no longer signed; re-signing is required) and records
 * the unlock audit. The Polynize pre-signature is untouched (it is a HUMAN
 * field default, not stored in the signing block).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { isValidConsoleSlug } from '@/app/console/_config/clients';
import {
  authorizeClientAccess,
  requireConsoleAuth,
  requireTeamScope,
} from '@/lib/console-api-auth';
import { applyUnlock, readSowDoc, writeSowDoc } from '@/lib/sow/sow-io';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await requireConsoleAuth(request);
  if (!auth.ok)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  const teamGate = requireTeamScope(auth);
  if (!teamGate.ok)
    return NextResponse.json(
      { error: teamGate.error },
      { status: teamGate.status }
    );

  const { slug } = await params;
  if (!isValidConsoleSlug(slug))
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  if (!authorizeClientAccess(auth.scope, slug))
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const doc = await readSowDoc(slug);
  if (!doc)
    return NextResponse.json(
      { error: 'SoW not generated yet for this engagement' },
      { status: 404 }
    );

  if (!doc.signing.locked) {
    // Idempotent: already unlocked.
    return NextResponse.json({ ok: true, slug, alreadyUnlocked: true });
  }

  const unlocked = applyUnlock(doc, auth.actor.id, new Date().toISOString());

  const message =
    `Unlock SoW for ${slug} (clears client signature)\n\n` +
    `Actor: ${auth.actor.id}\nSource: ${auth.actor.source}`;

  try {
    const commit = await writeSowDoc(slug, unlocked, message);
    return NextResponse.json({ ok: true, slug, commit });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Commit failed',
        detail: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 }
    );
  }
}
