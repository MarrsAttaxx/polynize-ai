/**
 * POST /console/marketing/piece/[id]/chat — the Script screen's context chat (T4).
 *
 * Interface-driving: the user issues a command ("tighten this line", "three
 * sharper hooks", "cut the intro") and the model returns the FULL revised script
 * plus a one-line note. The route does NOT persist — it returns the new script
 * and the client applies it through the existing autosave (the /state route), so
 * there is a single validated write path.
 *
 * Team-scope only, session-authed. LLM via the provider abstraction (OpenRouter
 * default). Em-dashes are prohibited by the layer and reinforced in the prompt.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { complete, type ChatMessage } from '@/lib/llm';
import { stripEmDashes } from '@/lib/em-dash';
import { getPiece } from '@/lib/marketing/piece-store';
import { resolveTemplateRef } from '@/lib/marketing/create-outputs';
import { HOOK_GUIDANCE } from '@/lib/marketing/hook-guidance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_SCRIPT_BYTES = 512 * 1024;
// Raw request envelope cap (script up to 512K + instruction + bounded history).
// Guards against buffering/parsing an oversized body before zod runs, matching
// the sibling /state route's 413 guard.
const MAX_BODY_BYTES = 1024 * 1024;

const BodySchema = z.object({
  instruction: z.string().min(1).max(2000),
  script: z.string().max(MAX_SCRIPT_BYTES),
  format: z.string().max(120).optional(),
  title: z.string().max(300).optional(),
  concept: z.string().max(50_000).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(4000),
      })
    )
    .max(12)
    .optional(),
});

function systemPrompt(
  format?: string,
  title?: string,
  concept?: string,
  recipe?: string
): string {
  const kind = (format ?? 'short_form_video').replace(/_/g, ' ');
  const conceptBlock = concept
    ? `\n\nThis script is being drafted from the concept below. Treat it as the source of truth for the thesis, the beats, the proof, and the register. When asked to "write the full script" or "draft from the concept", produce a complete ${kind} script grounded in it (do not invent facts it does not contain).\n\nCONCEPT:\n"""\n${concept}\n"""`
    : '';
  const recipeBlock = recipe
    ? `\n\nThis piece follows a Content Pillar Template. Its production recipe is the house style for this script; follow it exactly:\n"""\n${recipe}\n"""`
    : '';
  return `You are April, Polynize's copy and voice specialist, editing a marketing script${
    title ? ` titled "${title}"` : ''
  } (format: ${kind}).${conceptBlock}${recipeBlock}

${HOOK_GUIDANCE}

The person you are helping is editing the script and will give you interface-driving commands, for example: "tighten this line", "give me three sharper hooks", "cut the intro", "make beat 3 punchier", "shorter". Your job is to act on the command and return the revised script.

Polynize voice:
- Direct, contrarian, concrete. No hype, no filler, no corporate throat-clearing.
- Short sentences. Say the sharp thing plainly.
- No emoji. No hashtags unless asked.
- Never use em-dashes. Use commas, periods, or colons instead.

Editing rules:
- Return the FULL revised script every time you make a change, not a fragment.
- Preserve the script's structure and section labels (HOOK, BEAT 1, CTA, etc.) unless the command is explicitly about structure.
- Only change what the command asks for. Leave untouched sections exactly as they are.
- If the command is a question or needs clarification, do not invent an edit: leave the script unchanged and answer in the message.

Output valid JSON only, no markdown, no code fences:
{"message": "<one short line describing what you changed, or your answer>", "script": "<the full revised script, or null if you made no change>"}`;
}

function parseJsonLoose(raw: string): unknown {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fence ? fence[1] : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no JSON object');
  return JSON.parse(candidate.slice(start, end + 1));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Template recipe (D25): resolved server-side from the piece so the pillar's
  // house style shapes the script edits too. Degrades to none on any failure.
  let recipe: string | undefined;
  try {
    const piece = await getPiece(user.email, id);
    if (piece && typeof piece.template_ref === 'string' && piece.template_ref) {
      const template = await resolveTemplateRef(piece.template_ref);
      recipe = template?.recipe || undefined;
    }
  } catch {
    recipe = undefined;
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

  const messages: ChatMessage[] = [
    ...(body.history ?? []),
    {
      role: 'user',
      content: `CURRENT SCRIPT:\n"""\n${body.script}\n"""\n\nCOMMAND: ${body.instruction.trim()}`,
    },
  ];

  let raw: string;
  try {
    raw = await complete({
      system: systemPrompt(body.format, body.title, body.concept, recipe),
      messages,
      maxTokens: 4000,
      temperature: 0.6,
      // This is April editing copy (console-side, interface-driving per D3), so
      // bill her key. Falls back to the console's OPENROUTER_API_KEY if unset.
      apiKey: process.env.APRIL_OPENROUTER_API_KEY,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[marketing.chat] LLM call threw: ${msg}`);
    return NextResponse.json(
      { error: 'The editing assistant is unavailable right now. Try again in a moment.' },
      { status: 502 }
    );
  }

  // Parse defensively. If the model did not return usable JSON, surface its text
  // as a chat reply and DO NOT touch the script (script: null), so a bad parse
  // can never wipe the user's work.
  let message = '';
  let script: string | null = null;
  try {
    const json = parseJsonLoose(raw);
    if (json && typeof json === 'object') {
      const c = json as { message?: unknown; script?: unknown };
      if (typeof c.message === 'string') message = c.message.trim();
      if (typeof c.script === 'string' && c.script.trim().length > 0) {
        script = c.script;
      }
    }
  } catch {
    message = raw.trim();
  }

  if (!message) {
    message = script ? 'Updated the script.' : 'I could not act on that. Try rephrasing the command.';
  }

  return NextResponse.json({
    message: stripEmDashes(message),
    script: script === null ? null : stripEmDashes(script),
  });
}
