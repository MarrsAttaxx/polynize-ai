/**
 * GET  /api/console/[slug]/timeline  — read the project timeline
 * POST /api/console/[slug]/timeline  — replace the project timeline
 *
 * The timeline is an operational Build-phase artifact (like Work Plans),
 * NOT part of the locked Engagement section. So writes are team-scope
 * only but are NOT lock-gated (spec §6.2: work-plan-adjacent records stay
 * writable when the engagement is locked).
 *
 * POST body: { items: TimelineItem[] } — the full item list. The client
 * sends the whole array (read-modify-write); we validate and persist.
 * Full-array replace keeps the write atomic and avoids per-item merge
 * races.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { isValidConsoleSlug } from '@/app/console/_config/clients';
import { readClientFile, writeClientFile } from '@/lib/github-client';
import {
  authorizeClientAccess,
  requireConsoleAuth,
  requireTeamScope,
} from '@/lib/console-api-auth';
import {
  ProjectTimelineSchema,
  TimelineItemSchema,
} from '@/lib/blueprint/schema-v2';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TIMELINE_PATH = 'timeline.json';

const PostBodySchema = z.object({
  items: z.array(TimelineItemSchema),
});

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
  if (!authorizeClientAccess(auth.scope, slug)) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  try {
    const raw = await readClientFile(slug, TIMELINE_PATH);
    const json = JSON.parse(raw);
    const parsed = ProjectTimelineSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'timeline.json failed validation' },
        { status: 422 }
      );
    }
    return NextResponse.json(parsed.data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Not Found|404/i.test(msg)) {
      return NextResponse.json(
        { error: 'No timeline for this engagement' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to read timeline', detail: msg },
      { status: 500 }
    );
  }
}

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

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = PostBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', detail: parsed.error.message },
      { status: 400 }
    );
  }

  // Validate the assembled timeline + cross-field integrity: dependency ids
  // must reference items that exist.
  const ids = new Set(parsed.data.items.map((i) => i.id));
  for (const item of parsed.data.items) {
    for (const dep of item.dependencies) {
      if (!ids.has(dep)) {
        return NextResponse.json(
          {
            error: `Item "${item.id}" depends on unknown item "${dep}"`,
          },
          { status: 400 }
        );
      }
    }
  }

  const timeline = { schema_version: '1.0' as const, items: parsed.data.items };
  const newJson = JSON.stringify(timeline, null, 2) + '\n';

  const message =
    `Update ${slug} project timeline\n\n` +
    `Actor: ${auth.actor.id}\nSource: ${auth.actor.source}`;

  try {
    const commit = await writeClientFile(slug, TIMELINE_PATH, newJson, message);
    return NextResponse.json({
      ok: true,
      slug,
      itemCount: timeline.items.length,
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
