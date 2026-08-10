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
 * Scenarios trace ONE commercial process end to end: research the account, draft the
 * proposal, price the work, pitch it, then turn the win into a campaign. That is
 * deliberate and it is the point of the whole figure. The page argues that AI is
 * ambiguous because nobody can see what their people can actually do with it, so the
 * matrix has to show a process a reader recognises being measured column by column,
 * not five unrelated exercises. It replaced a cyber security set for that reason.
 *
 * Every capability is about the USE of AI in that step, never the step in the
 * abstract. "Source Checking" is whether they verify what the model handed back;
 * "Voice Control" is whether the draft still sounds like the firm. A label that would
 * read the same on a pre-AI competency framework does not belong here.
 *
 * Capability labels are trimmed to fit a ~54px column without breaking mid-word, so a
 * few are shorter than the product's own wording. Keep new ones under about 20
 * characters.
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
    name: 'Researching a new account',
    cat: 'analytic',
    caps: [
      ['Prompt Framing', 'Source Checking', 'Signal vs Noise'],
      ['Brief Synthesis', 'Claim Verification', null],
    ],
  },
  {
    tag: 'Scenario 2',
    name: 'Drafting the proposal',
    cat: 'functional',
    caps: [
      ['Context Loading', 'Draft Direction', 'Voice Control'],
      ['Scope Accuracy', 'Editing Judgment', null],
    ],
  },
  {
    tag: 'Scenario 3',
    name: 'Pricing and scoping the work',
    cat: 'analytic',
    caps: [
      ['Estimate Reasoning', 'Assumption Testing', 'Model Scepticism'],
      ['Risk Framing', 'Numbers Discipline', null],
    ],
  },
  {
    tag: 'Scenario 4',
    name: 'Pitching it to the client',
    cat: 'collaboration',
    caps: [
      ['Objection Handling', 'Live Reframing', 'Reading the Room'],
      ['Evidence Recall', 'Plain Language', null],
    ],
  },
  {
    tag: 'Scenario 5',
    name: 'Turning the win into a campaign',
    cat: 'functional',
    caps: [
      ['Audience Framing', 'Channel Judgment', 'Brand Consistency'],
      ['Message Testing', 'Output Triage', null],
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
