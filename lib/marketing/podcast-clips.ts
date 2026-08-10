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
import { stripEmDashes } from '@/lib/em-dash';
import { DraftError } from './draft';
import type { ClipProposal, ClipSpan } from './podcast-store';

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
  context: { title: string; guest?: string; number?: string },
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

  const call = {
    system: SYSTEM,
    messages: [
      {
        role: 'user' as const,
        content: `EPISODE: ${heading}\n\nTRANSCRIPT:\n"""\n${body}\n"""`,
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
- Remove silences, filler words and false starts inside the spans you keep.
- Hard cuts only. No fades, no dissolves, no transitions.
- End on the last span. Do not add an outro, and do not pad with silence to reach any length.
- Do not add content the speaker did not say.

${framing}

THE TITLE. Put this on screen as a title, held for the first FIVE seconds and then gone:

  ${clip.title}

- Position it in the VERTICAL CENTRE of the frame, horizontally centred. Not at the top, not as a
  lower third: the middle of the 1080x1920 canvas.
- Keep it to the words above. Do not rewrite it and do not add a subtitle.
- Big enough to read at a glance on a phone, and it may sit over the video: that is intended.

THE CAPTIONS. Add burned-in captions for the whole clip.
- They run CONTINUOUS, top to tail. Every spoken word is captioned and the captions never stop and
  start between sections.
- Lower third, centred, comfortably clear of the bottom edge where platform UI sits.
- A word or a short phrase at a time, big enough to read on a phone at arm's length.
- Plain white text. No word-by-word colour highlighting, no karaoke effect, no emoji, no bouncing.
- Captions come LAST, after the cut is locked, so they match the final edit and not the original.

THEN REPORT, as plain labelled lines:
- COMPOSITION: the new composition's id and name
- DURATION: its final duration in seconds
- SOURCE ASPECT: the aspect ratio you actually found on the source media
- CANVAS: the aspect ratio the new composition is set to
- SPEAKER TRACKING: applied, not needed, or needs doing by hand
- CAPTIONS: added or not added
- TITLE: added or not added`;
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
