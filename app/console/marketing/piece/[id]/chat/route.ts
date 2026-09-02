/**
 * POST /console/marketing/piece/[id]/chat — the on-screen context chat, shared by
 * the Script screen (video) and the Text screen (posts). Interface-driving: the
 * user issues a command ("tighten this line", "three sharper hooks", "cut the
 * intro") and the model returns the FULL revised content plus a one-line note.
 *
 * The route does NOT persist. It returns the new content and the client applies it
 * through the existing autosave (the /state route), so there is a single validated
 * write path. `kind` selects the post vs script editing prompt; the piece's Content
 * Template recipe (hook / structure / CTA) is resolved server-side and injected so
 * edits honour the house style. Team-scope only. Em-dashes are prohibited.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { complete, type ChatMessage } from '@/lib/llm';
import { llmErrorText } from '@/lib/llm/error-text';
import { stripEmDashes } from '@/lib/em-dash';
import { stripMarkdownEmphasis, NO_MARKDOWN_INSTRUCTION } from '@/lib/plain-copy';
import { captureFeedback } from '@/lib/marketing/feedback-capture';
import { applyTo, feedbackBlock } from '@/lib/marketing/feedback';
import { listNotes } from '@/lib/marketing/feedback-store';
import { getPiece } from '@/lib/marketing/piece-store';
import { resolveTemplateRef } from '@/lib/marketing/create-outputs';
import { recipeBlock, recipePartsFromTemplate } from '@/lib/marketing/draft';
import { HOOK_GUIDANCE } from '@/lib/marketing/hook-guidance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_CONTENT_BYTES = 512 * 1024;
const MAX_BODY_BYTES = 1024 * 1024;

const BodySchema = z.object({
  instruction: z.string().min(1).max(2000),
  content: z.string().max(MAX_CONTENT_BYTES),
  kind: z.enum(['script', 'body']).optional(),
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
  kind: 'script' | 'body',
  format?: string,
  title?: string,
  concept?: string,
  recipeBlockStr?: string
): string {
  const isBody = kind === 'body';
  const artifact = isBody ? 'post' : 'script';
  const fmt = (format ?? (isBody ? 'post' : 'short_form_video')).replace(/_/g, ' ');
  const conceptBlock = concept
    ? `\n\nThis ${artifact} is drawn from the concept below. Treat it as the source of truth for the thesis, the beats, the proof, and the register. When asked to "write the full ${artifact}" or "draft from the concept", produce a complete ${fmt} ${artifact} grounded in it (do not invent facts it does not contain).\n\nCONCEPT:\n"""\n${concept}\n"""`
    : '';
  const structureRule = isBody
    ? 'Keep it as clean post copy: no section labels unless the recipe explicitly asks for them.'
    : "Preserve the script's structure and section labels (HOOK, BEAT 1, CTA, etc.) unless the command is explicitly about structure.";
  return `You are April, Polynize's copy and voice specialist, editing a marketing ${artifact}${
    title ? ` titled "${title}"` : ''
  } (format: ${fmt}).${conceptBlock}${recipeBlockStr ?? ''}

${HOOK_GUIDANCE}

The person you are helping is editing the ${artifact} and will give you interface-driving commands, for example: "tighten this line", "give me three sharper hooks", "cut the intro", "make it punchier", "shorter". Your job is to act on the command and return the revised ${artifact}.

Polynize voice:
- Direct, contrarian, concrete. No hype, no filler, no corporate throat-clearing.
- Short sentences. Say the sharp thing plainly.
- No emoji. No hashtags unless asked.
- Never use em-dashes. Use commas, periods, or colons instead.
- ${NO_MARKDOWN_INSTRUCTION}

Editing rules:
- Return the FULL revised ${artifact} every time you make a change, not a fragment.
- ${structureRule}
- Only change what the command asks for. Leave untouched parts exactly as they are.
- If the command is a question or needs clarification, do not invent an edit: leave the ${artifact} unchanged and answer in the message.

Output valid JSON only, no markdown, no code fences:
{"message": "<one short line describing what you changed, or your answer>", "content": "<the full revised ${artifact}, or null if you made no change>"}`;
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
  const kind = body.kind ?? 'script';

  /**
   * The piece is read here rather than inside the recipe lookup, because the stream on it is what
   * scopes a feedback note (D93) as well as what picks the template.
   */
  let piece: Awaited<ReturnType<typeof getPiece>> = null;
  try {
    piece = await getPiece(user.email, id);
  } catch {
    piece = null;
  }

  /**
   * FEEDBACK FIRST, BEFORE ANY MODEL CALL (D93). "feedback.. don't say do not" is a rule about how
   * April writes, not an instruction to edit this draft, so it is stored and the draft is left
   * alone. The job is `edit` on this screen: whatever he corrects here, he is correcting her
   * revisions.
   */
  const captured = await captureFeedback(body.instruction, user.email, {
    stream: piece?.stream,
    job: 'edit',
    from: id,
  });
  if (captured) {
    if (!captured.stored) {
      return NextResponse.json({ error: captured.error }, { status: 500 });
    }
    /**
     * `content: null` IS THE POINT, not a formality. This client does
     * `if (data.content !== null) onApply(data.content)`, so anything other than an explicit null
     * writes over his draft: an absent field would arrive as `undefined`, pass that check, and
     * replace the piece he is working on with nothing.
     */
    return NextResponse.json({ message: captured.said, content: null });
  }

  // Template recipe (D25): resolved server-side from the piece so the pillar's
  // house style (hook / structure / CTA) shapes the edits too. Degrades to none.
  let recipeBlockStr = '';
  try {
    if (piece && typeof piece.template_ref === 'string' && piece.template_ref) {
      const template = await resolveTemplateRef(piece.template_ref);
      if (template) recipeBlockStr = recipeBlock(recipePartsFromTemplate(template));
    }
  } catch {
    recipeBlockStr = '';
  }

  /** His corrections for editing on this stream (D93). Never fatal. */
  let corrections = '';
  try {
    corrections = feedbackBlock(
      applyTo(await listNotes(), { stream: piece?.stream, job: 'edit' })
    );
  } catch (err) {
    console.error('[piece.chat] feedback read failed, editing without corrections:', err);
  }

  const messages: ChatMessage[] = [
    ...(body.history ?? []),
    {
      role: 'user',
      content: `CURRENT ${kind === 'body' ? 'POST' : 'SCRIPT'}:\n"""\n${body.content}\n"""\n\nCOMMAND: ${body.instruction.trim()}`,
    },
  ];

  let raw: string;
  try {
    raw = await complete({
      system:
        systemPrompt(kind, body.format, body.title, body.concept, recipeBlockStr) + corrections,
      messages,
      maxTokens: 6000,
      temperature: 0.6,
      // April editing copy (console-side, interface-driving per D3), so bill her
      // key. Generous ceiling: the model is a thinking model whose reasoning tokens
      // count against max_tokens (see the draft prompt notes).
      apiKey: process.env.APRIL_OPENROUTER_API_KEY,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[marketing.chat] LLM call threw: ${msg}`);
    return NextResponse.json(
      { error: llmErrorText(e, 'The editing assistant') },
      { status: 502 }
    );
  }

  // Parse defensively. If the model did not return usable JSON, surface its text
  // as a chat reply and DO NOT touch the content (content: null), so a bad parse
  // can never wipe the user's work.
  let message = '';
  let content: string | null = null;
  try {
    const json = parseJsonLoose(raw);
    if (json && typeof json === 'object') {
      const c = json as { message?: unknown; content?: unknown };
      if (typeof c.message === 'string') message = c.message.trim();
      if (typeof c.content === 'string' && c.content.trim().length > 0) {
        content = c.content;
      }
    }
  } catch {
    message = raw.trim();
  }

  if (!message) {
    message = content ? 'Updated it.' : 'I could not act on that. Try rephrasing the command.';
  }

  /**
   * The REVISED COPY gets the same plain-text treatment the draft writer gets, or the asterisks
   * come straight back on the first edit and the rule only holds until he talks to her.
   *
   * The chat message itself too: it is rendered as text in the panel, so `**like this**` reads as
   * a mistake there as well.
   */
  return NextResponse.json({
    message: stripMarkdownEmphasis(stripEmDashes(message)),
    content: content === null ? null : stripMarkdownEmphasis(stripEmDashes(content)),
  });
}
