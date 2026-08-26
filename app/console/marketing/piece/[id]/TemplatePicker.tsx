'use client';

/**
 * PICK THE LOOK, before anything is written.
 *
 * Marrs: "What I realised that's missing from here is some templates, some stylistic templates,
 * so the user can choose out of three different styles... Each needs to be on-brand graphically,
 * with minimal text and a small image. One of them can be sort of full-image generation."
 *
 * All three compositions already existed and all three were unreachable: the plan carries a
 * `template`, the propose prompt and the compositor both branch on it, and no screen ever set
 * it, so every set silently fell back to the legacy full frame. This is the missing control.
 *
 * WHY IT DRAWS A DIAGRAM AND NOT A PARAGRAPH. "Statement plate", "Split card" and "Full frame"
 * mean nothing until you have seen one, and Marrs has said plainly that he cannot choose from a
 * description: "I can't imagine this, so just build me a simple clickable version." So each
 * option carries a 4:5 schematic of its own layout, in brand colours, at the real proportions.
 *
 * A SCHEMATIC RATHER THAN A SAMPLE IMAGE on purpose. A rendered sample is a photograph of one
 * headline at one length, it weighs a megabyte, and it goes stale the moment the compositor
 * changes. The diagram is drawn from the same facts the compositor uses, so it cannot promise a
 * small photo and get a full bleed one.
 *
 * The cost line is the other half of the decision: `full` is ten generations and ten waits,
 * `plate` is none, and that is worth knowing before the picking rather than after.
 */

import { TEMPLATE_SPECS, generationsFor, type TemplateSpec } from '@/lib/marketing/slide-templates';
import type { SlideTemplate } from '@/lib/marketing/slide-plan';
import s from './template-picker.module.css';

/** Brand ink, matching the compositor: paper text, mint accent, mono furniture. */
const INK = '#f4ece4';
const DIM = 'rgba(244, 236, 228, 0.34)';

/**
 * The layout, drawn. 72 x 90 is 4:5, the real slide ratio, so the amount of frame a photograph
 * takes is honest rather than decorative.
 */
function Thumb({ id, accent }: { id: SlideTemplate; accent: string }) {
  return (
    <svg viewBox="0 0 72 90" className={s.thumb} aria-hidden focusable="false">
      <rect x="0" y="0" width="72" height="90" rx="4" fill="#101018" />

      {id === 'plate' ? (
        <>
          {/* The short accent rule, then the claim at the largest type of the three. */}
          <rect x="9" y="18" width="13" height="2" fill={accent} />
          <rect x="9" y="26" width="48" height="6" rx="1" fill={INK} />
          <rect x="9" y="35" width="40" height="6" rx="1" fill={accent} />
          <rect x="9" y="44" width="52" height="6" rx="1" fill={INK} />
          <rect x="9" y="57" width="38" height="3" rx="1" fill={DIM} />
          <rect x="9" y="63" width="30" height="3" rx="1" fill={DIM} />
        </>
      ) : id === 'split' ? (
        <>
          {/* The window up top, its seam, the words underneath. A flat fill stands in for the
              photograph: what is being shown is how much frame it takes, not what is in it. */}
          <rect x="8" y="8" width="56" height="34" rx="3" fill={accent} opacity="0.4" />
          <rect x="8" y="43" width="56" height="1.4" fill={accent} />
          <rect x="8" y="52" width="44" height="5" rx="1" fill={INK} />
          <rect x="8" y="60" width="34" height="5" rx="1" fill={accent} />
          <rect x="8" y="70" width="40" height="3" rx="1" fill={DIM} />
        </>
      ) : (
        <>
          {/* Edge to edge, the words over it, weighted low. */}
          <rect x="0" y="0" width="72" height="90" rx="4" fill={accent} opacity="0.4" />
          <rect x="9" y="40" width="11" height="2" fill={accent} />
          <rect x="9" y="48" width="50" height="6" rx="1" fill={INK} />
          <rect x="9" y="57" width="42" height="6" rx="1" fill={accent} />
          <rect x="9" y="66" width="46" height="6" rx="1" fill={INK} />
        </>
      )}

      {/* The footer every template carries, so the three read as one family. */}
      <rect x="8" y="80" width="18" height="2" rx="1" fill={DIM} />
      <rect x="52" y="80" width="12" height="2" rx="1" fill={DIM} />
    </svg>
  );
}

/** The cost of a set in this template, in the units that matter: waits. */
function costLine(spec: TemplateSpec, count: number): string {
  const gens = generationsFor(spec.id, count);
  if (gens === 0) return 'Nothing generated. Instant.';
  if (count === 1) return 'One image generated.';
  return `${gens} of the ${count} slides carry a generated image.`;
}

export function TemplatePicker({
  value,
  onChange,
  count,
  accent,
  disabled,
  /** What choosing a different one costs now that a set exists. Absent before anything is written. */
  costOf,
  /** null inside the look drawer, whose own summary already says "the look". */
  label = 'The look',
}: {
  value: SlideTemplate;
  onChange: (t: SlideTemplate) => void;
  count: number;
  accent: string;
  disabled?: boolean;
  costOf?: (t: SlideTemplate) => 'same' | 'reset' | 'rewrite';
  label?: string | null;
}) {
  return (
    <fieldset className={s.wrap} disabled={disabled}>
      {label ? <legend className={s.legend}>{label}</legend> : null}
      <div className={s.grid}>
        {TEMPLATE_SPECS.map((spec) => {
          const on = spec.id === value;
          const kind = costOf?.(spec.id);
          return (
            <button
              key={spec.id}
              type="button"
              className={`${s.opt} ${on ? s.optOn : ''}`}
              onClick={() => onChange(spec.id)}
              aria-pressed={on}
              disabled={disabled}
            >
              <Thumb id={spec.id} accent={accent} />
              <span className={s.body}>
                <span className={s.name}>{spec.name}</span>
                <span className={s.blurb}>{spec.blurb}</span>
                <span className={s.cost}>{costLine(spec, count)}</span>
                {/* Only ever on the expensive answer: a switch that is free needs no warning. */}
                {kind === 'rewrite' ? (
                  <span className={s.warn}>April writes the set again</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
