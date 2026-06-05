/**
 * POST /api/console/[slug]/questions/[questionId]  — update a question.
 *
 * Field-gated access control:
 *   - status  → team only (requireTeamScope equivalent)
 *   - answer  → team only
 *   - text    → team always; a CLIENT only for their OWN question while it is
 *               still open (un-answered)
 *
 * A client cannot set status or answer (the answer/triage is Polynize's), and
 * cannot touch another client's question or another slug (authorizeClientAccess
 * 404s a cross-tenant slug). A combined payload that includes any team-only
 * field is rejected for a client before anything is written.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isValidConsoleSlug } from '@/app/console/_config/clients';
import {
  authorizeClientAccess,
  requireConsoleAuth,
} from '@/lib/console-api-auth';
import {
  QuestionStatusSchema,
  authorizeQuestionUpdate,
  readQuestions,
  writeQuestions,
} from '@/lib/blueprint/questions-io';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UpdateSchema = z
  .object({
    text: z.string().min(1).max(4000).optional(),
    status: QuestionStatusSchema.optional(),
    answer: z.string().max(8000).nullable().optional(),
  })
  .refine(
    (b) => b.text !== undefined || b.status !== undefined || b.answer !== undefined,
    { message: 'nothing to update' }
  );

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; questionId: string }> }
) {
  const auth = await requireConsoleAuth(request);
  if (!auth.ok)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { slug, questionId } = await params;
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
  const parsed = UpdateSchema.safeParse(raw);
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Invalid body', detail: parsed.error.message },
      { status: 400 }
    );
  const { text, status, answer } = parsed.data;
  const isTeam = auth.scope.type === 'team';

  const doc = await readQuestions(slug);
  const q = doc.questions.find((x) => x.id === questionId);
  if (!q)
    return NextResponse.json({ error: 'Question not found' }, { status: 404 });

  // Field-level access control (single source of truth, unit-tested):
  // status/answer are team-only; text only by the team or by the question's
  // own author while it is still open.
  const authz = authorizeQuestionUpdate({
    isTeam,
    actorEmail: auth.actor.id,
    question: q,
    fields: {
      text: text !== undefined,
      status: status !== undefined,
      answer: answer !== undefined,
    },
  });
  if (!authz.ok)
    return NextResponse.json({ error: authz.error }, { status: authz.status });

  const now = new Date().toISOString();
  if (text !== undefined) q.text = text.trim();
  if (status !== undefined) {
    q.status = status;
    if (status === 'answered' || status === 'closed') {
      q.answered_at = now;
      q.answered_by = auth.actor.id;
    }
  }
  if (answer !== undefined) {
    q.answer = answer;
    q.answered_at = now;
    q.answered_by = auth.actor.id;
  }

  const message =
    `Update question ${questionId} for ${slug}\n\n` +
    `Actor: ${auth.actor.id}\nSource: ${auth.actor.source}`;

  try {
    const commit = await writeQuestions(slug, doc, message);
    return NextResponse.json({ ok: true, slug, question: q, commit });
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
