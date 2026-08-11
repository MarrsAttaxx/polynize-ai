/**
 * CLIP PROPOSAL: turning a released episode into candidate shorts.
 *
 * The editorial method is Marrs's, from cutting hundreds of clips by hand, and it is written down in
 * `docs/pam-console/podcast-clip-extraction.md`. It was validated on a real 54-minute episode before
 * any of this was built: eight ranked clips, verdict "on the money". So the prompt below is not a
 * first draft, it is a tested one, and changes to it should be made against real episode output
 * rather than by reasoning about it.
 *
 * THE PRINCIPLE, because everything else follows from it: a podcast clip is NOT a contiguous slice
 * of the episode. It is a theme, condensed. Find the strongest line, move it to the front, cut the
 * rest down hard, and the result must make full sense to someone who never heard the episode.
 *
 * Server-side only; billed to April's key.
 */

import { randomUUID } from 'node:crypto';
import { completeStream, complete, type StreamDelta } from '@/lib/llm';
import { resolveModel } from '@/lib/llm/openrouter';
import { repairJsonControlChars } from './figure-parse';
import { resolveComposition } from '@/lib/descript';
import { stripEmDashes } from '@/lib/em-dash';
import { DraftError } from './draft';
import type { ClipProposal, ClipSpan, ClipStyle, ClipExclusion } from './podcast-store';

/**
 * The model this work runs on.
 *
 * Judging which sixty seconds of a fifty-four minute conversation will stop a scroll is editorial
 * judgment over a long context, which is a different job from both drafting prose and writing CSS.
 * Its own override for the same reason `FIGURE_MODEL` exists: the task should be movable without
 * disturbing the others. Unset, it falls back to the global, so nothing changes by accident.
 */
const clipModel = () => process.env.PODCAST_MODEL || undefined;
export const clipModelInUse = () => resolveModel(clipModel());

const SYSTEM = `You are the podcast-clip editor for Polynize. You turn a long episode transcript into proposed short vertical clips (TikTok, Reels, YouTube Shorts) for a human to approve. You have edited thousands of clips and you know that a great clip is not a slice of the episode: it is a single theme, condensed, opened by its strongest moment.

You are given the full transcript with [HH:MM:SS] timecodes on each paragraph. Do this:

1. SEGMENT the transcript into thematic sections, one topic each. Boundaries are where the subject changes, not fixed time windows.

2. KEEP only sections that can stand alone and carry a strong idea: a contrarian take, a surprising number, a vivid stakes line, a concrete story, a reframe. Discard logistics, throat clearing, and chatter that only makes sense in context. Be selective. Three great clips beat ten weak ones. Rank them strongest first.

3. FIND THE HOOK: the single most arresting line in the section, the one that stops a scroll. Prefer a blunt declarative claim over a softer setup. "Schools don't train skills" beats the gentle analogy that led into it. This becomes the clip's first line, pulled from wherever it actually sits.

4. BUILD THE EDL. Hook first, then the supporting arc in an order that plays as one coherent thought, with silences, filler, false starts and tangents removed. Tighten hard. It must end on the payoff, not a trailing aside, and it must make full sense to someone who never heard the episode.

5. USE ONLY THE SPEAKER'S REAL WORDS. You SELECT and ORDER spans. You never paraphrase and you never invent a line. Dropping a false start inside a sentence is fine; changing what they said is not. This is not a style preference: a clip is published as a real person saying a real thing.

ON LENGTH. Estimate from the actual spoken length of the spans you keep, at roughly 2.7 words per second. Strong clips commonly land between 30 and 75 seconds. NEVER pad with silence or filler to reach a number: shorter and tight beats longer and padded, and a 32 second clip that works is a success rather than a shortfall.

Return ONLY a JSON object, no markdown and no code fence:

{"clips":[{
  "title": "short working title",
  "theme": "the one idea in a phrase",
  "why_strong": "one line on why it will perform",
  "hook": {"at": "HH:MM:SS", "text": "the verbatim hook line"},
  "edl": [{"at": "HH:MM:SS", "text": "verbatim words to keep", "cut_note": "what is cut around this and why"}],
  "est_duration_seconds": 48,
  "cuts_made": "a short summary of what you removed",
  "platforms": ["TikTok", "Reels", "Shorts"]
}]}

The first entry of "edl" MUST be the hook. Every "at" must be a real timecode from the transcript you were given, because the assembly engine uses it to find the span on the timeline. Never use the em-dash character.`;

/** What one clip looks like coming back, before it is trusted. */
type RawClip = {
  title?: unknown;
  theme?: unknown;
  why_strong?: unknown;
  hook?: { at?: unknown; text?: unknown };
  edl?: { at?: unknown; text?: unknown; cut_note?: unknown }[];
  est_duration_seconds?: unknown;
  cuts_made?: unknown;
  platforms?: unknown;
};

const str = (v: unknown, max = 4000): string =>
  typeof v === 'string' ? stripEmDashes(v.trim()).slice(0, max) : '';

/** `HH:MM:SS` or `MM:SS`, with any surrounding brackets removed. Empty when unusable. */
function timecode(v: unknown): string {
  const m = String(v ?? '').match(/(\d{1,2}:)?\d{1,2}:\d{2}/);
  return m ? m[0] : '';
}

function span(raw: { at?: unknown; text?: unknown; cut_note?: unknown } | undefined): ClipSpan | null {
  const text = str(raw?.text, 2000);
  if (!text) return null;
  const note = str(raw?.cut_note, 400);
  return { at: timecode(raw?.at), text, ...(note ? { cut_note: note } : {}) };
}

/**
 * Validate and normalise one proposal.
 *
 * Returns null rather than a half-clip, because a clip missing its hook or its EDL cannot be
 * reviewed OR assembled, and showing it would only waste the operator's attention.
 */
function toClip(raw: RawClip): Omit<ClipProposal, 'rank'> | null {
  const edl = (Array.isArray(raw.edl) ? raw.edl : []).map(span).filter((s): s is ClipSpan => !!s);
  if (edl.length === 0) return null;

  // The hook must be the first span. If she named a hook that is not at the front, the EDL is what
  // gets cut, so the EDL wins and the hook is corrected to match it. Silently trusting the `hook`
  // field would produce a review card that does not describe the clip that gets built.
  const named = span(raw.hook);
  const hook = named && named.text === edl[0].text ? named : edl[0];

  const est = Number(raw.est_duration_seconds);
  const spoken = Math.round(
    edl.reduce((n, s) => n + s.text.split(/\s+/).filter(Boolean).length, 0) / 2.7
  );

  const platforms = Array.isArray(raw.platforms)
    ? raw.platforms.map((p) => str(p, 40)).filter(Boolean).slice(0, 6)
    : [];

  return {
    clip_id: randomUUID(),
    title: str(raw.title, 120) || 'Untitled clip',
    theme: str(raw.theme, 300),
    why_strong: str(raw.why_strong, 400),
    hook,
    edl,
    // Her estimate is kept when it is in the right ballpark, and replaced by the word count when it
    // is not. Duration drives the platform decision, so a wildly wrong number is worse than none.
    est_duration_seconds:
      Number.isFinite(est) && est > 5 && est < 240 && Math.abs(est - spoken) <= Math.max(15, spoken * 0.5)
        ? Math.round(est)
        : spoken,
    cuts_made: str(raw.cuts_made, 1000) || undefined,
    platforms: platforms.length ? platforms : undefined,
    status: 'proposed',
    created_at: new Date().toISOString(),
  };
}

/**
 * Propose clips from a transcript.
 *
 * Streams by default. A 54-minute transcript takes a long time to work through, and this is exactly
 * the wait that reads as a freeze, so the caller can show her working (see the prezie stage for the
 * same treatment).
 */
export async function proposeClips(
  transcript: string,
  context: {
    title: string;
    guest?: string;
    number?: string;
    /**
     * Sections he has already turned down.
     *
     * Without these a second pass happily hands back a section he deleted, as a fresh idea, and the
     * delete button means nothing. Marrs: "if it's just a section that I don't like, I can delete it,
     * and then she won't suggest that same section again."
     */
    excluded?: ClipExclusion[];
  },
  onProgress?: (d: StreamDelta) => void
): Promise<ClipProposal[]> {
  const body = transcript.trim();
  if (body.length < 400) throw new DraftError('no-concept');

  const heading = [
    context.number ? `Episode ${context.number}` : '',
    context.title,
    context.guest ? `with ${context.guest}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Stated as a rule rather than a list of titles, so an OVERLAPPING proposal is refused too and not
  // merely a duplicate one.
  const turnedDown = (context.excluded ?? []).length
    ? `\n\nSECTIONS HE HAS ALREADY TURNED DOWN. Do not propose these again, and do not propose a clip that covers the same ground from a different angle. Find different material:\n${(context.excluded ?? [])
        .map((e) => `- [${e.at}] ${e.theme || 'no theme given'}${e.hook ? ` (opened: "${e.hook}")` : ''}`)
        .join('\n')}`
    : '';

  const call = {
    system: SYSTEM,
    messages: [
      {
        role: 'user' as const,
        content: `EPISODE: ${heading}${turnedDown}\n\nTRANSCRIPT:\n"""\n${body}\n"""`,
      },
    ],
    // A long transcript in and a set of full EDLs out, on a model that reasons before answering.
    // Too small a ceiling here truncates the last clips, which reads as her finding fewer of them.
    maxTokens: 24000,
    temperature: 0.6,
    json: true,
    model: clipModel(),
    apiKey: process.env.APRIL_OPENROUTER_API_KEY,
  };

  let raw: string;
  try {
    raw = onProgress ? await completeStream(call, onProgress) : await complete(call);
  } catch (e) {
    console.error(`[podcast-clips] LLM threw: ${e instanceof Error ? e.message : String(e)}`);
    throw new DraftError('llm-unavailable');
  }

  const parsed = parseClips(raw);
  if (parsed.length === 0) {
    console.error(
      `[podcast-clips] no usable clips. length=${raw.length} startsWith=${JSON.stringify(raw.slice(0, 160))}`
    );
    throw new DraftError('empty');
  }
  return parsed;
}

const REVISE_SYSTEM = `You are the podcast-clip editor for Polynize, revising ONE clip that already exists, on the operator's instruction.

You are given the FULL episode transcript, the clip's current cut, and what he wants changed. Return the clip's new cut.

THE THING THAT MATTERS MOST HERE: YOU MAY REACH ANYWHERE IN THE EPISODE. The clip's current spans are not a boundary. If he asks for material that sits twenty minutes away from the rest of the clip, go and get it: a clip is a theme condensed, not a region of the timeline, so pulling a span from elsewhere is the normal way to build one and not a compromise. Search the whole transcript for what he is describing.

HOW TO REVISE
- Change what he asked for and leave the rest of the cut alone. He is building this up over several turns and expects what he already accepted to stay where it is.
- Earlier instructions still apply. You are given all of them in order; a new one adds to them rather than replacing them, unless it plainly contradicts an earlier one, in which case the newest wins.
- If he names things that should each appear (for example three named categories), find the span where each one is actually said and include a short piece of each, in the order that makes the clip play as one thought.
- Keep the hook first. If his change gives the clip a stronger opening line, move that to the front and say so in your note.
- Stay tight. Adding material is not a reason to stop cutting: drop whatever no longer serves the single idea, and keep the whole thing in the 30 to 90 second range unless he has asked for something longer.

USE ONLY THE SPEAKER'S REAL WORDS. You SELECT and ORDER spans from the transcript. You never paraphrase, you never write a linking sentence, and you never invent a line. Every span you return must be text that is actually in the transcript, with the [HH:MM:SS] anchor it appears at, because the assembly engine finds it by that anchor. If you cannot find what he is describing anywhere in the transcript, say so in your note and leave the cut as it was rather than approximating it.

Return ONLY a JSON object, no markdown and no code fence:

{"clips":[{
  "title": "the clip's title, updated only if his change makes the old one wrong",
  "theme": "the one idea in a phrase",
  "why_strong": "one line on why it will perform",
  "hook": {"at": "HH:MM:SS", "text": "the verbatim first line"},
  "edl": [{"at": "HH:MM:SS", "text": "verbatim words to keep", "cut_note": "what is cut around this and why"}],
  "est_duration_seconds": 62,
  "cuts_made": "what you removed, and what you brought in and from where",
  "platforms": ["TikTok", "Reels", "Shorts"],
  "note": "one or two sentences to the operator about what you changed, as a reply in a conversation"
}]}

Exactly one clip in the array. The first entry of "edl" MUST be the hook. Never use the em-dash character.`;

/**
 * Revise one clip on the operator's instruction.
 *
 * This is the loop Marrs asked for after using the screens: "I need something similar to what I have in
 * the Prezie creator in here, which gives me the ability to read, alter, or give a bit more direction
 * on the clip." His example is the shape of the problem exactly: he knows a later section of the episode
 * names three classes and he wants a piece of each folded into a clip that currently does not touch
 * them. So the whole transcript goes back in, not just the clip, and the prompt says outright that the
 * clip's current spans are not a boundary.
 *
 * Returns the new cut plus her note. The clip keeps its id, so the revision replaces it in place and
 * everything pointing at it survives.
 */
export async function reviseClip(
  transcript: string,
  clip: ClipProposal,
  direction: string,
  onProgress?: (d: StreamDelta) => void
): Promise<{ clip: ClipProposal; note: string }> {
  const want = direction.trim();
  if (!want) throw new DraftError('empty');
  const body = transcript.trim();
  if (body.length < 400) throw new DraftError('no-concept');

  const current = clip.edl
    .map((s, i) => `${i + 1}. [${s.at}] "${s.text}"`)
    .join('\n');

  // EVERY EARLIER DIRECTION GOES BACK IN, oldest first, with the new one last and labelled as the
  // change being asked for now. Without the history a revision silently reverts the previous one.
  const history = (clip.directions ?? []).length
    ? `WHAT HE HAS ALREADY ASKED FOR ON THIS CLIP, oldest first. These still apply:\n${(clip.directions ?? [])
        .map((d, i) => `${i + 1}. ${d}`)
        .join('\n')}`
    : '';

  const parts = [
    `THE FULL EPISODE TRANSCRIPT. You may take spans from anywhere in it:\n"""\n${body}\n"""`,
    `THE CLIP AS IT STANDS.\nTitle: ${clip.title}\nTheme: ${clip.theme}\n\nIts cut, in play order:\n${current}`,
    history,
    `THE CHANGE HE WANTS NOW:\n"""\n${want}\n"""`,
  ].filter(Boolean);

  const call = {
    system: REVISE_SYSTEM,
    messages: [{ role: 'user' as const, content: parts.join('\n\n') }],
    maxTokens: 16000,
    temperature: 0.6,
    json: true,
    model: clipModel(),
    apiKey: process.env.APRIL_OPENROUTER_API_KEY,
  };

  let raw: string;
  try {
    raw = onProgress ? await completeStream(call, onProgress) : await complete(call);
  } catch (e) {
    console.error(`[podcast-clips] revise threw: ${e instanceof Error ? e.message : String(e)}`);
    throw new DraftError('llm-unavailable');
  }

  const [revised] = parseClips(raw);
  if (!revised) {
    console.error(
      `[podcast-clips] revision unusable. length=${raw.length} startsWith=${JSON.stringify(raw.slice(0, 160))}`
    );
    throw new DraftError('empty');
  }

  const note = readNote(raw);
  return {
    clip: {
      ...revised,
      // IDENTITY AND HISTORY SURVIVE THE REVISION. Keeping the id means the clip is replaced in place
      // rather than appearing as a second one, and keeping his ruling means a revision does not quietly
      // un-approve something he had already signed off.
      clip_id: clip.clip_id,
      rank: clip.rank,
      created_at: clip.created_at,
      status: clip.status === 'assembled' ? 'approved' : clip.status,
      directions: [...(clip.directions ?? []), want],
      // The composition in Descript is now older than the words on the card.
      recut_needed: clip.status === 'assembled' || clip.recut_needed ? true : undefined,
      descript_url: clip.descript_url,
      source_aspect: clip.source_aspect,
      updated_at: new Date().toISOString(),
    },
    note,
  };
}

/** Her sentence to the operator, if she wrote one. Not worth failing a revision over. */
function readNote(raw: string): string {
  const m = String(raw ?? '').match(/"note"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!m) return 'Updated it.';
  try {
    return stripEmDashes(JSON.parse(`"${m[1]}"`) as string) || 'Updated it.';
  } catch {
    return 'Updated it.';
  }
}

/**
 * Read the reply.
 *
 * JSON is the right carrier here, unlike for figures: the payload is a nested list of objects and
 * the text is transcript prose rather than code, so it has no reason to contain the literal newlines
 * that made JSON the wrong format for CSS. The control-character repair from that episode is reused
 * anyway, because the failure mode (one bad character loses a whole expensive generation) is the
 * same and the fix already exists.
 */
export function parseClips(raw: string): ClipProposal[] {
  const t = String(raw ?? '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const c = fence ? fence[1] : t;

  // Slice to whichever container OPENS first. Anchoring on `{` alone looked right and was wrong: a
  // bare array of clips would be sliced from its first inner brace, yielding one clip object where
  // there was a list of them, and the rest would be dropped without a word.
  const brace = c.indexOf('{');
  const bracket = c.indexOf('[');
  const arrayFirst = bracket !== -1 && (brace === -1 || bracket < brace);
  const a = arrayFirst ? bracket : brace;
  const b = arrayFirst ? c.lastIndexOf(']') : c.lastIndexOf('}');
  if (a === -1 || b === -1 || b < a) return [];
  const body = c.slice(a, b + 1);

  let o: { clips?: RawClip[] } | RawClip[];
  try {
    o = JSON.parse(body) as typeof o;
  } catch {
    try {
      o = JSON.parse(repairJsonControlChars(body)) as typeof o;
    } catch {
      return [];
    }
  }

  // A bare array is accepted: models drop the wrapper often enough that refusing it would throw
  // away a perfectly good set of proposals over a key name.
  const list = Array.isArray(o) ? o : Array.isArray(o.clips) ? o.clips : [];

  // RANK IS ASSIGNED AFTER FILTERING, so the numbers the operator sees are 1, 2, 3 with no gaps.
  // Ranking before the filter left holes wherever a malformed clip was dropped, which reads as the
  // list having lost something rather than never having had it.
  return list
    .map(toClip)
    .filter((c): c is Omit<ClipProposal, 'rank'> => c !== null)
    .slice(0, 12)
    .map((c, i) => ({ ...c, rank: i + 1, title: c.title || `Clip ${i + 1}` }));
}

/**
 * The instruction Descript's agent is given to build one approved clip.
 *
 * Written as a cut list rather than a description, because the assembly proof showed the agent
 * follows an explicit ordered list of verbatim spans faithfully, including taking the hook from the
 * middle of the episode and placing it first.
 *
 * NON-DESTRUCTIVE IS STATED TWICE ON PURPOSE. The source composition is the released episode and
 * there is no undo across an API boundary, so it must not be touched.
 */
export function assemblyPrompt(
  clip: ClipProposal,
  episodeTitle: string,
  opts?: {
    /** The export is already composed for a centre crop, so speaker tracking is not needed. */
    preFramed?: boolean;
    /** The house standard, for the tightening that belongs with the cut. */
    style?: ClipStyle;
  }
): string {
  const spans = clip.edl
    .map((s, i) => `${i + 1}. [${s.at}] "${s.text}"`)
    .join('\n');

  /**
   * TWO DIFFERENT FRAMING INSTRUCTIONS, because the answer genuinely differs.
   *
   * The hard case is a raw landscape recording, where a centre crop cuts whoever is not centred out
   * of shot and only speaker tracking saves it. The easy case is an export Marrs has already composed
   * in Final Cut with both speakers inside the centre, where a plain centre crop is not a compromise
   * but the intended result. Sending the cautious instruction for a pre-framed export would produce
   * hedging and a manual-step warning for work that is already done.
   */
  /**
   * THE TIGHTENING, named as DESCRIPT'S OWN TOOLS rather than as a desired outcome.
   *
   * "Remove silences and filler words" was already in this prompt and Marrs still asked for it, which
   * says the instruction was not landing. Descript has dedicated features for both, so asking for the
   * feature by name is far more likely to be honoured than describing the result and hoping.
   */
  const tightenParts = [
    'THE TIGHTENING. Use Descript\'s OWN tools for this rather than editing by hand, because they are built for it and they are what the operator would reach for:',
    opts?.style?.remove_filler === false
      ? '- Leave filler words alone on this clip.'
      : '- Run REMOVE FILLER WORDS across the whole new composition: the "um", "uh", "you know", "like", "I mean" and "sort of" that survive a first pass. Be thorough. This is the single biggest difference between a clip that feels edited and one that feels raw.',
    opts?.style?.remove_silences === false
      ? '- Leave the gaps as they are on this clip.'
      : '- Then close the DEAD AIR, with shorten-word-gaps or remove-gaps, across both the joins between spans and the pauses inside them, so the whole thing plays as one continuous thought rather than four pieces stitched together. Leave the breath that makes speech sound human; remove the waiting.',
    '- Also drop any false start or repeated word left inside a span you kept.',
    '- SAY WHAT YOU ACTUALLY RAN and how many seconds it removed. Do not report having tightened it if the duration did not change.',
  ];
  const tightening = tightenParts.join('\n');

  const framing = opts?.preFramed
    ? `THE FRAME. The finished clip is 9:16 VERTICAL, 1080x1920.
- The source is 16:9 and has ALREADY been composed for this: both speakers sit inside the centre of
  the frame, deliberately, so that a straight centre crop keeps both of them.
- So set the composition to a 9:16 canvas and CENTRE CROP the source. That is correct here.
- Do NOT apply speaker tracking, auto-reframe, or any "center active speaker" effect. The framing was
  decided upstream and moving it would undo that decision.
- Do not letterbox, do not add blurred side bars, and do not scale the video down to fit.`
    : `THE FRAME. The finished clip is for TikTok, Reels and Shorts, so it must be 9:16 VERTICAL, 1080x1920.
- First CHECK the source media's aspect ratio. Do not assume it, and do not take my word for it.
- If the source is already 9:16, leave the framing alone. Do not crop or reframe it.
- If the source is 16:9 or any landscape ratio, set the composition to a 9:16 canvas and reframe so
  the SPEAKER stays in frame, following whoever is talking. In Descript this is the "Center active
  speaker" behaviour under the Look Good AI tools. A fixed centre crop is NOT acceptable on a
  two-person podcast, because it cuts whoever is not in the middle out of the shot.
- If you cannot apply speaker tracking yourself, DO NOT silently fall back to a static centre crop.
  Set the 9:16 canvas, leave the framing as it is, and say clearly that speaker tracking still needs
  to be switched on by hand.`;

  return `Build a VERTICAL SHORT as a NEW composition. Do NOT modify or trim the existing source composition: leave it exactly as it is.

Name the new composition: ${clip.title}

Assemble EXACTLY these spans from "${episodeTitle}", in this order. Span 1 is the hook and must come first even though it sits later in the episode than some of the others:

${spans}

THE CUT
- Keep only these spans. Everything between them is cut.
- Hard cuts only. No fades, no dissolves, no transitions.
- End on the last span. Do not add an outro, and do not pad with silence to reach any length.
- Do not add content the speaker did not say.

${tightening}

${framing}

THEN REPORT, as plain labelled lines:
- COMPOSITION: the new composition's id and name
- DURATION: its final duration in seconds
- SOURCE ASPECT: the aspect ratio you actually found on the source media
- CANVAS: the aspect ratio the new composition is set to
- SPEAKER TRACKING: applied, not needed, or needs doing by hand
- TIGHTENING: which tools you ran, and how many seconds they removed`;
}

/**
 * THE FINISH PASS: title, captions and the music bed on an already-cut clip.
 *
 * A SEPARATE AGENT CALL FROM THE CUT, and that is the fix rather than a tidy-up. It used to be one
 * prompt asking for the cut, the canvas, the title and the captions together; the agent reported doing
 * all four and Marrs opened the clip to find the finish missing. Two things follow from splitting it:
 * the finish is RE-RUNNABLE on its own, which is exactly what a missed caption track needs, and each
 * pass is small enough that its report can be checked.
 *
 * It also targets the CLIP's composition explicitly. The cut's job only ever returned a project url,
 * and opening a project opens its default composition, which is the 56-minute source.
 */
export function finishPrompt(args: {
  clipTitle: string;
  compositionId: string;
  style: ClipStyle;
}): string {
  const { clipTitle, compositionId, style } = args;
  const lines: string[] = [];

  lines.push(
    `Finish the vertical short in composition ${compositionId}. Work ONLY on that composition. Do not touch any other composition in this project, and do not re-cut, re-order or re-trim what is already there: the edit is locked and you are dressing it.`
  );

  if (style.title_seconds > 0) {
    lines.push(`THE TITLE. Put this text on screen:

  ${clipTitle}

- Held from 0 to ${style.title_seconds} seconds, then gone.
- Positioned in the VERTICAL CENTRE of the frame, horizontally centred. Not at the top, not a lower
  third: the middle of the 1080x1920 canvas.
- Font: SPACE GROTESK, Bold, at ${style.title_pt ?? 100}pt.
- Colour: MINT GREEN, hex #69fccb exactly. Not white. This is the brand colour and it is what makes the
  clip recognisable as ours.
- If Space Grotesk is not available in this project, use the closest clean geometric sans and SAY WHICH
  ONE YOU USED. Do not silently pick a default, and do not change the colour if you have to change the
  font.
- It may sit over the video: that is intended.
- Exactly the words above. Do not rewrite it and do not add a subtitle.`);
  } else {
    lines.push('THE TITLE. No title on this clip. Do not add one.');
  }

  if (style.captions) {
    const template = style.caption_template?.trim();
    lines.push(`THE CAPTIONS. Add burned-in captions to the video for the whole clip.
${
      template
        ? `- FIRST, look for a caption template or style already saved in this Descript workspace called "${template}" and APPLY IT. It was built by hand and is the intended look, so it beats anything described here. If you cannot find it, say so plainly and then follow the spec below instead.`
        : '- There is no saved caption template to apply, so follow this spec exactly.'
}
- BURNED IN, meaning visible in the rendered video, not a caption track that has to be switched on.
  If Descript distinguishes between the two, choose the one that appears in the exported file.
- CONTINUOUS, top to tail. Every spoken word is captioned and they never stop and start between spans.
- Font: SPACE GROTESK at ${style.caption_pt ?? 50}pt, WHITE. Same rule as the title if the font is
  unavailable: use the closest clean geometric sans and say which one you used.
- CENTRED horizontally, and sitting LOW in the frame: a lower third, comfortably clear of the bottom
  edge where platform UI covers things, and well below the title while the title is up. The captions
  must be clearly SMALLER and LOWER than the title, never competing with it.
- A word or short phrase at a time, big enough to read on a phone at arm's length.
- No word-by-word colour highlighting, no karaoke effect, no emoji, no bouncing, no background box
  unless the saved template has one.`);
  } else {
    lines.push('THE CAPTIONS. No captions on this clip. Do not add any.');
  }

  if (style.music_file) {
    lines.push(`THE MUSIC BED. Lay the audio file named "${style.music_file}" under the whole clip.
- Start it at 0 seconds and let it run to the end. Trim it to the clip's length; do not loop it and do
  not let it run past the last word.
- Set its level to about ${style.music_gain_db ?? -20} dB relative to the voice, so it sits UNDER the
  speech and is felt rather than heard. The voice must never have to compete with it.
- Bring it out at the very end rather than cutting it dead on the last frame.
- IF THAT FILE IS NOT IN THIS PROJECT, add no music at all and say so plainly. Do not substitute
  another track, do not use stock music, and do not generate anything. The wrong bed is worse than
  none.`);
  }

  lines.push(`THEN VERIFY, do not assume. Re-read the composition after your edits and confirm what is actually on it now. Report as plain labelled lines:
- CAPTIONS: added, or not added and why
- TITLE: added, or not added and why
- MUSIC: added, not requested, or file not found
- FONT: the font you actually used, and the point sizes you set for the title and the captions
- COLOUR: the title colour you actually set
- TEMPLATE: the caption template you applied, or that you could not find it
- DURATION: the composition's duration in seconds, which must be unchanged by this pass`);

  return lines.join('\n\n');
}

/**
 * What the finish pass reported.
 *
 * Read rather than trusted, because the first version of this system asserted that it had added
 * captions and a title, and it had not been possible to tell the difference from the console.
 */
export type FinishVerdict = 'done' | 'failed' | 'not-requested' | 'unknown';

/**
 * WHY THIS IS NOT A KEYWORD SCAN, having been one and been wrong.
 *
 * The first version read the whole line after each label and called it a failure if any negative word
 * appeared anywhere in it. Marrs's clip came back with a title and captions on it, and the card said
 * "NO title, NO captions". The report actually read:
 *
 *   **CAPTIONS:** Added — one burned-in caption track ... plain white, no karaoke/highlight/emoji
 *
 * The word "no" in "no karaoke" is part of a SUCCESS description, and it flipped the verdict. Scanning a
 * whole sentence for negative words cannot work, because the agent describes what it deliberately did
 * NOT do as evidence of doing the job properly.
 *
 * So only the LEADING CLAUSE decides, which is where the verdict actually lives, and markdown is
 * stripped first because `**CAPTIONS:**` left the capture starting at `**`.
 *
 * And "not requested" is its own outcome, not a failure. Reporting a music bed that was never asked for
 * as "music file not found" invents a problem, which is exactly what the card did.
 */
export function readFinishReport(text: string): {
  captions: FinishVerdict;
  title: FinishVerdict;
  music: FinishVerdict;
  /** The font it actually used, since a substitute is a real quality signal rather than a failure. */
  font?: string;
  /** Anything it flagged as unverified, which is worth showing without calling it a failure. */
  caveat?: string;
  report: string;
} {
  const t = String(text ?? '').replace(/[*_`]/g, '');

  /**
   * THE LABEL MUST BE ANCHORED TO A LINE, and must carry its colon.
   *
   * Unanchored and case-insensitive, `TITLE` matched the words "clear of the title area" inside the
   * CAPTIONS paragraph, so the title verdict was read out of a sentence about captions. `FONT` matched
   * "font/color applied to all 4 scene layers" the same way. Both came back as unknown on a report that
   * stated both plainly, two lines further down.
   */
  const labelled = (label: string): string =>
    t.match(new RegExp('^[ \\t>-]*' + label + '[ \\t]*:[ \\t]*([^\\n]*)', 'im'))?.[1] ?? '';

  const verdict = (label: string): FinishVerdict => {
    const line = labelled(label);
    // The verdict is the first clause. Everything after the first dash, full stop or comma is
    // description, and description is where the misleading words live.
    const head = line.split(/[—–-]|\.\s|\.$|,|\(/)[0].trim().toLowerCase();
    if (!head) return 'unknown';
    if (/^(not requested|none requested|not applicable|n\/a|not needed)/.test(head)) {
      return 'not-requested';
    }
    // "not found" and "missing" are checked ANYWHERE in the clause, because the agent writes them as
    // "file not found" and "Clip Bed.wav is missing", where the leading word is innocent.
    if (/\bnot found\b|\bmissing\b/.test(head)) return 'failed';
    if (/^(not |no\b|none\b|could not|couldn't|unable|failed|skipped|omitted)/.test(head)) {
      return 'failed';
    }
    if (/^(added|yes|done|applied|present|complete|in place|verified)/.test(head)) return 'done';
    return 'unknown';
  };

  const font = labelled('FONT').split(/[.,—–(]/)[0].trim().slice(0, 40);
  const caveat = t.match(/\b(?:caveat|note|however)\b\s*:?\s*([^\n]{10,300})/i)?.[1]?.trim();

  return {
    captions: verdict('CAPTIONS'),
    title: verdict('TITLE'),
    music: verdict('MUSIC'),
    font: font || undefined,
    caveat: caveat || undefined,
    // The whole report is kept so a surprising outcome can be read rather than guessed at later.
    report: String(text ?? '').slice(0, 4000),
  };
}

/**
 * The composition id out of an agent report, so the console can deep-link to the CLIP.
 *
 * Descript's short id in a web url is the first five characters of the composition uuid, which is how
 * `web.descript.com/{project}/{short}` is built.
 */
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

export function readCompositionId(text: string): string | undefined {
  const t = String(text ?? '');

  // The agent decorates its own labels on a whim. One cut reported `COMPOSITION: <uuid>` and the next
  // reported `**COMPOSITION:** <uuid>`, and the second did not match, so the clip lost its composition
  // id, the link fell back to the project (which opens the 56-minute source) and the finish button
  // greyed out. Markdown is stripped and anything up to 40 non-uuid characters is allowed between the
  // label and the id, so decoration cannot break this again.
  const plain = t.replace(/[*_`]/g, '');
  const labelled = plain.match(new RegExp(`COMPOSITION\\s*:?[^0-9a-f]{0,40}?(${UUID})`, 'i'));
  if (labelled) return labelled[1].toLowerCase();

  // Descript's agent also emits `<target compositionId="...">` around the composition it touched,
  // which is machine-written rather than prose and therefore a better source when it is present.
  const tagged = t.match(new RegExp(`compositionId\\s*=\\s*"(${UUID})"`, 'i'));
  if (tagged) return tagged[1].toLowerCase();

  return undefined;
}

/**
 * WHICH COMPOSITION A CLIP LIVES IN, resolving it if it was never recorded.
 *
 * SHARED because I already got this wrong by not sharing it. The finish pass resolved a missing
 * composition id and the render pass did not, so Marrs's clip 2 ("AI is an Organizational Redesign
 * Problem") could be finished but not rendered: it was cut before the id was being captured, and "Bring
 * it in" refused with a message that said it had not been cut yet, which was plainly false to anyone
 * looking at the card. Two routes needing the same fallback is a reason to write it once.
 */
export async function resolveClipComposition(
  ep: { descript_project_id?: string; descript_composition_id?: string; clips: ClipProposal[] },
  clip: ClipProposal,
  /**
   * The id an agent just claimed, when there is a fresh report to hand. It is only a HINT: the
   * project's own composition list still decides, because the report's formatting has already proved
   * unreliable and a wrong id sends the operator to the full episode.
   */
  reported?: string
): Promise<{ id?: string; how: string }> {
  // A stored id wins, unless a fresh report names a different one, which means a re-cut just happened.
  if (clip.descript_composition_id && (!reported || reported === clip.descript_composition_id)) {
    return { id: clip.descript_composition_id, how: 'stored' };
  }
  if (!ep.descript_project_id) return { how: 'no-project' };
  const resolved = await resolveComposition({
    projectId: ep.descript_project_id,
    reported,
    clipTitle: clip.title,
    // The episode's own composition is the full recording and is never the answer.
    sourceCompositionId: ep.descript_composition_id,
    claimed: ep.clips
      .filter((c) => c.clip_id !== clip.clip_id && c.descript_composition_id)
      .map((c) => c.descript_composition_id!),
  });
  return { id: resolved.id ?? clip.descript_composition_id, how: resolved.how };
}

/** The url that opens one composition rather than the project's default (the full episode). */
export function compositionUrl(projectId: string, compositionId?: string): string {
  const base = `https://web.descript.com/${projectId}`;
  return compositionId ? `${base}/${compositionId.slice(0, 5)}` : base;
}

/**
 * Read the agent's report to find out whether the clip is actually finished.
 *
 * This exists because of a specific, expensive gap. Descript's speaker-tracking reframe was found NOT
 * to be exposed to automation, which means a 16:9 source can be cut, ordered and canvased
 * automatically but still needs a roughly thirty second manual toggle before it is publishable. The
 * dangerous outcome is not the manual step, it is a clip that LOOKS done, gets published, and has a
 * speaker cropped out of frame. So the agent is asked to state what it managed, and this turns that
 * statement into a flag the operator can see.
 *
 * Deliberately pessimistic: anything other than a clear "applied" or "not needed" is treated as
 * still needing a human, because assuming it worked is the one reading with a bad failure mode.
 */
export function readAssemblyReport(
  text: string,
  opts?: { preFramed?: boolean }
): {
  source_aspect?: '9:16' | '16:9' | 'unknown';
  needs_reframe: boolean;
  captions?: boolean;
  title?: boolean;
} {
  const t = String(text ?? '');
  const aspectLine = t.match(/SOURCE ASPECT\s*:?\s*([^\n]*)/i)?.[1] ?? '';
  const vertical = /\b9\s*[:x]\s*16\b|vertical|portrait/i.test(aspectLine);
  const landscape = /\b16\s*[:x]\s*9\b|landscape|1920\s*[x×]\s*1080/i.test(aspectLine);
  const source_aspect: '9:16' | '16:9' | 'unknown' = vertical
    ? '9:16'
    : landscape
      ? '16:9'
      : 'unknown';

  const trackingLine = t.match(/SPEAKER TRACKING\s*:?\s*([^\n]*)/i)?.[1] ?? '';
  const settled = /\bapplied\b|\bnot needed\b|\balready\b/i.test(trackingLine);

  const said = (label: string) => {
    const line = t.match(new RegExp(label + '\\s*:?\\s*([^\\n]*)', 'i'))?.[1] ?? '';
    if (!line.trim()) return undefined;
    return !/\bnot\b|\bno\b|\bcould not\b|\bunable\b|\bfailed\b/i.test(line);
  };

  return {
    source_aspect,
    // A vertical source needs nothing, and neither does a PRE-FRAMED landscape export: Marrs put both
    // speakers in the centre in Final Cut, so the centre crop is the intended framing rather than a
    // compromise. Everything else needs a human unless the agent said outright that it handled it.
    needs_reframe:
      source_aspect === '9:16' || opts?.preFramed ? false : !settled,
    captions: said('CAPTIONS'),
    title: said('TITLE'),
  };
}
