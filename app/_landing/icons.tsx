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
/**
 * `model` | `measure` | `matrix` are the three phases of the engagement as it actually
 * runs. The older five (discovery, agreement, setup, session, handover) describe an
 * earlier shape of the process and are kept because nothing forces a page to use the
 * new set, and a union member costs nothing.
 */
export type StageIcon =
  | 'discovery'
  | 'agreement'
  | 'setup'
  | 'session'
  | 'handover'
  | 'model'
  | 'measure'
  | 'matrix';

export function StageGlyph({ kind }: { kind: StageIcon }) {
  // A solid built from your material: a cube drawn in isometric, with its three visible
  // edges meeting at the centre. Something assembled rather than found.
  if (kind === 'model') {
    return (
      <svg {...props} aria-hidden="true">
        <path d="M14 3 23 8v10l-9 5-9-5V8z" />
        <path d="M14 13 23 8M14 13v10M14 13 5 8" />
      </svg>
    );
  }
  // A gauge with its needle short of full: capability read against a benchmark, which is
  // the whole of what this phase does.
  if (kind === 'measure') {
    return (
      <svg {...props} aria-hidden="true">
        <path d="M4.5 21a9.5 9.5 0 1 1 19 0" />
        <path d="M14 21 19.5 12.5" />
        <path d="M8 21v-1.5M14 12.5V11M20 21v-1.5" />
      </svg>
    );
  }
  // The artefact itself: a grid with one cell filled.
  if (kind === 'matrix') {
    return (
      <svg {...props} aria-hidden="true">
        <path d="M4 5h20v18H4zM4 11h20M4 17h20M10.7 5v18M17.3 5v18" />
        <path d="M10.7 11h6.6v6h-6.6z" fill="currentColor" stroke="none" opacity="0.5" />
      </svg>
    );
  }
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

/**
 * The GitHub mark, for the Proof section.
 *
 * The standing rule is that the technology company is never NAMED in copy, and it is
 * not: the mark carries it instead, at 26px and in muted text colour rather than
 * GitHub's own black, so it reads as an attribution and not as an endorsement or a
 * partner badge. Asset supplied by Marrs, 10 Aug 2026.
 */
export function GitHubMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 0C3.58 0 0 3.58 0 8C0 11.54 2.29 14.53 5.47 15.59C5.87 15.66 6.02 15.42 6.02 15.21C6.02 15.02 6.01 14.39 6.01 13.72C4 14.09 3.48 13.23 3.32 12.78C3.23 12.55 2.84 11.84 2.5 11.65C2.22 11.5 1.82 11.13 2.49 11.12C3.12 11.11 3.57 11.7 3.72 11.94C4.44 13.15 5.59 12.81 6.05 12.6C6.12 12.08 6.33 11.73 6.56 11.53C4.78 11.33 2.92 10.64 2.92 7.58C2.92 6.71 3.23 5.99 3.74 5.43C3.66 5.23 3.38 4.41 3.82 3.31C3.82 3.31 4.49 3.1 6.02 4.13C6.66 3.95 7.34 3.86 8.02 3.86C8.7 3.86 9.38 3.95 10.02 4.13C11.55 3.09 12.22 3.31 12.22 3.31C12.66 4.41 12.38 5.23 12.3 5.43C12.81 5.99 13.12 6.7 13.12 7.58C13.12 10.65 11.25 11.33 9.47 11.53C9.76 11.78 10.01 12.26 10.01 13.01C10.01 14.08 10 14.94 10 15.21C10 15.42 10.15 15.67 10.55 15.59C13.71 14.53 16 11.53 16 8C16 3.58 12.42 0 8 0Z"
      />
    </svg>
  );
}

/**
 * Marks for the three cards under the capability map. Line art at the same weight as the
 * stage glyphs, so the page reads as one drawing set rather than an assortment.
 */
export type CardIcon =
  // /capability-mapping's three
  | 'source'
  | 'oneTeam'
  | 'human'
  // /mapping's three. Separate marks rather than the same three reused: those cards make
  // different claims, and a mark that does not carry its card's argument is decoration.
  | 'realWork'
  | 'triad'
  | 'cold';

export function CardGlyph({ kind }: { kind: CardIcon }) {
  const props = {
    width: 26,
    height: 26,
    viewBox: '0 0 28 28',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (kind === 'source') {
    // A stack of documents feeding in: everything the map says traces back to something
    // you handed over.
    return (
      <svg {...props} aria-hidden="true">
        <path d="M7 3.5h9l4 4v13H7z" />
        <path d="M16 3.5V8h4" />
        <path d="M10.5 12.5h6M10.5 16h4" />
        <path d="M4 8v16.5h13" />
      </svg>
    );
  }
  if (kind === 'oneTeam') {
    // One group picked out of several: mapped properly, then the method runs again.
    return (
      <svg {...props} aria-hidden="true">
        <path d="M3.5 4.5h9v9h-9z" />
        <path d="M17 6.5h8M17 10.5h8" opacity="0.55" />
        <path d="M17 18.5h8M17 22.5h8" opacity="0.55" />
        <path d="M3.5 17.5h9v9h-9z" opacity="0.4" />
        <path d="M5.5 9 7.5 11l3.5-4" />
      </svg>
    );
  }
  if (kind === 'realWork') {
    // A working week with one day live: scenarios drawn from what the team does every
    // week, not from a description of it.
    return (
      <svg {...props} aria-hidden="true">
        <path d="M4 6.5h20v17H4zM4 12h20M9 3.5v5M19 3.5v5" />
        <path d="M9.5 15.5h4.5v4.5H9.5z" fill="currentColor" stroke="none" opacity="0.5" />
      </svg>
    );
  }
  if (kind === 'triad') {
    // People, work and technology held at once: three nodes, all three joined, because
    // you cannot move one without moving the others.
    return (
      <svg {...props} aria-hidden="true">
        <path d="M14 3.5 23.5 21H4.5z" opacity="0.45" />
        <circle cx="14" cy="4.5" r="2.8" />
        <circle cx="5" cy="22" r="2.8" />
        <circle cx="23" cy="22" r="2.8" />
      </svg>
    );
  }
  if (kind === 'cold') {
    // No preparation and no rehearsal: a closed notebook, struck through.
    return (
      <svg {...props} aria-hidden="true">
        <path d="M6.5 4.5h13a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5h-13z" />
        <path d="M6.5 4.5v19" />
        <path d="M4 24 24 4" />
      </svg>
    );
  }
  // A person with the judgment kept, drawn as a shield rather than a cog.
  return (
    <svg {...props} aria-hidden="true">
      <path d="M11 9.5a3.6 3.6 0 1 1 7.2 0 3.6 3.6 0 0 1-7.2 0" />
      <path d="M8 24a6.6 6.6 0 0 1 13.2 0" />
      <path d="M4.5 5.5 8 4l3.5 1.5v4A5 5 0 0 1 8 14a5 5 0 0 1-3.5-4.5z" opacity="0.6" />
    </svg>
  );
}
