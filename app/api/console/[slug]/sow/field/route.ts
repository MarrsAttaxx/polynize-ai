/**
 * POST /api/console/[slug]/sow/field
 *
 * Team-scoped. Edits one field in sow/sow.json. Body: { path, value }.
 * `path` is an allowlisted dotted path (human.<key> or auto.<...>); see
 * applySowFieldEdit. Read-modify-write against the current file.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isValidConsoleSlug } from '@/app/console/_config/clients';
import {
  authorizeClientAccess,
  requireConsoleAuth,
  requireTeamScope,
} from '@/lib/console-api-auth';
import { applySowFieldEdit, readSowDoc, writeSowDoc } from '@/lib/sow/sow-io';

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
