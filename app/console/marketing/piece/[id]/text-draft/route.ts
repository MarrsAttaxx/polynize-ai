/**
 * POST /console/marketing/piece/[id]/text-draft — draft the post copy for a text
 * output (D23, the text module). April writes a full post from the concept +
 * script + ICP + brand voice, in one call. The route loads the piece and its
 * concept server-side (never trusting the client for the source), returns the
 * copy, and the client applies it through the existing /state autosave, so there
 * is a single validated write path (same discipline as the Script screen chat).
 *
 * Team-scope only, session-authed. LLM via the provider abstraction, billed to
 * April's key. Em-dashes are stripped by the layer and prohibited in the prompt.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/console-auth';
import { getPiece } from '@/lib/marketing/piece-store';
import { getConcept } from '@/lib/marketing/concept-store';
import { getBrandVoiceForStream } from '@/lib/marketing/brand-voice-store';
import { icpLabel, formatById } from '@/lib/marketing/output-plan';
import { complete } from '@/lib/llm';
import { stripEmDashes } from '@/lib/em-dash';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function systemPrompt(opts: {
  formatLabel: string;
  icp?: string;
  brandVoice?: string;
}): string {
  const audience = opts.icp
    ? `\n\nWrite it for this audience: ${opts.icp}. Speak to their world and what they care about, without naming the persona in the copy.`
    : '';
  const voice = opts.brandVoice
    ? `\n\nWrite in this brand voice. Match its register, phrasing, and point of view:\n"""\n${opts.brandVoice}\n"""`
    : '';
  return `You are April, Polynize's copy and voice specialist. Write a ${opts.formatLabel} from the concept the user gives you.${audience}${voice}

Polynize voice:
- Direct, contrarian, concrete. No hype, no filler, no corporate throat-clearing.
- Short sentences. Say the sharp thing plainly.
- No emoji. No hashtags unless the concept calls for them.
- Never use em-dashes. Use commas, periods, or colons instead.

Rules:
- Ground the post in the concept: use its thesis, beats, and proof. Do not invent facts it does not contain.
- Open with a hook that earns the next line. Close with a clear point or call to action.
- Output ONLY the post copy. No preamble, no "here is your post", no surrounding quotes, no markdown code fences.`;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const owner = user.email;

  let piece;
  try {
    piece = await getPiece(owner, id);
  } catch (err) {
    console.error('[text-draft] piece read failed:', err);
    return NextResponse.json({ error: 'could not read the piece' }, { status: 502 });
  }
  if (!piece) {
    return NextResponse.json({ error: 'piece not found' }, { status: 404 });
  }

  // Resolve the concept body from the piece's concept_ref (the source of truth).
  let conceptBody = '';
  if (piece.concept_ref) {
    const m = piece.concept_ref.match(/core-concept-(.+)\.md$/);
    if (m) {
      try {
        const concept = await getConcept(owner, m[1]);
        conceptBody = concept?.body_md ?? '';
      } catch (err) {
        console.error('[text-draft] concept read failed:', err);
      }
    }
  }
  if (!conceptBody.trim()) {
    return NextResponse.json(
      { error: 'no concept to draft from. Re-plan this output from a concept.' },
      { status: 400 }
    );
  }

  const formatLabel = formatById(piece.format)?.label ?? 'post';
  // Per-stream brand voice (D20): the post is written in the stream's voice.
  const brandVoice = await getBrandVoiceForStream(piece.stream);

  const source = piece.script?.trim()
    ? `CONCEPT:\n"""\n${conceptBody}\n"""\n\nSCRIPT (draft, for reference):\n"""\n${piece.script}\n"""`
    : `CONCEPT:\n"""\n${conceptBody}\n"""`;

  let raw: string;
  try {
    raw = await complete({
      system: systemPrompt({ formatLabel, icp: icpLabel(piece.icp), brandVoice }),
      messages: [{ role: 'user', content: `${source}\n\nWrite the ${formatLabel}.` }],
      maxTokens: 1800,
      temperature: 0.7,
      json: false,
      apiKey: process.env.APRIL_OPENROUTER_API_KEY,
    });
  } catch (e) {
    console.error(`[text-draft] LLM call threw: ${e instanceof Error ? e.message : String(e)}`);
    return NextResponse.json(
      { error: 'The writing assistant is unavailable right now. Try again in a moment.' },
      { status: 502 }
    );
  }

  // Strip stray fences/quotes a model sometimes wraps around the copy.
  let body = raw.trim();
  const fence = body.match(/^```(?:\w+)?\s*([\s\S]*?)\s*```$/);
  if (fence) body = fence[1].trim();
  body = stripEmDashes(body);

  if (!body) {
    return NextResponse.json({ error: 'the draft came back empty. Try again.' }, { status: 502 });
  }
  return NextResponse.json({ body });
}
