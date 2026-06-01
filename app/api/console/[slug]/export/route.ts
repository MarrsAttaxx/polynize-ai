/**
 * GET /api/console/[slug]/export
 *
 * Returns a complete-context markdown snapshot of the engagement
 * (Amendment 1 / Landmark 11.5). A read operation: available to any
 * authenticated user who can view the Blueprint (team AND client scope).
 * Also exposed on the Ben read surface (no approval, it's a read).
 *
 * Response: text/markdown body. The browser-side Export button reads it
 * and triggers a download named complete-context-<slug>-<date>.md.
 *
 * Only v2.0 engagements have the JSON canonical files this assembles from.
 * Legacy 1.x engagements return 409 (export is a Stage 2 feature).
 */

import { type NextRequest, NextResponse } from 'next/server';
import YAML from 'yaml';
import { isValidConsoleSlug } from '@/app/console/_config/clients';
import { readClientFile } from '@/lib/github-client';
import {
  authorizeClientAccess,
  requireConsoleAuth,
} from '@/lib/console-api-auth';
import { loadBlueprintV2 } from '@/lib/blueprint/load-v2';
import {
  assembleContextMarkdown,
  type ExportNarrative,
} from '@/lib/blueprint/export-context';
import { parseBlueprint } from '@/app/console/_lib/parse-blueprint';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function aestTimestamp(): string {
  // Format the current instant in AEST (Australia/Sydney) for the header.
  try {
    const fmt = new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Sydney',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${fmt.format(new Date())} (AEST)`;
  } catch {
    return `${new Date().toISOString()} (UTC)`;
  }
}

function isoDate(): string {
  // YYYY-MM-DD for the filename.
  return new Date().toISOString().slice(0, 10);
}

async function loadNarrative(slug: string): Promise<ExportNarrative> {
  try {
    const md = await readClientFile(slug, 'modelling/blueprint.md');
    const parsed = parseBlueprint(md);
    const infra = parsed.sections.find((s) => s.id === 'infrastructure');
    const decisions = parsed.sections.find((s) => s.id === 'decisions');
    return {
      infrastructure: infra?.content ?? null,
      decisions: decisions?.content ?? null,
    };
  } catch {
    return {};
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await requireConsoleAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { slug } = await params;
  if (!isValidConsoleSlug(slug)) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }
  // Read operation — client-scope users can export their own engagement.
  if (!authorizeClientAccess(auth.scope, slug)) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  // Confirm this is a 2.0 engagement; export assembles from JSON canonical.
  let schemaVersion = '1.0';
  try {
    const cfgRaw = await readClientFile(slug, '.polynize/client-config.yaml');
    const cfg = YAML.parse(cfgRaw) as { blueprint_schema_version?: string };
    schemaVersion = cfg?.blueprint_schema_version ?? '1.0';
  } catch {
    // fall through; loadBlueprintV2 will return null if no capability-map.json
  }
  if (schemaVersion !== '2.0') {
    return NextResponse.json(
      { error: 'Context export is available for Stage 2 (2.0) Blueprints only' },
      { status: 409 }
    );
  }

  const blueprint = await loadBlueprintV2(slug);
  if (!blueprint) {
    return NextResponse.json(
      { error: 'No Stage 2 Blueprint data to export' },
      { status: 404 }
    );
  }

  const narrative = await loadNarrative(slug);
  const markdown = assembleContextMarkdown(blueprint, aestTimestamp(), narrative);

  const filename = `complete-context-${slug}-${isoDate()}.md`;

  return new NextResponse(markdown, {
    status: 200,
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}
