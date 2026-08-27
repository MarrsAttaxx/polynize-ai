/**
 * POST /console/marketing/concept/[slug]/update/apply — restructure the concept
 * doc with the changes from the update conversation (D25 living concepts).
 *
 * April rewrites the WHOLE doc so the new thinking is woven in (not appended),
 * and it is saved IN PLACE: same framing -> saveConcept's same-framing collision
 * path updates the existing slug, so every piece pointing at the concept_ref now
 * reads the evolved concept. No versioning by design (Marrs, 2026-07-13).
 *
 * Runs console-side on April's key (a single conditioned rewrite; no worker/job
 * type needed). A light echo/length backstop rejects degenerate outputs so a bad
 * generation can never blank a concept. Team-scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { getConcept, saveConcept } from '@/lib/marketing/concept-store';
import { getBrandVoiceForStream } from '@/lib/marketing/brand-voice-store';
import { complete } from '@/lib/llm';
import { llmErrorText } from '@/lib/llm/error-text';
import { stripEmDashes } from '@/lib/em-dash';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_BODY_BYTES = 512 * 1024;

const BodySchema = z.object({
  transcript: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(8000),
      })
    )
    .min(1)
    .max(80),
});

function systemPrompt(bodyMd: string, title: string, brandVoice?: string): string {
  const voice = brandVoice
    ? `\n\nWrite in this brand voice:\n"""\n${brandVoice}\n"""`
    : '';
  return `You are April, Polynize's concept specialist. Rewrite the core concept doc "${title}" so it reflects the owner's updated thinking from the conversation.

THE CURRENT CONCEPT DOC:
"""
${bodyMd}
"""

Rules for the rewrite:
- WEAVE the changes in; do not append an "updates" section. The result is one coherent, evolved concept.
- Keep everything that still holds. Replace or remove what the owner said is outdated. Integrate the new ideas where they belong.
- Preserve the doc's existing section structure and headings; restructure the content within them. Only add or drop a section if the changes clearly demand it.
- Keep the doc's title/framing the same.
- Never use em-dashes. Australian English.${voice}

Output ONLY the full rewritten Markdown document. No preamble, no commentary, no code fences.`;
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
  if (!body.transcript.some((m) => m.role === 'user')) {
    return NextResponse.json({ error: 'tell April at least one change first' }, { status: 400 });
  }

  let concept;
  try {
    concept = await getConcept(user.email, slug);
  } catch (err) {
    console.error('[concept.update.apply] concept read failed:', err);
    return NextResponse.json({ error: 'could not read the concept' }, { status: 502 });
  }
  if (!concept) {
    return NextResponse.json({ error: 'concept not found' }, { status: 404 });
  }

  const brandVoice = await getBrandVoiceForStream(concept.stream);
  const convo = body.transcript
    .map((m) => `${m.role === 'user' ? 'OWNER' : 'APRIL'}: ${m.content}`)
    .join('\n\n');

  let raw: string;
  try {
    raw = await complete({
      system: systemPrompt(concept.body_md, concept.title, brandVoice),
      messages: [
        {
          role: 'user',
          content: `THE UPDATE CONVERSATION:\n"""\n${convo}\n"""\n\nRewrite the full concept doc now.`,
        },
      ],
      maxTokens: 6000,
      temperature: 0.5,
      json: false,
      apiKey: process.env.APRIL_OPENROUTER_API_KEY,
    });
  } catch (e) {
    console.error(`[concept.update.apply] LLM threw: ${e instanceof Error ? e.message : String(e)}`);
    return NextResponse.json(
      { error: llmErrorText(e, 'April') },
      { status: 502 }
    );
  }

  // Unwrap a stray fence, then backstop: a degenerate output (echoed prompt
  // scaffolding, or too thin to be a real doc) must never replace the concept.
  let doc = raw.trim();
  const fence = doc.match(/^```(?:markdown|md)?\s*([\s\S]*?)\s*```$/);
  if (fence) doc = fence[1].trim();
  const nonHeading = doc
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('')
    .trim();
  const looksEchoed =
    /THE UPDATE CONVERSATION|THE CURRENT CONCEPT DOC/i.test(doc) ||
    (/\bOWNER:/.test(doc) && /\bAPRIL:/.test(doc));
  if (!doc || nonHeading.length < 200 || looksEchoed) {
    console.error('[concept.update.apply] rejected degenerate rewrite');
    return NextResponse.json(
      { error: 'The rewrite came back malformed, so the concept was left untouched. Try again.' },
      { status: 502 }
    );
  }

  try {
    // Same framing -> saveConcept updates the existing slug in place.
    const saved = await saveConcept({
      owner: user.email,
      stream: concept.stream,
      framing: concept.framing,
      title: concept.title,
      body_md: stripEmDashes(doc),
    });
    return NextResponse.json({ ok: true, slug: saved.framing_slug });
  } catch (err) {
    console.error('[concept.update.apply] save failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'save failed' },
      { status: 500 }
    );
  }
}
