/**
 * POST /console/marketing/concept/[slug]/update/turn — one turn of the
 * update-concept conversation (D25 living concepts). April knows the CURRENT
 * concept doc and asks what changed; interface-driving, so it runs console-side
 * on April's key (same rationale as the intake converse, D3/D16). Team-scope.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { getConcept } from '@/lib/marketing/concept-store';
import { getBrandVoiceForStream } from '@/lib/marketing/brand-voice-store';
import { complete, type ChatMessage } from '@/lib/llm';
import { llmErrorText } from '@/lib/llm/error-text';
import { stripEmDashes } from '@/lib/em-dash';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const MAX_BODY_BYTES = 256 * 1024;

const BodySchema = z.object({
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

function systemPrompt(bodyMd: string, title: string, brandVoice?: string): string {
  const voice = brandVoice
    ? `\n\nThe stream's brand voice, for register only:\n"""\n${brandVoice}\n"""`
    : '';
  return `You are April, Polynize's concept specialist. The owner is UPDATING an existing core concept: their thinking has evolved and the doc must evolve with it.

THE CURRENT CONCEPT DOC ("${title}"):
"""
${bodyMd}
"""

How to run this conversation:
- Ask what has changed, one or two questions at a time. Dig into specifics: what no longer holds, what replaces it, what new idea must be worked in, and how it reshapes the core thesis or the beats.
- When the owner states a change, reflect back how you would fold it into the doc, and check anything it contradicts.
- Keep replies short and conversational (2-4 sentences). You are gathering material, not rewriting yet; the rewrite happens when they hit Update.
- Never use em-dashes. Australian English.${voice}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
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

  let concept;
  try {
    concept = await getConcept(user.email, slug);
  } catch (err) {
    console.error('[concept.update.turn] concept read failed:', err);
    return NextResponse.json({ error: 'could not read the concept' }, { status: 502 });
  }
  if (!concept) {
    return NextResponse.json({ error: 'concept not found' }, { status: 404 });
  }

  const brandVoice = await getBrandVoiceForStream(concept.stream);
  const messages: ChatMessage[] = [
    ...(body.history ?? []),
    { role: 'user', content: body.message.trim() },
  ];

  try {
    const reply = await complete({
      system: systemPrompt(concept.body_md, concept.title, brandVoice),
      messages,
      /**
       * ABOVE THE REASONING FLOOR. The production model is a thinking model whose reasoning
       * tokens are mandatory, undisableable, and counted against max_tokens: measured at roughly
       * 800-950 on this codebase. A ceiling below that is spent entirely on reasoning and returns
       * an EMPTY string, which on screen looks like the agent not answering at all rather than
       * like an error. Same fault that truncated drafts (decision log, 2026-07-20); the short
       * conversational calls were missed at the time.
       */
      maxTokens: 2500,
      temperature: 0.7,
      json: false,
      apiKey: process.env.APRIL_OPENROUTER_API_KEY,
    });
    return NextResponse.json({ reply: stripEmDashes(reply.trim()) });
  } catch (e) {
    console.error(`[concept.update.turn] LLM threw: ${e instanceof Error ? e.message : String(e)}`);
    return NextResponse.json(
      { error: llmErrorText(e, 'April') },
      { status: 502 }
    );
  }
}
