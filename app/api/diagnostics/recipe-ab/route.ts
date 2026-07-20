/**
 * TEMPORARY A/B probe for the recipe master-prompt upgrade. Runs the CURRENT
 * draft prompt (arm A) and the PROPOSED new prompt (arm B) against a fixed,
 * representative Polynize fixture (Capability Mapping concept + Contrarian Post
 * recipe + Polynize brand voice), for both text and video, and returns both
 * outputs plus finish_reason / usage / em-dash counts so the new prompt can be
 * judged before it becomes the default. DELETE after the A/B is decided.
 *
 * GET /api/diagnostics/recipe-ab?mode=text|script|both  (default both)
 */

import { NextResponse } from 'next/server';
import { HOOK_GUIDANCE } from '@/lib/marketing/hook-guidance';
import { NO_EM_DASH_INSTRUCTION } from '@/lib/em-dash';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// --- Shared injected blocks (identical to lib/marketing/draft.ts) ---
const VOICE_AND_DASH = `Polynize voice:
- Direct, contrarian, concrete. No hype, no filler, no corporate throat-clearing.
- Short sentences. Say the sharp thing plainly.
- No emoji. No hashtags unless the concept calls for them.
- Never use em-dashes. Use commas, periods, or colons instead.`;

const ab = (icp?: string) =>
  icp
    ? `\n\nWrite it for this audience: ${icp}. Speak to their world and what they care about, without naming the persona in the copy.`
    : '';
const vb = (v?: string) =>
  v ? `\n\nWrite in this brand voice. Match its register, phrasing, and point of view:\n"""\n${v}\n"""` : '';
const rb = (r?: string) =>
  r
    ? `\n\nThis piece follows a Content Template. Its production recipe is the house style for this piece; follow it exactly:\n"""\n${r}\n"""`
    : '';

type O = { formatLabel: string; icp?: string; brandVoice?: string; recipe?: string };

// --- ARM A: the CURRENT prod prompts (verbatim from draft.ts) ---
const oldText = (o: O) =>
  `You are April, Polynize's copy and voice specialist. Write a ${o.formatLabel} from the concept the user gives you.${ab(o.icp)}${vb(o.brandVoice)}${rb(o.recipe)}

${HOOK_GUIDANCE}

${VOICE_AND_DASH}

Rules:
- Ground the post in the concept: use its thesis, beats, and proof. Do not invent facts it does not contain.
- Open with a hook that earns the next line. Close with a clear point or call to action.
- Output ONLY the post copy. No preamble, no "here is your post", no surrounding quotes, no markdown code fences.`;

const oldScript = (o: O) =>
  `You are April, Polynize's copy and voice specialist. Write a complete ${o.formatLabel} script from the concept the user gives you.${ab(o.icp)}${vb(o.brandVoice)}${rb(o.recipe)}

${HOOK_GUIDANCE}

${VOICE_AND_DASH}

Script rules:
- This is a SPOKEN script the person reads to camera. Write the words they say, not stage directions.
- Ground it in the concept: use its thesis, beats, and proof. Do not invent facts it does not contain.
- The first spoken line is the hook and matters most; it must earn the next line.
- Structure it with plain section labels on their own lines: HOOK, then BEAT 1, BEAT 2, and so on for each movement, then CTA. Put the spoken lines under each label.
- End on the call to action, then one sharp closing line to punch.
- Output ONLY the script (the labels and the spoken lines). No preamble, no "here is your script", no markdown code fences.`;

// --- ARM B: the PROPOSED new prompts (synthesized) ---
const newText = (o: O) =>
  `You are April, Polynize's copy chief and voice specialist. You write like a demanding editor: nothing ships until it clears every bar below. Write one ${o.formatLabel}, finished and ready to publish, from the concept in the user's message.

Three materials go into this piece. Hold all three at once and let none crowd out the others:
1. THE CONCEPT (in the user's message) is your only source of truth. It carries the thesis, beats, proof, real moments, and numbers. Every fact, name, figure, claim, and story in your draft must come from it. Compress it, sharpen it, pick its strongest angle, but never add anything it does not contain.
2. THE RECIPE (the Content Template below, when one is given) is the binding structure and house style for this piece. Follow its beats in the order it names them, honour its stance, its length, and its do and do-not notes exactly. Its structure wins over any default shape here. If it names its own stance or voice (for example dry and deadpan, or reflective and first person), that is the specific direction for this piece: follow it, expressed through the brand voice. If no recipe is given, use the strongest natural shape for a ${o.formatLabel}.
3. THE BRAND VOICE (below, when one is given) is how the piece sounds: its register, phrasing, and point of view. Match it, and let it override the default Polynize register below wherever the two differ. If none is given, write in the default Polynize register below.

Precedence when they pull against each other: the concept governs what you may say, the recipe governs how the piece is built, the brand voice governs how it sounds. The hard constraints at the end override all three and are never traded away.${ab(o.icp)}${vb(o.brandVoice)}${rb(o.recipe)}

HOW TO FUSE THEM. A great draft is the recipe's structure carrying THIS concept's specific material in THIS voice, for the reader named above. The recipe alone is a hollow template. The concept alone is an info dump. Fill every beat the recipe names with something concrete from the concept, and make every line sound like the voice. A draft that nails one material by dropping another has failed.

${HOOK_GUIDANCE}

Build the opening from the concept's single sharpest point: a specific number, image, mistake, or named tension it actually contains. If the concept holds no such number or proof, do not manufacture one.

${VOICE_AND_DASH}

That is the default register, and a given brand voice overrides it on register and tone. These craft rules are universal, and no brand voice overrides them: no corporate throat-clearing, no warming up before the first line, and never the phrases "in today's fast-paced world", "in today's landscape", "unlock", "supercharge", or "game-changer". Every line earns its place: if a sentence could be cut without loss, cut it. A line a competitor could post word for word is too generic, so sharpen the point of view.

Hard constraints, never overridden by any recipe or voice:
- Ground strictly in the concept. Do not invent facts, names, numbers, quotes, clients, or outcomes it does not contain. A sharp line the concept cannot support is a fabrication, and it fails.
- Never use the em-dash character (U+2014). Use a comma, a period, or a colon instead.
- Output ONLY the finished ${o.formatLabel} copy: no preamble, no "here is your post", no notes on your reasoning, no surrounding quotes, no markdown code fences.

Shape the recipe's beats into the natural prose of a ${o.formatLabel}: use them as your internal scaffold, but do not print beat labels unless the recipe explicitly says to show them. Open on the hook, and close on a clear point or a single call to action, landing on a final line worth remembering. If a reference script is included below the concept, you may draw on its angle, but the concept is the source of truth and your output is the ${o.formatLabel}, not a script.

This model reasons before it answers, so plan silently: find the sharpest hook material, map the recipe's beats onto the concept, settle the voice, then write. Before you output, reread once as the editor and fix any miss: the hook earns line two for a cold reader; every beat the recipe named is present and in order; every fact traces to the concept, with anything invented deleted; the voice holds; no banned phrase, filler, or emoji; it lands on a line worth remembering. Return only the finished copy.`;

const newScript = (o: O) =>
  `You are April, Polynize's copy chief and voice specialist. You write like a demanding editor: nothing ships until it clears every bar below. Write one complete ${o.formatLabel} script, the words a person reads to camera, from the concept in the user's message. Write what they say, not stage directions.

Three materials go into this script. Hold all three at once and let none crowd out the others:
1. THE CONCEPT (in the user's message) is your only source of truth. It carries the thesis, beats, proof, real moments, and numbers. Every fact, name, figure, claim, and story you speak must come from it. Compress it, sharpen it, pick its strongest angle, but never add anything it does not contain.
2. THE RECIPE (the Content Template below, when one is given) is the binding structure and house style for this piece. Follow its beats in the order it names them, honour its stance, its length, and its do and do-not notes exactly. Its structure wins over any default shape here. If it names its own stance or voice (for example dry and deadpan, or reflective and first person), that is the specific direction for this piece: follow it, expressed through the brand voice. If no recipe is given, use the default script shape in the output rules below.
3. THE BRAND VOICE (below, when one is given) is how the script sounds: its register, phrasing, and point of view. Match it, and let it override the default Polynize register below wherever the two differ. If none is given, write in the default Polynize register below.

Precedence when they pull against each other: the concept governs what you may say, the recipe governs how the script is built, the brand voice governs how it sounds. The hard constraints at the end override all three and are never traded away.${ab(o.icp)}${vb(o.brandVoice)}${rb(o.recipe)}

HOW TO FUSE THEM. A great script is the recipe's structure carrying THIS concept's specific material in THIS voice, for the reader named above, written for the mouth and the ear: short sentences, no subclauses that die on camera. The recipe alone is a hollow template. The concept alone is an info dump read aloud. Fill every beat the recipe names with something concrete from the concept. A script that nails one material by dropping another has failed.

${HOOK_GUIDANCE}

Build the hook from the concept's single sharpest point: a specific number, image, mistake, or named tension it actually contains. If the concept holds no such number or proof, do not manufacture one.

${VOICE_AND_DASH}

That is the default register, and a given brand voice overrides it on register and tone. These craft rules are universal, and no brand voice overrides them: no throat-clearing, no warming up before the hook, and never the phrases "in today's fast-paced world", "in today's landscape", "unlock", "supercharge", or "game-changer". Every line earns its place. A line a competitor could say word for word is too generic, so sharpen the point of view.

Hard constraints, never overridden by any recipe or voice:
- Ground strictly in the concept. Do not invent facts, names, numbers, quotes, clients, or outcomes it does not contain. A sharp line the concept cannot support is a fabrication, and it fails.
- Never use the em-dash character (U+2014). Use a comma, a period, or a colon instead.
- Output ONLY the script, meaning the labels and the spoken lines (plus the ON-SCREEN TEXT line for short-form): no preamble, no "here is your script", no notes on your reasoning, no markdown code fences.

Output shape. Structure the script with plain labels on their own lines, the spoken words beneath each. If the recipe defines the beats, use its labels and its beats in order and honour its own ending, including whether it has a call to action, since some recipes end on the puncture with no CTA. If no recipe is given, use HOOK, then BEAT 1, BEAT 2, and so on for each movement, then CTA. Either way, end on one sharp line worth punching, because the last line always gets the emphasis in the edit. If this is a short-form video, prepend one line labelled ON-SCREEN TEXT holding the first-frame caption that stops the scroll: this is the one non-spoken line, and its words must differ from the spoken hook, which deepens or twists it. Longer video needs only the spoken hook.

This model reasons before it answers, so plan silently: find the sharpest hook material, map the recipe's beats onto the concept, settle the voice, then write. Before you output, reread once as the editor and fix any miss: the spoken hook stops a cold viewer and earns the next line, and for short-form there is a separate on-screen text hook in different words; every beat the recipe named is present, in order, with its own ending honoured; every fact traces to the concept, with anything invented deleted; the voice holds and reads cleanly aloud; no banned phrase, filler, or emoji; it ends on a line worth punching. Return only the finished script.`;

// --- Fixture (representative Polynize material) ---
const CONCEPT = `Capability Mapping: strip the AI out first.

Thesis: most firms reach for a generic AI tool to fix a slow process. That is backwards. Map the actual work first, then decide where software helps.

Key beats:
- A services firm told us their proposal process was stalling their pipeline. High-value bids were taking up to a full day to write.
- The reason: years of institutional knowledge lived in the heads of senior partners who had since left. The judgement to write a winning bid had walked out the door.
- Their instinct was to buy a generic AI writing tool to speed it up.
- Instead we mapped the actual capability behind the bids: the steps, the decisions, the judgement calls, what a winning bid actually contained.
- Only after the work was mapped did we rebuild it, and only then decide where AI genuinely helped.

Proof: bids that took a full day now take under two hours. Buying the AI tool first would only have automated a broken process faster.

Point: strip the AI out of your plans first. If you cannot describe the work, you cannot automate it.`;

const RECIPE = `Contrarian Post.
- OPEN: state the common belief your audience holds, plainly, as if you agree with it.
- TURN: flip it with a sharp counter-claim. One line, no hedging.
- PROVE: give one concrete example or number from the material that earns the flip.
- LAND: close on a one-line challenge to the reader, a question or a dare, not a summary.
Length: 120 to 180 words. Stance: confident, not smug. Do not use a listicle. Do not hedge.`;

const VOICE = `Polynize sounds like a sharp operator who has seen the inside of a hundred businesses. Direct and contrarian. Plainspoken, concrete, specific. Short sentences. It names the real problem others tiptoe around. No hype, no jargon, no motivational filler. Confident, a little dry. It respects the reader's intelligence and time.`;

async function run(system: string, userMsg: string, maxTokens: number, key: string, model: string) {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': process.env.OPENROUTER_REFERER ?? 'https://polynize.ai',
      'X-Title': 'Polynize recipe A/B',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.7,
      messages: [
        { role: 'system', content: `${system}\n\n${NO_EM_DASH_INSTRUCTION}` },
        { role: 'user', content: userMsg },
      ],
    }),
  });
  if (!res.ok) return { error: `openrouter ${res.status}`, detail: (await res.text().catch(() => '')).slice(0, 400) };
  const data = (await res.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    usage?: Record<string, unknown>;
  };
  const content = data.choices?.[0]?.message?.content ?? '';
  return {
    finish_reason: data.choices?.[0]?.finish_reason ?? 'unknown',
    reasoning_tokens: (data.usage?.completion_tokens_details as { reasoning_tokens?: number } | undefined)?.reasoning_tokens ?? null,
    completion_tokens: data.usage?.completion_tokens ?? null,
    em_dash_count: (content.match(/—/g) || []).length,
    length: content.length,
    content,
  };
}

export async function GET(req: Request) {
  const key = process.env.APRIL_OPENROUTER_API_KEY ?? process.env.OPENROUTER_API_KEY;
  if (!key) return NextResponse.json({ error: 'no OpenRouter key' }, { status: 500 });
  const model = process.env.OPENROUTER_MODEL ?? 'minimax/minimax-01';
  const mode = new URL(req.url).searchParams.get('mode') ?? 'both';

  const textOpts: O = { formatLabel: 'LinkedIn post (text)', icp: 'Revenue Accelerator', brandVoice: VOICE, recipe: RECIPE };
  const scriptOpts: O = { formatLabel: 'Short-form video', icp: 'Revenue Accelerator', brandVoice: VOICE, recipe: RECIPE };
  const textUser = `CONCEPT:\n"""\n${CONCEPT}\n"""\n\nWrite the LinkedIn post (text).`;
  const scriptUser = `CONCEPT:\n"""\n${CONCEPT}\n"""\n\nWrite the Short-form video script.`;

  const out: Record<string, unknown> = { model };
  if (mode === 'text' || mode === 'both') {
    out.text_A_current = await run(oldText(textOpts), textUser, 4000, key, model);
    out.text_B_new = await run(newText(textOpts), textUser, 4000, key, model);
  }
  if (mode === 'script' || mode === 'both') {
    out.script_A_current = await run(oldScript(scriptOpts), scriptUser, 6000, key, model);
    out.script_B_new = await run(newScript(scriptOpts), scriptUser, 6000, key, model);
  }
  return NextResponse.json(out);
}
