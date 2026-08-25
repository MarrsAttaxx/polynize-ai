/**
 * THE STUDIO SHOOT QUEUE.
 *
 * Marrs: "I want a ready-to-record cue somewhere, which may be independent of the brand streams... I can
 * get into the studio, set up the cameras, select one, put the Prezi on the screen, put the text in the
 * teleprompter on the iPad, record it, done, click OK, and go to the next one."
 *
 * Two things follow from that sentence and shape everything here.
 *
 * 1. IT IS CROSS-STREAM. A studio session is one room, not one brand. His Polynize split-screen and his
 *    Marrs piece are shot back to back, so grouping by stream would be exactly the wrong cut. The stream
 *    is still shown on every row, because it tells him which voice he is in.
 * 2. IT IS GROUPED BY FORMAT, BECAUSE FORMAT IS THE RIG. A split-screen short needs the touchscreen and
 *    two cameras; a talking-head short needs neither. So grouping by format groups by SETUP, which is
 *    what "grouped into types" actually means when you are standing in the room: set up once, shoot that
 *    row, tear down.
 *
 * Server-side only.
 */

import { listSavedPieces, type MarketingPiece } from './piece-store';
import { listPreziesForConcept, prezieFilingKey, type Prezie } from './prezie-store';
import { formatById } from './output-plan';

export type ShootRow = {
  piece_id: string;
  title: string;
  stream: string;
  format: string;
  format_label: string;
  /** The performance URL, when this piece has a prezie to put on the touchscreen. */
  prezie_url?: string;
  prezie_name?: string;
  /** True when the format expects a prezie and none was found, which is worth seeing BEFORE the shoot. */
  prezie_missing: boolean;
  teleprompter_url: string;
  /** Roughly how long the read is, from the script, so a session can be judged before setting up. */
  words: number;
  /**
   * The read in SECONDS, at the same 2.7 words per second the clip work estimates with.
   *
   * Seconds and not minutes, because at short-form length minutes cannot say anything: a 96-word read and
   * a 168-word read both round to "about 1 min", which is a number that occupies space and carries none.
   * Seconds tell him whether he is inside the 90-second house limit before he sets the room up.
   */
  seconds: number;
  ready_at?: string;
};

export type ShootGroup = {
  format: string;
  label: string;
  /** True when this group needs the touchscreen rig, so the groups can be ordered by setup cost. */
  needs_screen: boolean;
  rows: ShootRow[];
};

/** Only the spoken lines count towards the read, so the label lines are not mistaken for words. */
function spokenWords(script: string): number {
  const spoken = script
    .split('\n')
    .filter((l) => !/^\s*(ON-SCREEN TEXT|HOOK|BEAT|CTA|CLOSE|SPOKEN)\b/i.test(l.trim()) || /^\s*SPOKEN/i.test(l))
    .join(' ')
    .replace(/^\s*SPOKEN\s*:?/gim, ' ');
  return spoken.split(/\s+/).filter(Boolean).length;
}

/**
 * Every piece queued for the studio, grouped by rig.
 *
 * The prezie lookup is the expensive part (one bounded read per distinct concept), so concepts are
 * de-duplicated first: several pieces commonly share one, and reading it once per piece would make the
 * page slow for no reason. Opening a stream already cost three to four seconds once for exactly that
 * kind of avoidable repetition.
 */
/**
 * THE LOGIC THAT HAS TO BE RIGHT IN THE ROOM, as a pure function.
 *
 * Separated from the fetching so it can be tested without stubbing two stores: ES modules are read-only,
 * so a test that wanted to fake the stores could not, and grouping wrong is the failure that costs a
 * studio setup rather than a page load.
 */
export function groupShootRows(
  pieces: MarketingPiece[],
  preziesByConcept: Map<string, Prezie[]>
): { groups: ShootGroup[]; total: number; with_prezie: number } {
  const ready = pieces.filter((p) => p.shoot_ready && !p.recorded_at);
  if (ready.length === 0) return { groups: [], total: 0, with_prezie: 0 };

  const rows: ShootRow[] = ready.map((p) => {
    // Same bucket the piece screen files into, or the queue's prezie link and its
    // missing-prezie warning both point at another narrative's deck (D47).
    const concept = prezieFilingKey(p);
    const all = preziesByConcept.get(concept) ?? [];
    // The one built for THIS piece wins; otherwise the concept's newest, since prezies are reused across
    // pieces on purpose (D31) and the newest is the one he has been working on.
    const prezie = all.find((z) => z.piece_id === p.piece_id) ?? all[0];
    const fmt = formatById(p.format);
    const isVideo = fmt?.kind === 'video';
    return {
      piece_id: p.piece_id,
      title: p.title,
      stream: p.stream,
      format: p.format,
      format_label: fmt?.label ?? p.format,
      prezie_url: prezie ? `/console/prezie/${prezie.concept}/${prezie.prezie_id}` : undefined,
      prezie_name: prezie?.name,
      // Only a VIDEO format is expected to have one, so a text piece is not flagged as missing something
      // it never needed.
      prezie_missing: isVideo && !prezie,
      teleprompter_url: `/console/marketing/piece/${p.piece_id}/teleprompter`,
      words: spokenWords(p.script ?? ''),
      seconds: Math.round(spokenWords(p.script ?? '') / 2.7),
      ready_at: p.shoot_ready_at,
    };
  });

  const groups = new Map<string, ShootGroup>();
  for (const r of rows) {
    if (!groups.has(r.format)) {
      groups.set(r.format, {
        format: r.format,
        label: r.format_label,
        // Split-screen is the format built around the touchscreen, and a prezie on ANY format means the
        // screen has to be up either way.
        needs_screen: r.format === 'split_screen_short' || Boolean(r.prezie_url),
        rows: [],
      });
    }
    const g = groups.get(r.format)!;
    g.rows.push(r);
    if (r.prezie_url) g.needs_screen = true;
  }

  // Within a group, prezie-bearing first: the screen has to be loaded for those, so doing them together
  // means loading it once.
  for (const g of groups.values()) {
    g.rows.sort((a, b) => Number(Boolean(b.prezie_url)) - Number(Boolean(a.prezie_url)));
  }

  return {
    // Screen-rig groups first, so the heaviest setup is done while the room is fresh.
    groups: [...groups.values()].sort(
      (a, b) => Number(b.needs_screen) - Number(a.needs_screen) || a.label.localeCompare(b.label)
    ),
    total: rows.length,
    with_prezie: rows.filter((r) => r.prezie_url).length,
  };
}

/**
 * Every piece queued for the studio, grouped by rig.
 *
 * The prezie lookup is the expensive part (one bounded read per distinct concept), so concepts are
 * de-duplicated first: several pieces commonly share one, and reading it once per piece would make the
 * page slow for no reason. Opening a stream already cost three to four seconds once for exactly that kind
 * of avoidable repetition.
 */
export async function buildShootQueue(owner: string) {
  let pieces: MarketingPiece[] = [];
  try {
    pieces = await listSavedPieces(owner);
  } catch (err) {
    console.error('[shoot-queue] piece list failed:', err);
    return { groups: [] as ShootGroup[], total: 0, with_prezie: 0 };
  }

  const ready = pieces.filter((p) => p.shoot_ready && !p.recorded_at);
  if (ready.length === 0) return { groups: [] as ShootGroup[], total: 0, with_prezie: 0 };

  // One read per CONCEPT, not per piece.
  const concepts = [...new Set(ready.map((p) => prezieFilingKey(p)))];
  const byConcept = new Map<string, Prezie[]>();
  await Promise.all(
    concepts.map(async (c) => {
      try {
        byConcept.set(c, await listPreziesForConcept(c));
      } catch (err) {
        console.error(`[shoot-queue] prezie list failed for ${c}:`, err);
        byConcept.set(c, []);
      }
    })
  );

  return groupShootRows(pieces, byConcept);
}
