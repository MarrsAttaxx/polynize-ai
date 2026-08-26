import { randomUUID } from 'node:crypto';
import { getSheetState, saveSheetState, deleteSheetState } from '@/lib/content/shoot-sheet-store';
import { isStreamId, type StreamId } from './streams';
import {
  isBucketConfigured,
  getObjectText,
  putObjectText,
  deleteObject,
} from '@/lib/agents/bucket';

/**
 * STORIES: the unit that moves through the Gates.
 *
 * Marrs: "one core idea that creates 20 or 30 different types of pieces that go out over
 * a week." That sentence is this type. An Idea is a note; a Narrative is that note committed
 * to a lane and walked through the pipeline (Idea, Article, Kit, Create, Ship), growing
 * an article, a kit tick list, and master pieces as it passes each gate.
 *
 * ONE FILE PER NARRATIVE (`pam/narratives/{id}.json`), not one list file, because a narrative's
 * article is up to 40k characters of markdown: packing every narrative into one blob would
 * make each save a read-merge-write over megabytes, and two narratives being edited at once
 * would clobber each other. Per-narrative files mean the only shared write is the index.
 *
 * Server-side only. Same bucket-or-interim dispatch as idea-store and the rest of the
 * marketing config: real bucket when configured, shoot-sheet rows as the interim shim.
 */

/**
 * THE LANE IS THE STREAM (D45). It was 'marrs' | 'polynize' when the board was one flat list;
 * Marrs then put every stream and creator back on the front page, each with its own board, so
 * the lane widened to all five. It was already declared that lane ids equal stream ids on
 * purpose, so brand voice and Metricool mappings resolve with no translation: this makes that
 * identity literal rather than a coincidence two files have to keep agreeing on.
 *
 * A narrative saved with 'marrs' or 'polynize' is unaffected, because both are still stream ids.
 */
export type NarrativeLane = StreamId;
export type NarrativeGate = 1 | 2 | 3 | 4 | 5 | 'shipped';

export type Narrative = {
  id: string; // uuid
  /**
   * marrs = opinion in his own voice, polynize = educational. Lane ids equal existing
   * stream ids on purpose so brand voice and Metricool mappings resolve with no
   * translation.
   */
  lane: NarrativeLane;
  /** The caught idea, verbatim. Never rewritten by the pipeline. */
  idea: string;
  /** Id in idea-store when the narrative came from the inbox, so the note shows as spent. */
  idea_ref?: string;
  /**
   * Markdown. The long form, drafted at gate 2. Source of truth for everything
   * downstream: the kit, the pieces, the captions all derive from this text.
   */
  article: string;
  gate: NarrativeGate;
  /** Ticked kit item ids, set at gate 3. kit.ts owns the catalogue. */
  kit?: string[];
  /** Master pieces created from the kit at gate 3. */
  piece_ids?: string[];
  /**
   * Coarse lock for Gate 5's plan and ship runs. A ship walks up to 19 sequential
   * Metricool calls and can outlive the browser's fetch, so a retry click used to
   * start a SECOND run over the same drafts and double-publish the wave. A timestamp
   * rather than a boolean so a crashed run self-heals: locks older than two minutes
   * are ignored. The lock write itself is read-merge-write with a millisecond race
   * window, accepted because it replaces a window that was minutes wide.
   */
  wave_lock_at?: string;
  /**
   * THE HERO IMAGE, and it belongs to the NARRATIVE rather than to a piece (D51).
   *
   * Marrs: "we need a 'Hero Image' as an option, so a main hero image gets created that can
   * then set the style for the rest of the images."
   *
   * It sets the look for every image the narrative produces: the carousel slides, the quote
   * card, and the image on each text post. A piece cannot own that, because the look has to
   * outlive any one of them and be the same across all of them.
   *
   * The reference plumbing already existed: the render route passes `referenceUrl` to Soul as
   * `image_reference`, and the slide screen was inferring it from whichever slide happened to be
   * approved first. The hero replaces that guess with a decision.
   */
  hero_url?: string;
  /** The library id, so the hero is attachable to a post like any other image. */
  hero_media_id?: string;
  /** What was asked for, kept so a reroll is one tap rather than a retype. */
  hero_prompt?: string;
  created_at: string; // ISO
  updated_at: string; // ISO
};

/** The row the board renders. Light on purpose: no article, no kit, just position. */
export type NarrativeCard = {
  id: string;
  lane: NarrativeLane;
  headline: string;
  gate: NarrativeGate;
  updated_at: string;
};

/**
 * Ids are only ever minted by randomUUID here, so the key guard can demand a real uuid
 * rather than idea-store's looser slug shape. Anything else in a URL param is not a
 * narrative that exists.
 */
const SAFE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const INDEX_KEY = 'pam/narratives/index.json';

/**
 * THE OLD PATHS (D43). These files were written as `pam/stories/...` before the Story was
 * renamed the Narrative. Reads fall back to them and writes only ever go to the new path, so a
 * narrative saved under the old name opens, and heals permanently the first time it is saved.
 *
 * Frozen. Never point these at anything else, and never write through them.
 */
const LEGACY_INDEX_KEY = 'pam/stories/index.json';
const legacyKeyFor = (id: string) => `pam/stories/${id}.json`;

function keyFor(id: string): string {
  if (!SAFE_ID.test(id)) throw new Error(`[narratives] unsafe narrative id: ${id}`);
  return `pam/narratives/${id}.json`;
}

/**
 * Caps. The idea is a caught note, not an essay; the article is the long form and gets
 * room, but not unbounded room, because every card and gate screen loads the file whole.
 */
const MAX_IDEA_CHARS = 4000;
const MAX_ARTICLE_CHARS = 40000;

export function isNarrativeLane(x: unknown): x is NarrativeLane {
  return isStreamId(x);
}

function isNarrativeGate(x: unknown): x is NarrativeGate {
  return x === 'shipped' || (typeof x === 'number' && Number.isInteger(x) && x >= 1 && x <= 5);
}

/** Board and gate-bar labels, keyed by String(gate). */
export const GATE_LABELS: Record<string, string> = {
  '1': 'Idea',
  '2': 'Article',
  '3': 'Kit',
  '4': 'Create',
  '5': 'Ship',
  shipped: 'Shipped',
};

/**
 * Tolerant, field by field, like idea-store's normalize: a half-written file from an
 * older shape should still load rather than take the board down. The two fields that
 * DO reject the whole narrative are id and lane, because a narrative without a valid id cannot
 * be keyed and a narrative without a lane cannot resolve brand voice or channels: there is
 * nothing safe to do with it downstream.
 */
export function normalizeNarrative(x: unknown): Narrative | null {
  if (!x || typeof x !== 'object') return null;
  const r = x as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id : '';
  if (!SAFE_ID.test(id)) return null;
  if (!isNarrativeLane(r.lane)) return null;
  const kit = Array.isArray(r.kit) ? r.kit.filter((k): k is string => typeof k === 'string') : undefined;
  const piece_ids = Array.isArray(r.piece_ids)
    ? r.piece_ids.filter((p): p is string => typeof p === 'string')
    : undefined;
  return {
    id,
    lane: r.lane,
    idea: typeof r.idea === 'string' ? r.idea.slice(0, MAX_IDEA_CHARS) : '',
    idea_ref: typeof r.idea_ref === 'string' ? r.idea_ref : undefined,
    article: typeof r.article === 'string' ? r.article.slice(0, MAX_ARTICLE_CHARS) : '',
    // A garbled gate falls back to 1, not to rejection: losing board position is
    // recoverable by clicking through the gates; losing the narrative is not.
    gate: isNarrativeGate(r.gate) ? r.gate : 1,
    ...(kit !== undefined ? { kit } : {}),
    ...(piece_ids !== undefined ? { piece_ids } : {}),
    ...(typeof r.wave_lock_at === 'string' ? { wave_lock_at: r.wave_lock_at } : {}),
    // The hero (D51). A url with no media id is a preview that was never blessed, so both
    // have to survive a round trip independently or "made but not saved" becomes "saved".
    ...(typeof r.hero_url === 'string' && r.hero_url ? { hero_url: r.hero_url.slice(0, 2000) } : {}),
    ...(typeof r.hero_media_id === 'string' && r.hero_media_id
      ? { hero_media_id: r.hero_media_id.slice(0, 200) }
      : {}),
    ...(typeof r.hero_prompt === 'string' && r.hero_prompt
      ? { hero_prompt: r.hero_prompt.slice(0, 1200) }
      : {}),
    created_at: typeof r.created_at === 'string' ? r.created_at : '',
    updated_at: typeof r.updated_at === 'string' ? r.updated_at : '',
  };
}

/**
 * The first non-empty line, for a board card. Same idea as ideaHeadline in
 * idea-store.ts: narratives have no title field, so one is derived to look at.
 */
export function narrativeHeadline(text: string, max = 60): string {
  const first = text.trim().split('\n').find((l) => l.trim() !== '')?.trim() ?? '';
  if (first === '') return 'Untitled narrative';
  return first.length <= max ? first : `${first.slice(0, max - 1).trimEnd()}…`;
}

/** The idea names the narrative; the article covers for an idea that was never filled in. */
function cardFor(narrative: Narrative): NarrativeCard {
  return {
    id: narrative.id,
    lane: narrative.lane,
    headline: narrativeHeadline(narrative.idea.trim() !== '' ? narrative.idea : narrative.article),
    gate: narrative.gate,
    updated_at: narrative.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Storage. Narrative files are truth; the index is a convenience for the board.
// ---------------------------------------------------------------------------

async function readNarrativeFile(id: string): Promise<Narrative | null> {
  const key = keyFor(id);
  if (isBucketConfigured()) {
    // New path first, then the pre-rename one. Only a genuine miss on both is null.
    const text = (await getObjectText(key)) ?? (await getObjectText(legacyKeyFor(id)));
    if (text === null || text === undefined) return null;
    return normalizeNarrative(JSON.parse(text) as unknown);
  }
  const row = (await getSheetState(key)) as { narrative?: unknown; story?: unknown } | null;
  const legacy = row ? null : ((await getSheetState(legacyKeyFor(id))) as {
    narrative?: unknown;
    story?: unknown;
  } | null);
  const src = row ?? legacy;
  // The interim shim wrapped the file in { story } before the rename and { narrative } after.
  return normalizeNarrative(src?.narrative ?? src?.story);
}

async function writeNarrativeFile(narrative: Narrative): Promise<void> {
  const key = keyFor(narrative.id);
  if (isBucketConfigured()) {
    await putObjectText(key, JSON.stringify(narrative, null, 2));
  } else {
    await saveSheetState(key, { narrative });
  }
}

async function deleteNarrativeFile(id: string): Promise<void> {
  // BOTH paths. Deleting only the new one would let the pre-rename file resurrect the narrative
  // on the next read, which is the whole point of the fallback and its one sharp edge.
  for (const key of [keyFor(id), legacyKeyFor(id)]) {
    try {
      if (isBucketConfigured()) await deleteObject(key);
      else await deleteSheetState(key);
    } catch (err) {
      console.error(`[narratives] delete failed for ${key}:`, err);
    }
  }
}

/** Tolerant row filter for the index: a bad row is dropped, never the whole board. */
function normalizeCards(x: unknown): NarrativeCard[] {
  if (!Array.isArray(x)) return [];
  const out: NarrativeCard[] = [];
  for (const raw of x) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const id = typeof r.id === 'string' ? r.id : '';
    if (!SAFE_ID.test(id)) continue;
    if (!isNarrativeLane(r.lane)) continue;
    out.push({
      id,
      lane: r.lane,
      headline: typeof r.headline === 'string' ? r.headline : 'Untitled narrative',
      gate: isNarrativeGate(r.gate) ? r.gate : 1,
      updated_at: typeof r.updated_at === 'string' ? r.updated_at : '',
    });
  }
  return out;
}

async function readIndex(): Promise<NarrativeCard[]> {
  try {
    if (isBucketConfigured()) {
      const raw =
        (await getObjectText(INDEX_KEY)) ?? (await getObjectText(LEGACY_INDEX_KEY)) ?? '[]';
      return normalizeCards(JSON.parse(raw || '[]') as unknown);
    }
    const s = ((await getSheetState(INDEX_KEY)) ??
      (await getSheetState(LEGACY_INDEX_KEY))) as { cards?: unknown } | null;
    return normalizeCards(s?.cards);
  } catch (err) {
    // The index is derived data. A broken index means an empty board, not a broken
    // console, and the rebuild path below heals it.
    console.error('[narratives] index read failed:', err);
    return [];
  }
}

async function writeIndex(cards: NarrativeCard[]): Promise<void> {
  const clean = normalizeCards(cards);
  if (isBucketConfigured()) {
    await putObjectText(INDEX_KEY, JSON.stringify(clean, null, 2));
  } else {
    await saveSheetState(INDEX_KEY, { cards: clean });
  }
}

/**
 * REBUILD NOTE: the index carries no state of its own, every row is derived from its
 * narrative file by cardFor(). If the index is ever wrong (a crash between the two writes,
 * a manual edit), deleting pam/narratives/index.json and re-saving each narrative through
 * saveNarrative() heals it completely.
 */
async function upsertIndexRow(narrative: Narrative): Promise<void> {
  const cards = await readIndex();
  const row = cardFor(narrative);
  const i = cards.findIndex((c) => c.id === narrative.id);
  if (i === -1) cards.push(row);
  else cards[i] = row;
  await writeIndex(cards);
}

async function removeIndexRow(id: string): Promise<void> {
  const cards = await readIndex();
  await writeIndex(cards.filter((c) => c.id !== id));
}

// ---------------------------------------------------------------------------
// The public surface the gate screens use.
// ---------------------------------------------------------------------------

/** A new narrative at gate 1: the idea is caught, nothing downstream exists yet. */
export async function createNarrative(
  lane: NarrativeLane,
  idea: string,
  idea_ref?: string
): Promise<Narrative> {
  const now = new Date().toISOString();
  const narrative: Narrative = {
    id: randomUUID(),
    lane,
    idea: idea.slice(0, MAX_IDEA_CHARS),
    ...(idea_ref !== undefined ? { idea_ref } : {}),
    article: '',
    gate: 1,
    created_at: now,
    updated_at: now,
  };
  await writeNarrativeFile(narrative);
  await upsertIndexRow(narrative);
  return narrative;
}

/**
 * Null for an unknown id, a malformed id, or a read failure. Route params come
 * straight off the URL, so a malformed id is a not-found, never a 500; and a
 * transient read failure must not take the gate screen down with a throw.
 */
export async function getNarrative(id: string): Promise<Narrative | null> {
  if (!SAFE_ID.test(id)) return null;
  try {
    return await readNarrativeFile(id);
  } catch (err) {
    console.error(`[narratives] read failed for ${id}:`, err);
    return null;
  }
}

/**
 * Persist the whole narrative and refresh its board row. Whole-narrative saves, not field
 * patches, because every gate screen holds the full narrative anyway; the caps and the
 * id/lane rejection in normalizeNarrative are the guard against a bad caller.
 */
export async function saveNarrative(narrative: Narrative): Promise<Narrative> {
  const clean = normalizeNarrative(narrative);
  if (!clean) throw new Error('[narratives] refusing to save a narrative with an invalid id or lane');
  const next: Narrative = { ...clean, updated_at: new Date().toISOString() };
  await writeNarrativeFile(next);
  await upsertIndexRow(next);
  return next;
}

/** Every narrative's board row, newest updated first. [] on any failure: see readIndex. */
export async function listNarrativeCards(lane?: NarrativeLane): Promise<NarrativeCard[]> {
  const all = (await readIndex()).sort((a, b) =>
    String(b.updated_at).localeCompare(String(a.updated_at))
  );
  return lane ? all.filter((c) => c.lane === lane) : all;
}

/**
 * How many narratives each stream has in flight and how many have shipped, for the front page
 * (D45). One index read for every card: the alternative was a read per stream, which is five
 * round trips to render five numbers.
 */
export async function narrativeCountsByLane(): Promise<
  Map<string, { live: number; shipped: number }>
> {
  const out = new Map<string, { live: number; shipped: number }>();
  for (const c of await readIndex()) {
    const row = out.get(c.lane) ?? { live: 0, shipped: 0 };
    if (c.gate === 'shipped') row.shipped += 1;
    else row.live += 1;
    out.set(c.lane, row);
  }
  return out;
}

/**
 * File first, index second: if the file delete throws, the index still points at a
 * narrative that exists. The reverse order would leave a live file invisible to the board.
 * A malformed id is a no-op for the same reason getNarrative returns null for one.
 */
export async function deleteNarrative(id: string): Promise<void> {
  if (!SAFE_ID.test(id)) return;
  await deleteNarrativeFile(id);
  await removeIndexRow(id);
}
