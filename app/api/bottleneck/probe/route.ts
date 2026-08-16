import { NextResponse } from 'next/server';
import { z } from 'zod';
import { complete } from '@/lib/llm';
import { stripEmDashes } from '@/lib/em-dash';

export const runtime = 'nodejs';

const BodySchema = z.object({
  exchanges: z
    .array(z.object({ user: z.string().min(1), follow_up: z.string().optional() }))
    .min(1)
    .max(3),
});

const PROBE_SYSTEM_PROMPT = `You are evaluating whether a business owner's bottleneck description is specific enough to map into a capability map.

A GOOD answer describes: a specific process or workflow, what goes wrong or takes too long, who is involved, and ideally some sense of volume or frequency.

A VAGUE answer is things like: "I need more sales", "marketing isn't working", "we're too busy", "growth is slow". These don't describe a specific process that can be mapped.

If the answer is specific enough, respond with:
{"sufficient": true}

If the answer is too vague, respond with:
{"sufficient": false, "follow_up": "a natural, warm follow-up question that probes for the specific process or workflow behind their vague answer"}

Examples of good follow-ups:
- "Can you walk me through what that actually looks like day-to-day? What's the specific process that's breaking down?"
- "Where exactly does it break down? Is it the volume, the coordination, the quality, or something else?"
- "When you say [their words], what does that look like in practice? What are the steps that take the most time?"

Rules:
- The follow-up must reference their specific words to show you're listening.
- Keep follow-ups to one question, warm and conversational.
- Use commas, periods, or colons. Never use em-dashes.

Output: valid JSON only, no markdown, no explanation.`;

/**
 * POST /api/bottleneck/probe
 *
 * Evaluates whether the user's running bottleneck answer has enough specificity
 * to feed the capability map generator. Returns either:
 *   { sufficient: true }
 *   { sufficient: false, follow_up: "..." }
 *
 * The caller is responsible for capping at 2 follow-ups; after the second
 * exchange the route always returns sufficient:true so the flow advances.
 */
export async function POST(req: Request) {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ sufficient: true }, { status: 200 });
  }

  // Hard cap: after 2 follow-ups (3 user exchanges total), always accept.
  if (body.exchanges.length >= 3) {
    return NextResponse.json({ sufficient: true });
  }

  const userMessage = formatExchanges(body.exchanges);

  const provider = process.env.LLM_PROVIDER ?? 'kimi';
  const model = modelForProvider(provider);
  console.log(`[bottleneck.probe] starting, provider=${provider} model=${model}`);

  try {
    const raw = await complete({
      system: PROBE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      /**
       * ABOVE THE REASONING FLOOR. The production model is a thinking model whose reasoning
       * tokens are mandatory, undisableable, and counted against max_tokens: measured at roughly
       * 800-950 on this codebase. A ceiling below that is spent entirely on reasoning and returns
       * an EMPTY string, which on screen looks like the agent not answering at all rather than
       * like an error. Same fault that truncated drafts (decision log, 2026-07-20); the short
       * conversational calls were missed at the time.
       */
      maxTokens: 1500,
      temperature: 0.5,
    });
    const json = parseJsonLoose(raw);
    if (typeof json !== 'object' || json === null) {
      console.log('[bottleneck.probe] LLM returned non-object, accepting answer');
      return NextResponse.json({ sufficient: true });
    }
    const candidate = json as { sufficient?: unknown; follow_up?: unknown };
    if (candidate.sufficient === true) {
      console.log('[bottleneck.probe] sufficient=true');
      return NextResponse.json({ sufficient: true });
    }
    if (candidate.sufficient === false && typeof candidate.follow_up === 'string') {
      console.log('[bottleneck.probe] sufficient=false, returning follow-up');
      return NextResponse.json({
        sufficient: false,
        follow_up: stripEmDashes(candidate.follow_up.trim()),
      });
    }
    console.log('[bottleneck.probe] LLM response shape unrecognised, accepting answer');
    return NextResponse.json({ sufficient: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[bottleneck.probe] LLM call THREW (accepting answer to keep flow alive): ${msg}`);
    return NextResponse.json({ sufficient: true });
  }
}

function formatExchanges(exchanges: { user: string; follow_up?: string }[]): string {
  return exchanges
    .map((ex, i) => {
      const lines: string[] = [];
      if (i === 0) lines.push(`Initial answer: "${ex.user.trim()}"`);
      else lines.push(`Their reply: "${ex.user.trim()}"`);
      if (ex.follow_up) lines.push(`Your follow-up was: "${ex.follow_up}"`);
      return lines.join('\n');
    })
    .join('\n\n');
}

function modelForProvider(provider: string): string {
  switch (provider) {
    case 'kimi':
    case 'moonshot':
      return process.env.KIMI_MODEL ?? 'moonshot-v1-128k';
    case 'openai':
      return process.env.OPENAI_MODEL ?? 'gpt-4o';
    case 'minimax':
    case 'openrouter':
      return process.env.OPENROUTER_MODEL ?? 'minimax/minimax-01';
    default:
      return 'unknown';
  }
}

function parseJsonLoose(raw: string): unknown {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fenceMatch ? fenceMatch[1] : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no JSON object');
  return JSON.parse(candidate.slice(start, end + 1));
}
