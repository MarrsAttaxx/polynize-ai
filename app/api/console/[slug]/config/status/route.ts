import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import YAML from 'yaml';
import { isValidConsoleSlug } from '@/app/console/_config/clients';
import { readClientFile, writeClientFile } from '@/lib/github-client';
import {
  authorizeClientAccess,
  requireConsoleAuth,
  requireTeamScope,
} from '@/lib/console-api-auth';

export const dynamic = 'force-dynamic';

const CONFIG_PATH = '.polynize/client-config.yaml';

/**
 * POST /api/console/[slug]/config/status
 *
 * Update the `status` block in a client's `.polynize/client-config.yaml`.
 * Reads → mutates → writes via the GitHub App. Adds a server timestamp
 * (rag_set_at) and stamps the actor's email (rag_set_by) so the audit
 * trail lives both in the YAML and in the commit message.
 *
 * Auth: cookie (Console UI) or bearer (Agent). Per-client scope honoured.
 *
 * Request body:
 *   { rag: 'red'|'amber'|'green', reason?: string, setBy: string (email) }
 *
 * Response shape:
 *   { ok: true, slug, status: {rag, reason, setAt, setBy}, commit: {sha, url, message} }
 */
const StatusBodySchema = z.object({
  rag: z.enum(['red', 'amber', 'green']),
  reason: z
    .string()
    .max(500)
    .optional()
    .transform((s) => (s && s.trim() ? s.trim() : undefined)),
  setBy: z.string().email(),
});

type StatusBlock = {
  rag: 'red' | 'amber' | 'green';
  rag_reason?: string;
  rag_set_at: string;
  rag_set_by: string;
};

type ConfigShape = {
  status?: Partial<StatusBlock> | null;
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

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = StatusBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', detail: parsed.error.message },
      { status: 400 }
    );
  }

  let yamlText: string;
  try {
    yamlText = await readClientFile(slug, CONFIG_PATH);
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Failed to read client-config.yaml',
        detail: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 }
    );
  }

  let config: ConfigShape;
  try {
    config = (YAML.parse(yamlText) ?? {}) as ConfigShape;
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Failed to parse client-config.yaml',
        detail: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 }
    );
  }

  const hadStatusBlock =
    config.status != null && typeof config.status === 'object';

  // Construct the status block with keys in the scaffold convention
  // (rag, rag_reason, rag_set_at, rag_set_by). JS object literal order is
  // preserved into YAML.stringify output, so this keeps the YAML diffs
  // small and predictable when the team reads/edits these files directly.
  const setAt = new Date().toISOString();
  const newStatus: StatusBlock = parsed.data.reason
    ? {
        rag: parsed.data.rag,
        rag_reason: parsed.data.reason,
        rag_set_at: setAt,
        rag_set_by: parsed.data.setBy,
      }
    : {
        rag: parsed.data.rag,
        rag_set_at: setAt,
        rag_set_by: parsed.data.setBy,
      };

  config.status = newStatus;

  const newYaml = YAML.stringify(config);

  const verb = hadStatusBlock ? 'Update' : 'Set';
  const message =
    `${verb} ${slug} RAG status to ${parsed.data.rag}\n\n` +
    `Actor: ${auth.actor.id}\nSource: ${auth.actor.source}`;

  try {
    const commit = await writeClientFile(slug, CONFIG_PATH, newYaml, message);
    return NextResponse.json({
      ok: true,
      slug,
      status: {
        rag: newStatus.rag,
        reason: newStatus.rag_reason,
        setAt: newStatus.rag_set_at,
        setBy: newStatus.rag_set_by,
      },
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
