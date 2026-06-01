/**
 * POST /api/console/[slug]/gaps/[gapRef]/status
 *
 * Tier 1, lock-gated (gaps live in the Engagement section). Marks a gap
 * addressed. Gaps are not stored separately — they are derived from
 * capability-map.json (gaps_to_close + map_reflection). Marking a gap
 * addressed removes it from its source array. Git history is the undo.
 *
 * gapRef forms (from deriveGapRegister):
 *   cap.<capId>.<index>   → capabilities[capId].gaps_to_close[index]
 *   scope.<index>         → map_reflection.scope_uncertainty[index]
 *   decision.<index>      → map_reflection.decisions_deferred[index]
 *
 * Body: { addressed: boolean, note?: string }. addressed:true removes the
 * gap. addressed:false is a no-op in v1 (cannot re-add a removed gap;
 * restore from git history).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isValidConsoleSlug } from '@/app/console/_config/clients';
import { readClientFile, writeClientFile } from '@/lib/github-client';
import {
  authorizeClientAccess,
  requireConsoleAuth,
  requireTeamScope,
} from '@/lib/console-api-auth';
import { CapabilityMapV05EnvelopeSchema } from '@/lib/blueprint/schema-v2';
import { getLockState } from '@/lib/blueprint/lock-io';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAP_PATH = 'modelling/capability-map.json';
const BodySchema = z.object({
  addressed: z.boolean(),
  note: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; gapRef: string }> }
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

  const { slug, gapRef } = await params;
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

  if (!parsed.data.addressed) {
    return NextResponse.json({
      ok: true,
      noop: true,
      note: 'addressed:false is a no-op in v1; restore gaps from git history.',
    });
  }

  // Lock gate.
  const lock = await getLockState(slug);
  if (lock.locked) {
    return NextResponse.json(
      { error: 'Engagement section is locked', locked: true },
      { status: 423 }
    );
  }

  // Load capability-map.json.
  let mapRaw: string;
  try {
    mapRaw = await readClientFile(slug, MAP_PATH);
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to read capability-map.json', detail: err instanceof Error ? err.message : 'unknown' },
      { status: 500 }
    );
  }
  let json: unknown;
  try {
    json = JSON.parse(mapRaw);
  } catch {
    return NextResponse.json({ error: 'capability-map.json is not valid JSON' }, { status: 422 });
  }
  const env = CapabilityMapV05EnvelopeSchema.safeParse(json);
  if (!env.success)
    return NextResponse.json({ error: 'capability-map.json failed validation' }, { status: 422 });
  const map = env.data.capability_map;

  // Parse the gapRef and remove the target gap.
  const refParts = gapRef.split('.');
  let removed = false;
  if (refParts[0] === 'cap' && refParts.length === 3) {
    const capId = refParts[1];
    const idx = parseInt(refParts[2], 10);
    const cap = map.capabilities.find((c) => c.id === capId);
    if (cap && idx >= 0 && idx < cap.gaps_to_close.length) {
      cap.gaps_to_close.splice(idx, 1);
      removed = true;
    }
  } else if (refParts[0] === 'scope' && refParts.length === 2) {
    const idx = parseInt(refParts[1], 10);
    if (idx >= 0 && idx < map.map_reflection.scope_uncertainty.length) {
      map.map_reflection.scope_uncertainty.splice(idx, 1);
      removed = true;
    }
  } else if (refParts[0] === 'decision' && refParts.length === 2) {
    const idx = parseInt(refParts[1], 10);
    if (idx >= 0 && idx < map.map_reflection.decisions_deferred.length) {
      map.map_reflection.decisions_deferred.splice(idx, 1);
      removed = true;
    }
  } else {
    return NextResponse.json({ error: 'Malformed gapRef' }, { status: 400 });
  }

  if (!removed) {
    return NextResponse.json(
      { error: 'Gap not found at the given ref' },
      { status: 404 }
    );
  }

  const newJson = JSON.stringify({ capability_map: map }, null, 2) + '\n';
  const message =
    `Mark ${slug} gap ${gapRef} addressed\n\n` +
    (parsed.data.note ? `Note: ${parsed.data.note}\n` : '') +
    `Actor: ${auth.actor.id}\nSource: ${auth.actor.source}`;

  try {
    const commit = await writeClientFile(slug, MAP_PATH, newJson, message);
    return NextResponse.json({ ok: true, slug, gapRef, commit });
  } catch (err) {
    return NextResponse.json(
      { error: 'Commit failed', detail: err instanceof Error ? err.message : 'unknown' },
      { status: 500 }
    );
  }
}
