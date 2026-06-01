import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isValidConsoleSlug } from '@/app/console/_config/clients';
import { readClientFile, writeClientFile } from '@/lib/github-client';
import {
  authorizeClientAccess,
  requireConsoleAuth,
  requireTeamScope,
} from '@/lib/console-api-auth';
import { createGapInBlueprint } from '@/app/console/_lib/mutate-blueprint';

export const dynamic = 'force-dynamic';

const BLUEPRINT_PATH = 'modelling/blueprint.md';

const CreateGapSchema = z.object({
  question: z.string().min(1, 'question is required'),
  owner: z.string().default(''),
  blocks: z.string().default(''),
  status: z.enum(['open', 'answered', 'closed']).default('open'),
  notes: z.string().nullable().optional(),
});

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
  const parsed = CreateGapSchema.safeParse(raw);
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

  let result: { newMarkdown: string; gapId: string; newGapState: unknown };
  try {
    result = createGapInBlueprint(markdown, {
      question: parsed.data.question,
      owner: parsed.data.owner,
      blocks: parsed.data.blocks,
      status: parsed.data.status,
      notes: parsed.data.notes ?? '',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 400 }
    );
  }

  const message = `Create gap ${result.gapId}\n\nActor: ${auth.actor.id}\nSource: ${auth.actor.source}`;

  try {
    const commit = await writeClientFile(
      slug,
      BLUEPRINT_PATH,
      result.newMarkdown,
      message
    );
    return NextResponse.json({
      ok: true,
      gapId: result.gapId,
      commit: { sha: commit.sha, message, url: commit.url },
      newState: result.newGapState,
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
