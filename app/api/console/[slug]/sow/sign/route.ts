/**
 * POST /api/console/[slug]/sow/sign — the client signs the SoW.
 *
 * Client-write path that LOCKS a legal document, so it is gated tightly:
 *   - requireConsoleAuth + authorizeClientAccess → signed-in, own slug only
 *   - authorizeSowSign(doc) → the doc must not already be locked AND all
 *     client-owned (orange) fields must be filled first
 * It only ever sets the client signature + lock (applySignature). It cannot
 * edit any other field, cannot touch the Polynize signature, and cannot
 * unlock. Both client and team scope may sign (the signer email is recorded);
 * the gate is readiness + not-already-locked, not scope.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isValidConsoleSlug } from '@/app/console/_config/clients';
import {
  authorizeClientAccess,
  requireConsoleAuth,
} from '@/lib/console-api-auth';
import {
  applySignature,
  authorizeSowSign,
  readSowDoc,
  writeSowDoc,
} from '@/lib/sow/sow-io';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({ signature: z.string().min(1).max(200) });

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
      { error: 'A signature name is required', detail: parsed.error.message },
      { status: 400 }
    );

  const doc = await readSowDoc(slug);
  if (!doc)
    return NextResponse.json(
      { error: 'SoW not generated yet for this engagement' },
      { status: 404 }
    );

  // Signing-specific gate: not already locked, and all client fields filled.
  const gate = authorizeSowSign(doc);
  if (!gate.ok)
    return NextResponse.json({ error: gate.error }, { status: gate.status });

  const signed = applySignature(
    doc,
    parsed.data.signature,
    auth.actor.id,
    new Date().toISOString()
  );

  const message =
    `Sign SoW for ${slug}\n\n` +
    `Actor: ${auth.actor.id}\nSource: ${auth.actor.source}`;

  try {
    const commit = await writeSowDoc(slug, signed, message);
    return NextResponse.json({
      ok: true,
      slug,
      signed_by: auth.actor.id,
      commit,
    });
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
