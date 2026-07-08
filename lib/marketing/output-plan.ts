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
};

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
  },
  {
    id: 'short_form_video',
    label: 'Short-form video',
    kind: 'video',
    module: 'built',
    channels: ['instagram', 'tiktok', 'youtube', 'linkedin'],
  },
  {
    id: 'medium_video',
    label: 'Medium video (3-5 min)',
    kind: 'video',
    module: 'coming',
    channels: ['youtube'],
  },
  {
    id: 'long_form_text',
    label: 'Long-form text + image',
    kind: 'text',
    module: 'coming',
    channels: ['linkedin'],
  },
  {
    id: 'pdf_carousel',
    label: 'PDF / document carousel',
    kind: 'image',
    module: 'coming',
    channels: ['linkedin'],
  },
  {
    id: 'image_carousel',
    label: 'Image carousel',
    kind: 'image',
    module: 'coming',
    channels: ['instagram'],
  },
  {
    id: 'single_image',
    label: 'Single image',
    kind: 'image',
    module: 'coming',
    channels: ['instagram', 'linkedin'],
  },
  {
    id: 'newsletter',
    label: 'Newsletter',
    kind: 'text',
    module: 'coming',
    channels: ['newsletter'],
  },
  {
    id: 'long_form_written',
    label: 'Long-form written (Substack)',
    kind: 'text',
    module: 'coming',
    channels: ['substack'],
  },
];

export function formatById(id: string): FormatDef | undefined {
  return FORMATS.find((f) => f.id === id);
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
