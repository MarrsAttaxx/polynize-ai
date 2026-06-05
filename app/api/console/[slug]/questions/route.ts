/**
 * POST /api/console/[slug]/questions  — add a question.
 *
 * This is the ONE write route that permits CLIENT scope. A client (or the
 * team) may add a question to THEIR OWN slug's blueprint:
 *   - requireConsoleAuth  → must be signed in
 *   - authorizeClientAccess(scope, slug) → client only their own slug (404)
 *   - NO requireTeamScope → client is allowed here (unlike every other write)
 *
 * Status and answers are NOT settable here (and not via any client path): see
 * the [questionId] route, where status/answer are team-only.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isValidConsoleSlug } from '@/app/console/_config/clients';
import {
  authorizeClientAccess,
  requireConsoleAuth,
} from '@/lib/console-api-auth';
import {
  nextQuestionId,
  readQuestions,
  writeQuestions,
  type Question,
} from '@/lib/blueprint/questions-io';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const AddSchema = z.object({ text: z.string().min(1).max(4000) });

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
  // Cross-tenant gate: a client may only add to their own slug (404 to avoid
  // hinting other clients exist). Team scope passes for any slug.
  if (!authorizeClientAccess(auth.scope, slug))
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  // Deliberately NO requireTeamScope: adding a question is the single
  // client-permitted write.

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = AddSchema.safeParse(raw);
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Invalid body', detail: parsed.error.message },
      { status: 400 }
    );

  const doc = await readQuestions(slug);
  const now = new Date().toISOString();
  const question: Question = {
    id: nextQuestionId(doc),
    text: parsed.data.text.trim(),
    author_email: auth.actor.id,
    author_role: auth.scope.type === 'team' ? 'polynize' : 'client',
    status: 'open',
    created_at: now,
    answer: null,
    answered_at: null,
    answered_by: null,
  };
  doc.questions.push(question);

  const message =
    `Add question ${question.id} for ${slug}\n\n` +
    `Actor: ${auth.actor.id}\nSource: ${auth.actor.source}`;

  try {
    const commit = await writeQuestions(slug, doc, message);
    return NextResponse.json({ ok: true, slug, question, commit });
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
