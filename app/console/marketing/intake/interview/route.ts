/**
 * POST /console/marketing/intake/interview — one interview turn (sync `converse`).
 *
 * April interviews the owner in-console (D16). Team-scope only, session-authed.
 * Owner is derived from the session, never the body. Calls the active agent
 * provider through the socket (interim OpenRouter stand-in today; real April later
 * with no change here). Interface-driving, synchronous: one turn in, one out.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { llmErrorText } from '@/lib/llm/error-text';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { getAgentProvider } from '@/lib/agents/socket';
import { STREAM_IDS } from '@/lib/marketing/streams';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// A single interview turn is a short LLM call, but give it headroom above the
// platform default so a slow turn is not killed mid-generation.
export const maxDuration = 120;

const MAX_BODY_BYTES = 256 * 1024;

const BodySchema = z.object({
  framing: z.string().max(300).optional(),
  stream: z.enum(STREAM_IDS).optional(),
  message: z.string().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(8000),
      })
    )
    .max(40)
    .optional(),
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

  try {
    const provider = await getAgentProvider();
    const result = await provider.converse({
      agent: 'april',
      owner: user.email,
      stream: body.stream,
      systemContext: { title: body.framing },
      history: body.history ?? [],
      message: body.message.trim(),
    });
    return NextResponse.json({ reply: result.reply, signal: result.signal ?? null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[intake.interview] converse threw: ${msg}`);
    return NextResponse.json(
      { error: llmErrorText(e, 'April') },
      { status: 502 }
    );
  }
}
