/**
 * POST /console/marketing/intake/finalize — enqueue the concept_finalize job.
 *
 * Turns the interview transcript into a concept doc (core-concept-{framing}.md).
 * Team-scope only; owner from the session. Returns { jobId }; the client polls
 * /intake/job/[jobId] for completion. Interim provider does the work inline and
 * flips the job done; the real (pull-worker) April will leave it queued and a
 * worker completes it — same client code either way.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { getAgentProvider } from '@/lib/agents/socket';
import { framingSlug } from '@/lib/marketing/concept-store';
import { getBrandVoice } from '@/lib/marketing/brand-voice-store';
import { STREAM_IDS } from '@/lib/marketing/streams';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// The interim provider runs the concept-generation LLM call inline inside
// submitJob, so this route can take longer than the platform default before it
// returns the job id. Matches capability-map/generate. (When the real pull-worker
// April lands, submitJob returns fast and this ceiling is just headroom.)
export const maxDuration = 300;

const MAX_BODY_BYTES = 256 * 1024;

const BodySchema = z.object({
  framing: z.string().min(1).max(300),
  stream: z.enum(STREAM_IDS),
  transcript: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(8000),
      })
    )
    .min(1)
    // Accept the FULL interview (the client sends every turn, unsliced, because
    // the concept doc is written from the whole conversation). Generous bound;
    // the real ceiling is MAX_BODY_BYTES above, which 413s an oversized body.
    .max(200),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
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

  // Fail fast if the framing has no slug-able characters (emoji/punctuation/
  // non-Latin only), BEFORE creating a job or spending an LLM call. The store
  // would otherwise throw only after generation, wasting the interview.
  if (!framingSlug(body.framing)) {
    return NextResponse.json(
      { error: 'The framing needs some letters or numbers so it can be named and saved.' },
      { status: 400 }
    );
  }

  try {
    // Attach the owner's brand-voice TEXT inline (not a ref): the real April holds
    // no bucket creds (D17), so the console, which does, passes the register in the
    // job so the concept doc is synthesised in-voice. undefined when absent.
    const brandVoice = await getBrandVoice(user.email);
    const provider = await getAgentProvider();
    const { jobId } = await provider.submitJob({
      jobType: 'concept_finalize',
      owner: user.email,
      input: {
        owner: user.email,
        stream: body.stream,
        framing: body.framing.trim(),
        transcript: body.transcript,
        brandVoice,
      },
    });
    return NextResponse.json({ jobId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[intake.finalize] submit threw: ${msg}`);
    return NextResponse.json(
      { error: 'Could not start the concept doc. Try again in a moment.' },
      { status: 502 }
    );
  }
}
