import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isValidConsoleSlug } from '@/app/console/_config/clients';
import { readClientFile, writeClientFile } from '@/lib/github-client';
import {
  authorizeClientAccess,
  requireConsoleAuth,
  requireTeamScope,
} from '@/lib/console-api-auth';
import {
  updateGapInBlueprint,
  deleteGapInBlueprint,
} from '@/app/console/_lib/mutate-blueprint';
import type { GapRegisterRow } from '@/app/console/_lib/parse-blueprint';

export const dynamic = 'force-dynamic';

const BLUEPRINT_PATH = 'modelling/blueprint.md';

const UpdateGapSchema = z.object({
  question: z.string().optional(),
  owner: z.string().optional(),
  blocks: z.string().optional(),
  status: z.enum(['open', 'answered', 'closed']).optional(),
  notes: z.string().nullable().optional(),
});

const DeleteGapBodySchema = z
  .object({
    reason: z.string().optional(),
  })
  .optional();

function describeUpdate(partial: z.infer<typeof UpdateGapSchema>): string {
  const parts: string[] = [];
  if (partial.status) parts.push(`status=${partial.status}`);
  if (partial.owner !== undefined) parts.push('owner');
  if (partial.blocks !== undefined) parts.push('blocks');
  if (partial.question !== undefined) parts.push('question');
  if (partial.notes !== undefined) parts.push('notes');
  return parts.length > 0 ? parts.join(', ') : 'no fields';
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; gapId: string }> }
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

  const { slug, gapId } = await params;
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
  const parsed = UpdateGapSchema.safeParse(raw);
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

  // Normalize `notes: null` → `''` so the mutation library can stay typed
  // against Partial<GapRegisterRow>.
  const partial: Partial<GapRegisterRow> = {};
  if (parsed.data.question !== undefined) partial.question = parsed.data.question;
  if (parsed.data.owner !== undefined) partial.owner = parsed.data.owner;
  if (parsed.data.blocks !== undefined) partial.blocks = parsed.data.blocks;
  if (parsed.data.status !== undefined) partial.status = parsed.data.status;
  if (parsed.data.notes !== undefined) partial.notes = parsed.data.notes ?? '';

  let result: { newMarkdown: string; newGapState: unknown };
  try {
    result = updateGapInBlueprint(markdown, gapId, partial);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return NextResponse.json(
      { error: msg },
      { status: msg.includes('not found') ? 404 : 400 }
    );
  }

  const message = `Update gap ${gapId}: ${describeUpdate(parsed.data)}\n\nActor: ${auth.actor.id}\nSource: ${auth.actor.source}`;

  try {
    const commit = await writeClientFile(
      slug,
      BLUEPRINT_PATH,
      result.newMarkdown,
      message
    );
    return NextResponse.json({
      ok: true,
      gapId,
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; gapId: string }> }
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

  const { slug, gapId } = await params;
  if (!isValidConsoleSlug(slug)) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }
  if (!authorizeClientAccess(auth.scope, slug)) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  // Body is optional for DELETE
  let reason: string | undefined;
  try {
    const raw = await request.json();
    const parsed = DeleteGapBodySchema.safeParse(raw);
    if (parsed.success && parsed.data) reason = parsed.data.reason;
  } catch {
    // empty body is fine
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
    result = deleteGapInBlueprint(markdown, gapId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return NextResponse.json(
      { error: msg },
      { status: msg.includes('not found') ? 404 : 400 }
    );
  }

  const reasonSuffix = reason ? ` (${reason})` : '';
  const message = `Delete gap ${gapId}${reasonSuffix}\n\nActor: ${auth.actor.id}\nSource: ${auth.actor.source}`;

  try {
    const commit = await writeClientFile(
      slug,
      BLUEPRINT_PATH,
      result.newMarkdown,
      message
    );
    return NextResponse.json({
      ok: true,
      gapId,
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
