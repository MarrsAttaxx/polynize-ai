import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isValidConsoleSlug } from '@/app/console/_config/clients';
import { readClientFile, writeClientFile } from '@/lib/github-client';
import {
  authorizeClientAccess,
  requireConsoleAuth,
  requireTeamScope,
} from '@/lib/console-api-auth';
import { replaceSectionInBlueprint } from '@/app/console/_lib/mutate-blueprint';

export const dynamic = 'force-dynamic';

const BLUEPRINT_PATH = 'modelling/blueprint.md';

const VALID_SECTION_IDS = new Set([
  'engagement-summary',
  'team',
  'capability-map-unit',
  'capability-map-agent',
  'work-model',
  'scope',
  'throughput',
  'integrations',
  'infrastructure',
  'gap-register',
  'sign-off',
]);

const ReplaceSectionSchema = z.object({
  content: z.string().min(1, 'content is required'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; sectionId: string }> }
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

  const { slug, sectionId } = await params;
  if (!isValidConsoleSlug(slug)) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }
  if (!authorizeClientAccess(auth.scope, slug)) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }
  if (!VALID_SECTION_IDS.has(sectionId)) {
    return NextResponse.json(
      {
        error: `Unknown sectionId "${sectionId}"`,
        validSectionIds: Array.from(VALID_SECTION_IDS),
      },
      { status: 400 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = ReplaceSectionSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', detail: parsed.error.message },
      { status: 400 }
    );
  }

  let markdown: string;
  try {
    markdown = await readClientFile(slug, BLUEPRINT_PATH);
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Failed to read Blueprint',
        detail: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 }
    );
  }

  let result: { newMarkdown: string };
  try {
    result = replaceSectionInBlueprint(markdown, sectionId, parsed.data.content);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 400 }
    );
  }

  const message = `Replace ${sectionId} section\n\nActor: ${auth.actor.id}\nSource: ${auth.actor.source}`;

  try {
    const commit = await writeClientFile(
      slug,
      BLUEPRINT_PATH,
      result.newMarkdown,
      message
    );
    return NextResponse.json({
      ok: true,
      sectionId,
      commit: { sha: commit.sha, message, url: commit.url },
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
