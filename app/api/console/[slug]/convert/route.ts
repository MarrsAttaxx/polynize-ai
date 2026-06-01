/**
 * POST /api/console/[slug]/convert — convert a Lead to a Client.
 *
 * Sets engagement_status: client in client-config.yaml. Team-scope only.
 * Manual conversion in v1 (Stripe/payment automation deferred per spec §12).
 *
 * Not lock-related and not part of the Engagement section, so no lock
 * check. This is a dashboard operation (Lead pipeline → Client roster).
 */

import { type NextRequest, NextResponse } from 'next/server';
import YAML from 'yaml';
import { isValidConsoleSlug } from '@/app/console/_config/clients';
import { readClientFile, writeClientFile } from '@/lib/github-client';
import {
  authorizeClientAccess,
  requireConsoleAuth,
  requireTeamScope,
} from '@/lib/console-api-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CONFIG_PATH = '.polynize/client-config.yaml';

type ConfigShape = {
  engagement_status?: string;
  [key: string]: unknown;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await requireConsoleAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const teamGate = requireTeamScope(auth);
  if (!teamGate.ok) {
    return NextResponse.json(
      { error: teamGate.error },
      { status: teamGate.status }
    );
  }

  const { slug } = await params;
  if (!isValidConsoleSlug(slug)) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }
  if (!authorizeClientAccess(auth.scope, slug)) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  let config: ConfigShape;
  try {
    const yamlText = await readClientFile(slug, CONFIG_PATH);
    config = (YAML.parse(yamlText) ?? {}) as ConfigShape;
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Failed to read client-config.yaml',
        detail: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 }
    );
  }

  if (config.engagement_status === 'client') {
    return NextResponse.json({ ok: true, slug, alreadyClient: true });
  }

  config.engagement_status = 'client';

  const message =
    `Convert ${slug} from Lead to Client\n\n` +
    `Actor: ${auth.actor.id}\nSource: ${auth.actor.source}`;

  try {
    const commit = await writeClientFile(
      slug,
      CONFIG_PATH,
      YAML.stringify(config),
      message
    );
    return NextResponse.json({
      ok: true,
      slug,
      engagement_status: 'client',
      commit: { sha: commit.sha, url: commit.url },
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
