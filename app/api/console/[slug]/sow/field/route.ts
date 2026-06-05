/**
 * POST /api/console/[slug]/sow/field
 *
 * Edits one field in sow/sow.json. Body: { path, value }. `path` is an
 * allowlisted dotted path (human.<key> or auto.<...>); see applySowFieldEdit.
 * Read-modify-write against the current file.
 *
 * Access control: the team may edit any field; a CLIENT (own slug only) may
 * edit only client-owned HUMAN fields (the orange fields), enforced by
 * authorizeSowFieldEdit. This is the second client-write path after questions.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isValidConsoleSlug } from '@/app/console/_config/clients';
import {
  authorizeClientAccess,
  requireConsoleAuth,
} from '@/lib/console-api-auth';
import {
  applySowFieldEdit,
  authorizeSowFieldEdit,
  readSowDoc,
  writeSowDoc,
} from '@/lib/sow/sow-io';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  path: z.string().min(1).max(200),
  value: z.string().max(8000),
});

export async function POST(
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

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Invalid body', detail: parsed.error.message },
      { status: 400 }
    );

  // Field-level access control: team edits anything; a client edits only
  // client-owned (orange) HUMAN fields. polynize + auto.* paths stay team-only.
  const fieldGate = authorizeSowFieldEdit(
    parsed.data.path,
    auth.scope.type === 'team'
  );
  if (!fieldGate.ok)
    return NextResponse.json(
      { error: fieldGate.error },
      { status: fieldGate.status }
    );

  const doc = await readSowDoc(slug);
  if (!doc)
    return NextResponse.json(
      { error: 'SoW not generated yet for this engagement' },
      { status: 404 }
    );

  const edit = applySowFieldEdit(doc, parsed.data.path, parsed.data.value);
  if (!edit.ok)
    return NextResponse.json({ error: edit.error }, { status: 400 });

  const message =
    `Edit SoW field ${parsed.data.path} for ${slug}\n\n` +
    `Actor: ${auth.actor.id}\nSource: ${auth.actor.source}`;

  try {
    const commit = await writeSowDoc(slug, edit.doc, message);
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
