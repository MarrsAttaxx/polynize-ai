/**
 * The Output-plan step's registry (D19/D23): the format catalogue, the ICP
 * archetype set, and the defaulting that makes the step a one-tap confirm.
 *
 * A concept fans out to one piece per selected BUILT output. Formats whose
 * production module does not exist yet are `coming` — shown but not selectable,
 * so the step is real now without spawning dead pieces. Source of truth for the
 * surface: docs/pam-console/content-format-matrix.md.
 */

import { sectionProse, sectionItems } from './concept-parse';

export type FormatKind = 'video' | 'text' | 'image';
export type ModuleStatus = 'built' | 'coming';

export type FormatDef = {
  /** Stable id; this is what lands in piece.format. */
  id: string;
  label: string;
  kind: FormatKind;
  /** 'built' = has a production module the console can run; 'coming' = not yet. */
  module: ModuleStatus;
  /** Candidate channels (platforms) this format can publish to. */
  channels: string[];
  /** Industry-standard length target, used to prefill a template's Length field
   *  and injected into the draft prompt so the model knows its limits. Human copy
   *  (words for text, minutes/seconds for video), editable per template. */
  defaultLength: string;
  /**
   * The PHYSICAL output shape for this format (D29): its capture setup and the
   * artifacts it must produce. A property of the FORMAT (how it is shot and
   * assembled), separate from a template's recipe (its editorial structure). When
   * present it replaces the default script shape in the draft prompt.
   */
  scriptShape?: string;
  /**
   * This format produces a separate SCREEN PROMPT (the pre-record screen plan) as well
   * as the script (D29, amended). The script stays SPOKEN-ONLY so it can be read
   * straight off the teleprompter; the visuals live in the Screen Prompt, which is
   * the brief the animation build works from. Drives the two-section draft contract
   * and the Screen Prompt stage. (Stored on `piece.treatment`: the code identifier
   * keeps the original name so already-drafted pieces are not orphaned.)
   */
  twoTrack?: boolean;
  /**
   * Format-specific guidance for the SCREEN PROMPT generation (safe area, opening
   * caption, shot marks). Appended to the shared SCREEN_PROMPT_BRIEF. Separate from
   * `scriptShape` because the screen prompt is generated on its own stage, from the
   * locked script plus the operator's direction, not in the same pass as the script.
   */
  screenPromptShape?: string;
};

/**
 * What makes a good touchscreen visual (D29). Shared by the touchscreen formats and
 * injected into the SCREEN PROMPT half of the draft, since the screen is a PRE-RECORD
 * dependency: it has to be built before the shoot because the presenter touches it
 * live on camera. It is a prop, not post-production.
 */
/**
 * HOW A HOOK WORKS HERE, read off three that Marrs actually wrote rather than invented.
 *
 * This replaces a set of examples I made up, one of which was a draft he had already
 * rejected as a bad hook. Examples that are not his produce hooks that are not his, so the
 * patterns below are described from what HIS hooks DO, not from what they sound like.
 *
 * The three, verbatim, for the record:
 *   1. ON-SCREEN "The smartest companies do this before touching any AI."
 *      SPOKEN "The smartest companies in the world are doing this right now before touching
 *      any AI"
 *   2. ON-SCREEN "The Key to Unlocking AI in Your Company"
 *      SPOKEN "If your company is struggling to implement AI in any meaningful way, you're
 *      most likely missing this important first step."
 *   3. ON-SCREEN "Why Buying More AI Licences Makes things worse"
 *      SPOKEN "If your company keeps buying more AI licences and you haven't seen any ROI
 *      yet, I guarantee THIS is the problem."
 */
export const HOOK_CRAFT = `HOW A HOOK WORKS IN THIS HOUSE. These are craft rules read off hooks the presenter wrote himself, so follow them as rules rather than as taste.

WHAT EVERY HOOK DOES
- IT WITHHOLDS THE PAYLOAD. Each of his hooks points at an unnamed thing: "do THIS", "missing THIS important first step", "THIS is the problem". The hook names the SHAPE of the answer and never the answer. A hook that contains the answer is not a hook, it is a summary.
- IT QUALIFIES THE AUDIENCE OUT LOUD. Two of the three open with a condition that lets the right viewer recognise themselves: "If your company is struggling to...", "If your company keeps buying...". That is what makes the wrong viewer scroll on and the right one stay.
- IT CARRIES AUTHORITY OR A GUARANTEE. "The smartest companies in the world". "I guarantee". A flat claim with nothing behind it does not survive the first second.
- IT IS SECOND PERSON, PRESENT TENSE, ABOUT THEIR COMPANY, NOW. Never about the presenter. No greeting, no "in this video", and never a question as the opening line.

THE TWO LINES DO DIFFERENT JOBS
- ON-SCREEN TEXT is the headline: 6 to 10 words, declarative, readable on mute at a glance. It states the claim or the prize.
- SPOKEN is longer, 15 to 25 words, one breath. It qualifies who this is for and carries the guarantee or the authority.
- They must NOT be the same sentence reworded. Read together they open a gap that the beats then close.

THREE WAYS IN, one per hook when several are asked for. These are different ENTRY POINTS to the same argument, never rewordings of each other:
- THE ELITE ALREADY DO IT: name what the best operators do before the thing the viewer is rushing into, and withhold what "it" is.
- THE MISSING FIRST STEP: name the symptom the viewer is living with, then assert there is a step they skipped.
- THE COUNTERPRODUCTIVE ACTION: name what they are actively spending money or effort on, and say it is making the problem worse.

NEVER: a rhetorical question as the first line, "in this video", "let me tell you", a statistic with no consequence attached, or an on-screen line that just repeats the spoken one.`;

/*
 * RETIRED WITH THE DECK (D31, 2026-07-28). SCREEN_RULES, SCREEN_PROMPT_BRIEF and the
 * per-format `screenPromptShape` fed the prose brief that an animator built from. Nothing
 * calls them: the Interface stage generates a SCENE as data and the engine owns the look.
 *
 * Left in place rather than deleted because the editorial guidance inside them is still
 * right and not yet expressed anywhere else: the first-frame ON-SCREEN TEXT that stops the
 * scroll and differs from the spoken hook, and the long-form rule that the screen builds
 * CUMULATIVELY instead of resetting each beat. Both belong in the scene generation prompt.
 * Folding them in is a behaviour change, so it is a separate job; delete this block then.
 */
const SCREEN_RULES = `Screen visuals are REPRESENTATIONAL, not detailed: one big bold idea per state (a word, a number, a simple shape or diagram), readable in a thumbnail. Never a slide of bullet points, never small text, never a screenshot of an interface. Each touch does one legible thing that reinforces the point being spoken (reveal, split, collapse, snap into place, wipe away). The screen must never say something the spoken line contradicts.

Any number or phrase shown on screen is lifted VERBATIM from the concept. Never convert, round, or derive one: if the concept says "a full day", the screen says A FULL DAY, not 24 HOURS. A figure the concept does not state does not go on the screen.`;

/**
 * The design system carried INTO the animator's brief. The animation is built as a
 * self-contained HTML page (the animator works in a separate session without repo
 * access), so the brief must state the tokens and the depth rules rather than point
 * at them. Mirrors app/tactile.css + TACTILE_DESIGN_LANGUAGE.md and globals.css.
 */
const BUILD_SYSTEM = `BUILD BRIEF (emit this section once, before the states)
State what is being built: ONE self-contained HTML page (inline CSS + JS, no external assets or fonts beyond a Google Fonts link for Space Grotesk), run fullscreen on a 32in touchscreen in a dark studio, with one STATE per beat advanced by the operator's touch. No scrolling, no browser chrome, no cursor. Say how many states there are.

DESIGN SYSTEM (emit this section once, verbatim values, so the build is on-brand)
- Type: Space Grotesk 700 for everything on screen. Huge. One idea fills the frame. Uppercase for short declaratives.
- Palette: ink #0a0a0f (deepest), tactile bg #161620, raised surface #1c1c27, recessed well #0f0f17, cream text #f4ece4, mint #69fccb (the accent and the "agent/resolution" colour), coral #ff7a6b (the human/problem colour), amber #f0b86b (hybrid/tension), gold #f0e1b6 (numbers and proof).
- Depth is the house style ("tactile"): objects sit ON the surface as raised cards or are carved INTO it as recessed wells. ONE fixed light source, upper-left: a 1px top/left highlight rgba(255,255,255,0.07) inset and a 1px bottom/right shadow rgba(0,0,0,0.55) inset, plus a soft cast shadow down-right. Only three elevations exist: flat, raised, emphasised. Do not invent more.
- Motion is decisive, never soft: elements cut, snap, slide, crack, collapse, or wipe. NO crossfades, NO dissolves, no slow opacity ramps. Fast easing (120 to 260ms). Motion always carries meaning, never decoration.
- Nothing decorative: no emoji, no icon libraries, no gradients beyond the mint button gradient, no stock imagery.

OPERATOR STRIP (emit this section once)
The page renders the operator's next-gesture cue as a single short line pinned to the BOTTOM EDGE of the page, outside the composition. It must be legible to the presenter standing over the screen but effectively invisible on camera: small (about 14px), letter-spaced, uppercase, in cream at 6 to 8 percent opacity on the dark substrate, with no background panel or border. It updates per state and never animates.`;

/**
 * The two-artifact output contract. The SCRIPT is what the presenter reads on the
 * teleprompter, so it must contain nothing but beat labels and spoken words; every
 * visual instruction belongs in the SCREEN PROMPT. Both are generated in ONE pass so
 * they are coherent by construction, and share beat labels so they cannot drift.
 */
export const SCREEN_PROMPT_BRIEF = `You are writing the SCREEN PROMPT: the build brief for the animator who will code the touchscreen page, and the gesture cues that prompt the presenter through the take. It is handed to someone with no other context, so it must be complete enough to build from without asking a question.

It is built FROM THE LOCKED SCRIPT you are given. Work through that script beat by beat: for each beat label in it, design the screen moment that carries THAT spoken line. Never invent beats the script does not have, never skip one, and never reorder them. The screen is what the words are talking about.

Where the operator has given direction, that direction WINS. It is their creative intent for this piece; build it, do not water it down or substitute your own idea. Fill in only what they left open.

Open with the three sections below, then the states.

${BUILD_SYSTEM}

STATES
Then, for each beat label in the script, repeat the label EXACTLY and give these lines. Be concrete and visual on every one: a vague brief produces a weak build.
- "COMPOSITION:" what is on screen and where it sits, at what scale, in the frame. Name the arrangement (three standing pillars, one centred word, two facing blocks, a single number).
- "TYPE:" the exact words on screen, in quotes. Write "none" when the moment is purely visual: a state carrying no text at all is often stronger, especially the opening.
- "COLOUR:" which brand colour carries which element, and what that colour is doing (problem, tension, proof, resolution).
- "MATERIAL:" the depth and surface treatment for each element (flat, raised card, emphasised, carved into a recessed well), honouring the upper-left light. Texture is welcome: grain, pixelation, a rough or eroded edge, a glow.
- "MOTION:" what happens on entry and how the state resolves. Decisive movement, no crossfades, and it must mirror the meaning of the spoken line for this beat.
- "GESTURE:" the exact touch the presenter performs (single tap, drag left, pinch in, double tap), where on the screen, and what it triggers.
- "CUE:" the short operator line for the bottom strip, in quotes, telling the presenter the gesture for this state. Four words or fewer, uppercase, for example "TAP CENTRE TO SPLIT".

${SCREEN_RULES}

Recurring elements keep their colour and their material across states, so the page reads as one designed system rather than a series of unrelated slides, and the visual builds as the argument builds.

Output the brief ONLY: no preamble, no closing commentary, no markdown code fences.`;

/**
 * The channel-agnostic format catalogue (the swappable-middle registry). Only
 * `built` formats can be created into pieces today: the text module (this build)
 * and short-form video (the existing Script screen). Everything else is `coming`.
 */
export const FORMATS: FormatDef[] = [
  {
    id: 'linkedin_text',
    label: 'LinkedIn post (text)',
    kind: 'text',
    module: 'built',
    channels: ['linkedin'],
    defaultLength: 'A standard in-depth post is 150 to 250 words. A quick post is 50 to 100 words. Keep it tight; cut any line that does not earn its place.',
  },
  {
    id: 'split_screen_short',
    label: 'Split-screen short (9:16 hero)',
    kind: 'video',
    module: 'built',
    channels: ['instagram', 'tiktok', 'youtube', 'linkedin'],
    defaultLength:
      'Aim for 45 to 75 seconds spoken (roughly 120 to 190 words). Never over 90 seconds.',
    twoTrack: true,
    scriptShape: `Output shape. This is the SPLIT-SCREEN 9:16 hero format. One studio setup, two angles: the TOP half of the frame is a mid front shot of the presenter to camera, the BOTTOM half is a bird's-eye view of a 32in touchscreen the presenter is touching. Both halves are on screen the whole time, so the words and the screen move together.

THE SHAPE, exactly. This is Marrs's own short-form structure, taken from a script he wrote; it is the house standard for short form, not a suggestion.

HOOK 1:
ON-SCREEN TEXT: <the headline claim, 6 to 10 words>
SPOKEN: <what he says, one breath, 15 to 25 words>

----

HOOK 2:
(same two lines)

----

HOOK 3:
(same two lines)

----

BEAT 1
<spoken prose, one or two short paragraphs, one idea>

BEAT 2
<spoken prose>

BEAT 3
<spoken prose>

BEAT 4 (only if the argument needs it)
<spoken prose>

CTA
<the ask, one or two sentences>

CLOSE
<one line after the CTA, the last thing said, worth punching>

Rules that follow from that shape:
- Write as many HOOKS as asked for (the default is one; a template can ask for three), each separated by a line of four hyphens. Every hook is a DIFFERENT way in to the same argument, and every one must hand over cleanly to BEAT 1, because only one of them will survive the edit.
- ON-SCREEN TEXT and SPOKEN are NOT the same sentence. The on-screen line is the headline: shorter, flatter, declarative, the thing that stops a scroll on mute. The spoken line is said out loud and usually qualifies who this is for. Together they should open a gap, not repeat each other.
- THE BEATS CARRY SPOKEN WORDS ONLY. No screen notes, no stage directions, no shot marks: the beats are read off a teleprompter and the screen is planned separately as the prezie. The ON-SCREEN TEXT line inside a hook is the ONE exception, because that text is part of the hook itself.
- CTA and CLOSE are separate sections and both are needed. The CTA is the ask. The CLOSE is one line AFTER it, the actual last thing said, and it is punched in the edit, so it has to be worth punching.
- Three beats is the norm and four is allowed when the argument genuinely has a fourth move. One idea per beat.`,
    screenPromptShape: `Before the first beat, add one line labelled "ON-SCREEN TEXT:" holding the first-frame caption that stops the scroll, or write "none" if the opening is purely visual. It is never spoken, and if used its words differ from the spoken hook so the two together open a gap.

FRAMING for this format, state it in the DESIGN SYSTEM section. These are measured from the real rig, so design to them:
- The bird's-eye camera captures the WHOLE 32in display, so the full 16:9 screen is in shot and every part of it is usable. Compose edge to edge; there is no crop to design around.
- SCALE is the real constraint. The display lands in the upper part of the lower half of a vertical video watched on a phone, so it reads at roughly a quarter of the phone's height. Type is huge, strokes are heavy, and a state never carries more than one idea. If it would not be legible as a thumbnail, it is too small.
- The presenter's HAND enters from the RIGHT and rests over the right and lower-right of the display while they talk. Keep the payoff (the key word, the number, the resolution) LEFT of centre and high on the screen, and put the touch target on the right where the hand already is. Never place the thing the viewer must read under the hand.`,
  },
  {
    id: 'screen_record_long',
    label: 'Screen-record long (16:9 hero)',
    kind: 'video',
    module: 'built',
    channels: ['youtube', 'linkedin'],
    defaultLength:
      'Aim for 4 to 8 minutes spoken (roughly 600 to 1200 words).',
    twoTrack: true,
    scriptShape: `Output shape. This is the SCREEN-RECORD 16:9 hero format. Same studio setup as the split-screen short, but the touchscreen is captured as a clean SCREEN RECORDING for fidelity. It opens FULL SCREEN on the presenter to camera introducing the piece, then switches to the screen recording with the presenter's head in a small circle (picture in picture) for the body, cutting to the bird's-eye overhead angle occasionally when the physical touch is the point.

Use plain beat labels on their own lines. The first is "INTRO (full screen)": the presenter to camera with no screen visual yet, and it must earn the next minute (the promise of the piece, not a preamble about themselves). Then the body sections, each labelled, then the close. If the recipe defines its own beats, use its labels and its order and honour its own ending. End on one sharp spoken line worth punching. This format has room to breathe: develop each section properly rather than rushing, but never pad.

Output the SPOKEN SCRIPT ONLY: the beat labels, and under each the exact words said to camera. It is read off a teleprompter, so it carries no visual notes, no screen descriptions, no stage directions and no shot marks. The screen is planned separately, from this script.`,
    screenPromptShape: `The INTRO beat has no screen visual; say so. Build the screen visual CUMULATIVELY across the body beats, so it assembles into one picture by the end rather than resetting each beat. Add "SHOT: overhead" to the one or two beats where the physical touch is the point.

FRAMING for this format, state it in the DESIGN SYSTEM section: the screen recording fills the full 16:9 frame at full fidelity, so the whole screen is usable and the composition can be wide and detailed (this format can carry more than the short can). Keep the bottom-right corner clear for the presenter's picture-in-picture circle, and keep the bottom edge strip clear of composition so the operator cue stays out of the way.`,
  },
  {
    id: 'short_form_video',
    label: 'Short-form video (simple vertical)',
    kind: 'video',
    module: 'built',
    channels: ['instagram', 'tiktok', 'youtube', 'linkedin'],
    defaultLength: 'Aim for 45 to 90 seconds spoken (roughly 120 to 220 words). Never over 3 minutes.',
  },
  {
    id: 'medium_video',
    label: 'Medium video (3-5 min)',
    kind: 'video',
    module: 'coming',
    channels: ['youtube'],
    defaultLength: '3 to 5 minutes spoken (roughly 450 to 750 words).',
  },
  {
    id: 'long_form_text',
    label: 'Long-form text + image',
    kind: 'text',
    module: 'coming',
    channels: ['linkedin'],
    defaultLength: '500 to 900 words.',
  },
  {
    id: 'pdf_carousel',
    label: 'PDF / document carousel',
    kind: 'image',
    module: 'coming',
    channels: ['linkedin'],
    defaultLength: '6 to 10 slides, one idea per slide, a few words each.',
  },
  {
    id: 'image_carousel',
    label: 'Image carousel',
    kind: 'image',
    module: 'coming',
    channels: ['instagram'],
    defaultLength: '5 to 8 slides, one idea per slide.',
  },
  {
    id: 'single_image',
    label: 'Single image',
    kind: 'image',
    module: 'coming',
    channels: ['instagram', 'linkedin'],
    defaultLength: 'One image plus a caption of 40 to 120 words.',
  },
  {
    id: 'newsletter',
    label: 'Newsletter',
    kind: 'text',
    module: 'coming',
    channels: ['newsletter'],
    defaultLength: '500 to 1200 words.',
  },
  {
    id: 'long_form_written',
    label: 'Long-form written (Substack)',
    kind: 'text',
    module: 'coming',
    channels: ['substack'],
    defaultLength: '800 to 1500 words.',
  },
];

export function formatById(id: string): FormatDef | undefined {
  return FORMATS.find((f) => f.id === id);
}

/** The industry-standard length target for a format, for prefilling a template. */
export function defaultLengthFor(formatId: string): string {
  return formatById(formatId)?.defaultLength ?? '';
}

/** The kind for a format id, defaulting to video (the legacy piece shape). */
export function kindOf(formatId: string): FormatKind {
  return formatById(formatId)?.kind ?? 'video';
}

/** ICP archetypes — the taxonomy from the brand-voice builder (D21). */
export const ICP_ARCHETYPES: { id: string; label: string }[] = [
  { id: 'organisational_architect', label: 'Organisational Architect' },
  { id: 'high_stakes_operator', label: 'High-Stakes Operator' },
  { id: 'revenue_accelerator', label: 'Revenue Accelerator' },
  { id: 'talent_champion', label: 'Talent Champion' },
  { id: 'service_ops_leader', label: 'Service Ops Leader' },
];

export function icpLabel(id: string | undefined): string | undefined {
  if (!id) return undefined;
  return ICP_ARCHETYPES.find((a) => a.id === id)?.label;
}

/**
 * Default the ICP from the concept's "Who it is for" section: if any archetype's
 * label appears there (case-insensitive), pre-select it. Otherwise undefined and
 * the owner picks. Cheap, best-effort — the archetype names are distinctive.
 */
export function defaultIcpFromConcept(bodyMd: string): string | undefined {
  const who = (
    sectionProse(bodyMd, 'who it is for') +
    ' ' +
    sectionItems(bodyMd, 'who it is for').join(' ')
  ).toLowerCase();
  if (!who.trim()) return undefined;
  const hit = ICP_ARCHETYPES.find((a) => who.includes(a.label.toLowerCase()));
  return hit?.id;
}

export type OutputPlanDefaults = {
  /** Format ids pre-selected (built formats only). */
  formats: string[];
  /** Default platforms per format id (all the format's channels). */
  platforms: Record<string, string[]>;
  icp?: string;
  pillar?: string;
};

/**
 * The one-tap default plan for a concept. Pre-selects the text output (the
 * built path that completes idea→published, D23) and, for a video-led stream,
 * short-form video too. The owner confirms or edits; nothing here is forced.
 */
export function defaultPlan(bodyMd: string, stream: string): OutputPlanDefaults {
  const formats = ['linkedin_text'];
  // Marrs is the main video user; pre-tick short-form video for his stream so
  // the common case is still one tap. Others lean non-video (D19).
  if (stream === 'marrs') formats.push('short_form_video');

  const platforms: Record<string, string[]> = {};
  for (const id of formats) {
    platforms[id] = formatById(id)?.channels.slice() ?? [];
  }
  return { formats, platforms, icp: defaultIcpFromConcept(bodyMd) };
}
