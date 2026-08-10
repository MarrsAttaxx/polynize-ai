/**
 * Data for the capability matrix, ported from the ATE deck (polynize.io/ate.html).
 *
 * IMPORTANT, and it governs how this may be captioned: the cell VALUES are
 * synthetic. They are generated deterministically from a seed by `cellFor` below,
 * exactly as the deck does, so the picture is stable between renders but no number
 * here came from a real person. Handles are invented too. Nothing in this file is
 * client data, which is the point: it demonstrates the format without publishing
 * anyone's performance.
 *
 * Consequence: never caption this "a real capability map". Call it an example.
 * When a real anonymised export exists, swap `cellFor` for a lookup and the rest
 * of the component keeps working unchanged.
 *
 * Scenarios use the cyber security risk set, which Marrs judged more relatable
 * than the delivery/BA set the deck shipped with. Capability labels are trimmed to
 * fit a ~54px column without breaking mid-word, so a few are shorter than the
 * product's own wording.
 */

/** Capability chip colour family. */
export type CapCat = 'analytic' | 'functional' | 'collaboration';

export type Scenario = {
  tag: string;
  name: string;
  cat: CapCat;
  /** Two rows of up to three capabilities. null leaves an empty cell. */
  caps: [Array<string | null>, Array<string | null>];
};

export type MatrixUser = {
  /** Synthetic handle. Not a real person. */
  h: string;
  /** Overall uplift, drives the bar under the handle. */
  up: number;
};

export const MATRIX_SCENARIOS: Scenario[] = [
  {
    tag: 'Scenario 1',
    name: 'Spotting a cyber attack',
    cat: 'analytic',
    caps: [
      ['Threat Evaluation', 'Incident Deduction', 'Focused Response'],
      ['Detection Accuracy', 'Log Perception', null],
    ],
  },
  {
    tag: 'Scenario 2',
    name: 'Vulnerability analysis brief',
    cat: 'functional',
    caps: [
      ['Priority Recall', 'Briefing Clarity', 'Plain Language'],
      ['Criticality', 'Risk Synthesis', null],
    ],
  },
  {
    tag: 'Scenario 3',
    name: 'Communicating risk to leadership',
    cat: 'collaboration',
    caps: [
      ['Executive Clarity', 'Business Impact', 'Reading the Room'],
      ['Risk Persuasion', 'Concise Risk Summary', null],
    ],
  },
  {
    tag: 'Scenario 4',
    name: 'Selecting cyber controls',
    cat: 'analytic',
    caps: [
      ['Framework Recall', 'Control Evaluation', 'Analytical Deduction'],
      ['Integrated Rationale', 'Open Evaluation', null],
    ],
  },
  {
    tag: 'Scenario 5',
    name: 'Incident report escalation',
    cat: 'functional',
    caps: [
      ['Standards Recall', 'Board Report Clarity', 'Board Structure'],
      ['Incident Detail', 'Open Board Reporting', null],
    ],
  },
];

export const MATRIX_USERS: MatrixUser[] = [
  { h: '@chen_l', up: 48 },
  { h: '@osei_m', up: 42 },
  { h: '@rivera_j', up: 39 },
  { h: '@park_d', up: 37 },
  { h: '@haddad_r', up: 35 },
  { h: '@novak_s', up: 33 },
  { h: '@tanaka_y', up: 31 },
  { h: '@okafor_b', up: 29 },
];

export const COHORT_SUMMARY = '44 users · Completed 29 / 44';

/** Cell is either a score ('sc') or an uplift percentage ('up'). */
export type Cell = { t: 'sc' | 'up'; v: number };

/**
 * Deterministic pseudo-data, ported verbatim in spirit from the deck's mxCell.
 * Same inputs always give the same cell, so the matrix does not shimmer between
 * renders and server and client markup agree.
 */
export function cellFor(u: number, j: number, rw: number, c: number): Cell {
  const seed = u * 37 + j * 19 + rw * 11 + c * 7;
  if ((u + j) % 3 === 0) {
    return { t: 'sc', v: +(55 + (seed % 45) + (seed % 10) / 10).toFixed(1) };
  }
  return { t: 'up', v: 12 + (seed % 85) };
}

/** Five bands, collapsed onto the three brand states for the legend. */
export type Tier = 'g' | 't' | 'a' | 'o' | 'r';

export const upTier = (v: number): Tier => (v >= 70 ? 'g' : v >= 45 ? 't' : v >= 20 ? 'a' : 'o');
export const scTier = (v: number): Tier =>
  v >= 85 ? 'g' : v >= 70 ? 't' : v >= 60 ? 'a' : v >= 50 ? 'o' : 'r';

/** Stable hash, used for the per-cell detail figures. */
export function hashStr(s: string): number {
  let x = 0;
  for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0;
  return x;
}

/** Per-cell detail shown when a cell is opened. All derived, all synthetic. */
export function cellDetail(handle: string, cap: string) {
  const seed = hashStr(handle + '|' + cap);
  const cq = +(38 + (seed % 54) + (seed % 10) / 10).toFixed(1);
  const rank = 1 + (seed % 44);
  const percentile = Math.max(1, Math.round((1 - (rank - 1) / 43) * 100));
  const mins = 6 + (seed % 34);
  const secs = (seed * 7) % 60;
  // Three attempts trending up, so the trajectory reads as uplift over time.
  const a1 = Math.max(12, cq - 18 - (seed % 9));
  const a2 = Math.max(a1 + 2, cq - 8 - (seed % 5));
  return {
    cq,
    rank,
    percentile,
    time: `${mins}m ${String(secs).padStart(2, '0')}s`,
    attempts: [a1, a2, cq].map((n) => +n.toFixed(1)),
  };
}
