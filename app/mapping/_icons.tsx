/**
 * Line icons for /mapping.
 *
 * Deliberately house-built rather than pulled from an icon package: CLAUDE.md's
 * anti-goals ban "AI slop" decoration and icon libraries, and TACTILE_DESIGN_LANGUAGE.md
 * asks for line icons only. These match the existing HowIcon set in app/page.tsx exactly
 * (28x28, 1.4 stroke, currentColor, round caps, an occasional 15% accent fill) so the
 * two pages read as one system.
 *
 * Kept in ONE file on purpose: a rebrand lands mid-2026, and swapping the glyph set
 * should be a single-file change rather than a hunt through components.
 */

const props = {
  width: 28,
  height: 28,
  viewBox: '0 0 28 28',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** The five stages of how the session runs. */
export type StageIcon = 'discovery' | 'agreement' | 'setup' | 'session' | 'handover';

export function StageGlyph({ kind }: { kind: StageIcon }) {
  if (kind === 'discovery') {
    // Magnifier: working out what is worth mapping.
    return (
      <svg {...props} aria-hidden="true">
        <circle cx="12" cy="12" r="7.5" />
        <path d="M17.6 17.6 24 24" />
      </svg>
    );
  }
  if (kind === 'agreement') {
    // Document with a tick: scope and price confirmed.
    return (
      <svg {...props} aria-hidden="true">
        <path d="M7 3.5h11l3.5 3.5v17.5H7z" />
        <path d="M10.5 12.5h7M10.5 16.5h7" />
        <path d="M17.5 3.5V7H21" />
      </svg>
    );
  }
  if (kind === 'setup') {
    // Stacked layers: the scenarios being built from real work.
    return (
      <svg {...props} aria-hidden="true">
        <path d="M14 4 24 9l-10 5L4 9z" />
        <path d="M4 14.5l10 5 10-5" />
        <path d="M4 20l10 5 10-5" />
      </svg>
    );
  }
  if (kind === 'session') {
    // Cells filling in: the map builds live while the team works.
    return (
      <svg {...props} aria-hidden="true">
        <rect x="3.5" y="6" width="21" height="16" rx="1" />
        <path d="M3.5 13.5h21M10.5 6v16M17.5 6v16" />
        <rect x="10.5" y="6" width="7" height="7.5" fill="currentColor" opacity=".15" stroke="none" />
      </svg>
    );
  }
  // handover: the map and the report walked through on screen.
  return (
    <svg {...props} aria-hidden="true">
      <rect x="3.5" y="4.5" width="21" height="14" rx="1" />
      <path d="M14 18.5v5M9.5 23.5h9" />
      <path d="M9 14l3.5-4 3 2.5L20 8" />
    </svg>
  );
}

/**
 * A folded survey map. Sits beside the word "Map" in the hero and beside "This is the
 * map", so the two moments are visibly the same object: the thing you are promised, and
 * the thing you are handed.
 */
export function MapGlyph({ size = 28 }: { size?: number }) {
  return (
    <svg {...props} width={size} height={size} aria-hidden="true">
      {/* three folded panels */}
      <path d="M2.5 7.5 10 4.5v16L2.5 23.5z" />
      <path d="M10 4.5 18 7.5v16l-8-3z" />
      <path d="M18 7.5 25.5 4.5v16L18 23.5z" />
      {/* a plotted route across the fold */}
      <path d="M6 17.5q3.5-5 7-2t7-4" strokeDasharray="2.4 2.4" />
      <circle cx="20" cy="11.5" r="1.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** The three things every organisation holds separately. */
export type SiloIcon = 'people' | 'process' | 'technology';

export function SiloGlyph({ kind }: { kind: SiloIcon }) {
  if (kind === 'people') {
    return (
      <svg {...props} aria-hidden="true">
        <circle cx="10" cy="9" r="3.4" />
        <circle cx="19.5" cy="10.5" r="2.6" />
        <path d="M4 22c0-3.6 2.7-6 6-6s6 2.4 6 6" />
        <path d="M17.5 16.4c3 .3 5 2.6 5 5.6" />
      </svg>
    );
  }
  if (kind === 'process') {
    // A serpentine flow with a single arrowhead at the end of the run.
    return (
      <svg {...props} aria-hidden="true">
        <path d="M4 7h12a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8h12" />
        <path d="M16.5 19.5 20 23l-3.5 3.5" />
      </svg>
    );
  }
  return (
    <svg {...props} aria-hidden="true">
      <rect x="8" y="8" width="12" height="12" rx="1" />
      <path d="M11.5 4.5V8M16.5 4.5V8M11.5 20v3.5M16.5 20v3.5M4.5 11.5H8M4.5 16.5H8M20 11.5h3.5M20 16.5h3.5" />
    </svg>
  );
}
