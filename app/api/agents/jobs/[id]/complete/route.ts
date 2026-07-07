/**
 * POST /api/agents/jobs/[id]/complete — an agent reports a job result.
 *
 * Bearer-authed per agent. The agent may only complete its OWN jobs (token agent
 * must match the job's agent). Owner + all keying come from the job record on the
 * server, never from the agent, so a compromised agent can't write into another
 * owner's concept bank. For concept_finalize the agent returns markdown; the
 * CONSOLE writes it to the bucket (small structured data flows through the
 * contract; large blobs would go direct to storage and return a ref, D17).
 *
 * body: { output: { markdown } }  on success  |  { error: string }  on failure
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateAgent } from '@/lib/agent-auth';
import { isAgentBridgeActive } from '@/lib/agents/socket';
import { findJob, updateJob } from '@/lib/agents/jobs-store';
import { saveConcept } from '@/lib/marketing/concept-store';
import { stripEmDashes } from '@/lib/em-dash';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BODY_BYTES = 512 * 1024;

const BodySchema = z
  .object({
    output: z.object({ markdown: z.string().min(1).max(200_000) }).optional(),
    error: z.string().min(1).max(2000).optional(),
  })
  .refine((b) => Boolean(b.output) !== Boolean(b.error), {
    message: 'exactly one of output or error is required',
  });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isAgentBridgeActive()) {
    return NextResponse.json({ error: 'agent bridge inactive' }, { status: 503 });
  }
  const agent = authenticateAgent(req);
  if (!agent) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const rawBody = await req.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'payload too large' }, { status: 413 });
  }
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(JSON.parse(rawBody));
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const job = await findJob(id);
  if (!job) {
    return NextResponse.json({ error: 'job not found' }, { status: 404 });
  }
  if (job.agent !== agent) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  // Idempotency: only a running job can be completed; a re-delivered completion
  // for an already-terminal job is a no-op success, not a double-write.
  if (job.status !== 'running') {
    return NextResponse.json({ ok: true, status: job.status });
  }

  // Failure path: record a user-safe message; log the raw error server-side.
  if (body.error) {
    console.error(`[agents.complete] ${agent} job ${id} failed: ${body.error}`);
    await updateJob(job.owner, id, {
      status: 'failed',
      error: 'The agent could not complete this job. Try again in a moment.',
    });
    return NextResponse.json({ ok: true });
  }

  // Success path. Owner + stream + framing come from the job (server truth).
  // Strip em-dashes as a server backstop (brand non-negotiable #3): the durable
  // concept doc must be em-dash-clean regardless of what the agent returns, and
  // the interim path already strips — this keeps the real path consistent.
  const markdown = stripEmDashes(body.output!.markdown);
  try {
    if (job.job_type === 'concept_finalize') {
      const input = (job.input ?? {}) as { stream?: unknown; framing?: unknown };
      const stream = typeof input.stream === 'string' ? input.stream : 'polynize';
      const framing = typeof input.framing === 'string' ? input.framing : '';
      if (!framing) {
        await updateJob(job.owner, id, { status: 'failed', error: 'job input was incomplete' });
        return NextResponse.json({ error: 'job input missing framing' }, { status: 422 });
      }
      const doc = await saveConcept({
        owner: job.owner,
        stream,
        framing,
        title: framing,
        body_md: markdown,
      });
      await updateJob(job.owner, id, { status: 'done', output_ref: doc.concept_ref });
      return NextResponse.json({ ok: true, output_ref: doc.concept_ref });
    }
    // Other job types (script_draft, media) land here as they come online.
    await updateJob(job.owner, id, {
      status: 'failed',
      error: `unsupported job_type ${job.job_type}`,
    });
    return NextResponse.json({ error: 'unsupported job_type' }, { status: 422 });
  } catch (e) {
    console.error(
      `[agents.complete] ${agent} job ${id} write failed: ${
        e instanceof Error ? e.message : String(e)
      }`
    );
    await updateJob(job.owner, id, {
      status: 'failed',
      error: 'The concept doc could not be written. Try again in a moment.',
    });
    return NextResponse.json({ error: 'write failed' }, { status: 500 });
  }
}
