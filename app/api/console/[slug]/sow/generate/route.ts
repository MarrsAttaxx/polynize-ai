/**
 * POST /api/console/[slug]/sow/generate
 *
 * Team-scoped. Merges the engagement's Blueprint (capability-map.json +
 * engagement-model.json) into a Statement of Works and writes sow/sow.json.
 * Regenerating overwrites the merged AUTO content and re-seeds HUMAN defaults
 * (it does NOT preserve prior human edits — regeneration is a fresh merge).
 *
 * No readiness gate by design (for now): the action is available at any
 * completeness so the team can build and test the SoW while engagements are
 * under 100%.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { isValidConsoleSlug } from '@/app/console/_config/clients';
import {
  authorizeClientAccess,
  requireConsoleAuth,
  requireTeamScope,
} from '@/lib/console-api-auth';
import { loadBlueprintV2 } from '@/lib/blueprint/load-v2';
import { generateSowDoc, preserveUserHumanValues } from '@/lib/sow/generate';
import { readSowDoc, writeSowDoc } from '@/lib/sow/sow-io';

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

  const blueprint = await loadBlueprintV2(slug);
  if (!blueprint) {
    return NextResponse.json(
      { error: 'No Blueprint to generate from (capability-map.json missing)' },
      { status: 422 }
    );
  }

  const now = new Date();
  const iso = now.toISOString();
  const dateStamp = iso.slice(0, 10).replace(/-/g, '');
  const version = blueprint.config?.blueprint_schema_version
    ? `v${blueprint.config.blueprint_schema_version}`
    : 'v2.0';

  const fresh = generateSowDoc(blueprint, {
    timestampIso: iso,
    dateStamp,
    blueprintVersion: version,
  });

  // Regenerate refreshes all AUTO content from the current Blueprint but
  // preserves any HUMAN field the user has actually completed (non-empty and
  // different from its registry default). First generation has no existing doc.
  const existing = await readSowDoc(slug);
  const doc = preserveUserHumanValues(fresh, existing);

  const message =
    `Generate SoW for ${slug}\n\n` +
    `Actor: ${auth.actor.id}\nSource: ${auth.actor.source}`;

  try {
    const commit = await writeSowDoc(slug, doc, message);
    return NextResponse.json({ ok: true, slug, sow_reference: doc.sow_reference, commit });
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
