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
   * The PHYSICAL output shape of the script for this format (D29): the capture
   * setup and the labelled tracks the script must produce. This is a property of
   * the FORMAT (how it is shot and assembled), separate from a template's recipe
   * (its editorial structure). When present it replaces the default script shape
   * in the draft prompt, so a two-track format gets a two-track script.
   */
  scriptShape?: string;
};

/**
 * The two-track shape shared by the touchscreen formats (D29). The visuals live on
 * the 32in touchscreen and are captured in-camera, so the script must brief the
 * SCREEN as well as the words: each beat carries what is on the screen and what the
 * touch does. That SCREEN track is the brief the animation build works from.
 */
const SCREEN_TRACK_RULES = `Every beat carries TWO labelled lines, in this order:
- "SPOKEN:" the exact words said to camera.
- "SCREEN:" what is on the touchscreen for that beat, then the touch interaction and the transition out of it, in one or two sentences.

Screen visuals are REPRESENTATIONAL, not detailed: one big bold idea per beat (a word, a number, a simple shape or diagram), readable in a thumbnail. Never a slide of bullet points, never small text, never a screenshot of an interface. Each touch does one legible thing that reinforces the point being spoken (reveal, split, collapse, snap into place, wipe away). The screen must never say something the spoken line contradicts.`;

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
    scriptShape: `Output shape. This is the SPLIT-SCREEN 9:16 hero format. One studio setup, two angles: the TOP half of the frame is a mid front shot of the presenter to camera, the BOTTOM half is a bird's-eye view of a 32in touchscreen the presenter is touching. Both halves are on screen the whole time, so the words and the screen move together.

${SCREEN_TRACK_RULES}

Structure it with plain labels on their own lines. Start with one line labelled "ON-SCREEN TEXT" holding the first-frame caption that stops the scroll (the one non-spoken line, in different words from the spoken hook). Then HOOK, then the beats, then the close. If the recipe defines its own beats, use its labels and its order and honour its own ending, including whether it has a call to action. End on one sharp line worth punching.

Keep it fast: one idea per beat, and the screen changes on every beat so the frame never sits still.`,
  },
  {
    id: 'screen_record_long',
    label: 'Screen-record long (16:9 hero)',
    kind: 'video',
    module: 'built',
    channels: ['youtube', 'linkedin'],
    defaultLength:
      'Aim for 4 to 8 minutes spoken (roughly 600 to 1200 words).',
    scriptShape: `Output shape. This is the SCREEN-RECORD 16:9 hero format. Same studio setup as the split-screen short, but the touchscreen is captured as a clean SCREEN RECORDING for fidelity. It opens FULL SCREEN on the presenter to camera introducing the piece, then switches to the screen recording with the presenter's head in a small circle (picture in picture) for the body, cutting to the bird's-eye overhead angle occasionally when the physical touch is the point.

${SCREEN_TRACK_RULES}

Structure it with plain labels on their own lines:
- "INTRO (full screen)" first: the presenter to camera, no screen visual yet. Spoken only, and it must earn the next minute: the promise of the piece, not a preamble about themselves.
- Then the body sections, each labelled, each with SPOKEN and SCREEN lines. Add "SHOT: overhead" on a section where the touch itself should be seen.
- Then the close.
If the recipe defines its own beats, use its labels and its order and honour its own ending. End on one sharp line worth punching.

This format has room to breathe: develop each section properly rather than rushing, but never pad.`,
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
