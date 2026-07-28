/**
 * SCREEN PROMPT generation (D29 amended, 2026-07-21). Generated on its OWN stage,
 * from the LOCKED SCRIPT plus the operator's direction, rather than in the same pass
 * as the script.
 *
 * Why: the screen design is a creative decision the operator owns. Auto-generating it
 * with the script produced briefs that were generic and only loosely tied to the
 * words. The operator talks through what they want (three pillars, a risk meter, no
 * text on the opening) and that direction WINS over the model's own ideas; the model
 * fills in what was left open and anchors every state to a real beat of the script.
 *
 * Server-side only; billed to April's key.
 */

import type { MarketingPiece } from './piece-store';
import { getBrandVoiceForStream } from './brand-voice-store';
import { formatById, SCREEN_PROMPT_BRIEF } from './output-plan';
import { conceptBodyForPiece, DraftError } from './draft';
import { complete } from '@/lib/llm';
import { stripEmDashes } from '@/lib/em-dash';

export type ScreenPromptTurn = { role: 'user' | 'assistant'; content: string };

function systemPrompt(opts: {
  formatLabel: string;
  brandVoice?: string;
  formatShape?: string;
}): string {
  const voice = opts.brandVoice
    ? `\n\nThe brand this is for sounds like this. Let it shape the tone of the screen, its words and its confidence:\n"""\n${opts.brandVoice}\n"""`
    : '';
  const shape = opts.formatShape ? `\n\n${opts.formatShape}` : '';
  return `You are April, Polynize's copy and visual-direction specialist, working with the presenter on a ${opts.formatLabel}.${voice}

${SCREEN_PROMPT_BRIEF}${shape}

Never use the em-dash character (U+2014). Use a comma, a period, or a colon instead.

Reply in TWO parts, each introduced by its delimiter alone on its own line:

===NOTE===
One short sentence to the operator, in plain speech, saying what you built or changed. This is your side of the conversation, so write it as a reply, not a summary.

===SCREEN PROMPT===
The brief itself.`;
}

/**
 * Generate the screen prompt for a piece. `direction` is the operator's brief from
 * the chat (may be empty on a first pass); `history` carries the earlier turns so a
 * follow-up refines rather than restarts. Throws DraftError when there is no script
 * to build from, since the screen prompt is meaningless without one.
 */
export async function generateScreenPrompt(
  owner: string,
  piece: MarketingPiece,
  direction: string,
  history: ScreenPromptTurn[] = []
): Promise<{ prompt: string; note: string }> {
  const script = (piece.script ?? '').trim();
  if (!script) throw new DraftError('no-concept');

  const fmt = formatById(piece.format);
  const formatLabel = fmt?.label ?? 'video';
  const brandVoice = await getBrandVoiceForStream(piece.stream);
  // The concept gives the screen its facts (numbers, names, proof) so the visuals
  // stay grounded in the same source the script came from.
  const conceptBody = await conceptBodyForPiece(owner, piece);

  const parts = [
    conceptBody.trim()
      ? `CONCEPT (the source of every fact and figure):\n"""\n${conceptBody}\n"""`
      : '',
    `LOCKED SCRIPT (design a screen moment for each of these beats, in order):\n"""\n${script}\n"""`,
    piece.treatment?.trim()
      ? `THE CURRENT SCREEN PROMPT (revise this rather than starting over, keeping what the operator has not asked to change):\n"""\n${piece.treatment}\n"""`
      : '',
    direction.trim()
      ? `THE OPERATOR'S DIRECTION (their creative intent; follow it):\n"""\n${direction.trim()}\n"""`
      : 'The operator gave no specific direction, so design it yourself from the script.',
    'Write the screen prompt.',
  ].filter(Boolean);

  let raw: string;
  try {
    raw = await complete({
      system: systemPrompt({ formatLabel, brandVoice, formatShape: fmt?.screenPromptShape }),
      messages: [...history, { role: 'user', content: parts.join('\n\n') }],
      maxTokens: 12000,
      temperature: 0.7,
      json: false,
      apiKey: process.env.APRIL_OPENROUTER_API_KEY,
    });
  } catch (e) {
    console.error(
      `[screen-prompt] LLM call threw: ${e instanceof Error ? e.message : String(e)}`
    );
    throw new DraftError('llm-unavailable');
  }

  let out = raw.trim();
  const fence = out.match(/^```(?:\w+)?\s*([\s\S]*?)\s*```$/);
  if (fence) out = fence[1].trim();
  out = stripEmDashes(out);

  // Split April's conversational reply from the artifact. If she skips the
  // delimiters, treat everything as the brief rather than losing it.
  let note = '';
  const halves = out.split(/^[=\s]*={2,}\s*SCREEN\s*PROMPT\s*={2,}[=\s]*$/im);
  if (halves.length > 1) {
    note = halves[0].replace(/^[=\s]*={2,}\s*NOTE\s*={2,}[=\s]*$/im, '').trim();
    out = halves.slice(1).join('\n').trim();
  }
  if (!out) throw new DraftError('empty');
  return { prompt: out, note: note || 'Rewrote the screen prompt.' };
}
