/**
 * TEMPORARY diagnostic for the draft-truncation bug. Calls OpenRouter DIRECTLY
 * (so it can read finish_reason + token usage, which the complete() wrapper hides)
 * with a representative recipe+concept draft prompt, and reports exactly why the
 * output stops. No secrets are returned. DELETE once the truncation cause is
 * confirmed and the fix is validated.
 *
 * GET /api/diagnostics/draft-probe?maxTokens=1800&reasoning=low
 *   maxTokens: output cap to send (default 1800, the old draft value)
 *   reasoning: 'low' -> {effort:'low'}, 'off' -> {enabled:false},
 *              a number -> {max_tokens:N}; omitted -> no reasoning param
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const SYSTEM = `You are April, Polynize's copy and voice specialist. Write a LinkedIn post from the concept the user gives you.

Write in this brand voice. Match its register, phrasing, and point of view:
"""
Direct, contrarian, plainspoken. Polynize helps firms map the actual work before reaching for AI. Short sentences. No hype.
"""

This piece follows a Content Template. Its production recipe is the house style for this piece; follow it exactly:
"""
CONTRARIAN POST. Open by stating the common belief everyone holds. Then flip it with a sharp counter-claim. Give one concrete example that proves the flip. End on a one-line challenge to the reader.
"""

Polynize voice:
- Direct, contrarian, concrete. No hype, no filler, no corporate throat-clearing.
- Short sentences. Say the sharp thing plainly.
- No emoji. No hashtags unless the concept calls for them.
- Never use em-dashes. Use commas, periods, or colons instead.

Rules:
- Ground the post in the concept: use its thesis, beats, and proof. Do not invent facts it does not contain.
- Open with a hook that earns the next line. Close with a clear point or call to action.
- Output ONLY the post copy. No preamble, no markdown code fences.`;

const CONCEPT = `Capability Mapping. Most firms reach for a generic AI tool to fix a slow process. That is backwards. First map the actual work: the steps, the decisions, the institutional knowledge locked in people's heads. A services firm had high-value bids taking a full day because senior partners who wrote them had left. Instead of buying an AI writing tool, we mapped the real capability behind the bids, then rebuilt it. Strip the AI out first: understand the work, then decide where software helps.`;

export async function GET(req: Request) {
  const apiKey = process.env.APRIL_OPENROUTER_API_KEY ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'no OpenRouter key configured' }, { status: 500 });
  }
  const model = process.env.OPENROUTER_MODEL ?? 'minimax/minimax-01';

  const url = new URL(req.url);
  const maxTokens = Number(url.searchParams.get('maxTokens')) || 1800;
  const reasoningParam = url.searchParams.get('reasoning');
  let reasoning: unknown;
  if (reasoningParam === 'low') reasoning = { effort: 'low' };
  else if (reasoningParam === 'off') reasoning = { enabled: false };
  else if (reasoningParam && !Number.isNaN(Number(reasoningParam))) {
    reasoning = { max_tokens: Number(reasoningParam) };
  }

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    temperature: 0.7,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `CONCEPT:\n"""\n${CONCEPT}\n"""\n\nWrite the LinkedIn post.` },
    ],
  };
  if (reasoning) body.reasoning = reasoning;

  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.OPENROUTER_REFERER ?? 'https://polynize.ai',
        'X-Title': 'Polynize draft probe',
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return NextResponse.json(
      { error: 'fetch failed', detail: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return NextResponse.json(
      { error: `openrouter ${res.status}`, detail: text.slice(0, 800), model, maxTokens, reasoning },
      { status: 502 }
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    usage?: Record<string, unknown>;
  };
  const content = data.choices?.[0]?.message?.content ?? '';
  return NextResponse.json({
    model,
    max_tokens_sent: maxTokens,
    reasoning_sent: reasoning ?? null,
    finish_reason: data.choices?.[0]?.finish_reason ?? 'unknown',
    usage: data.usage ?? null,
    content_length: content.length,
    content_head: content.slice(0, 200),
    content_tail: content.slice(-200),
    ms: Date.now() - started,
  });
}
