import { randomUUID } from 'node:crypto';
import { getSheetState, saveSheetState, deleteSheetState } from '@/lib/content/shoot-sheet-store';
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
 * a week." That sentence is this type. An Idea is a note; a Story is that note committed
 * to a lane and walked through the pipeline (Idea, Article, Kit, Create, Ship), growing
 * an article, a kit tick list, and master pieces as it passes each gate.
 *
 * ONE FILE PER STORY (`pam/stories/{id}.json`), not one list file, because a story's
 * article is up to 40k characters of markdown: packing every story into one blob would
 * make each save a read-merge-write over megabytes, and two stories being edited at once
 * would clobber each other. Per-story files mean the only shared write is the index.
 *
 * Server-side only. Same bucket-or-interim dispatch as idea-store and the rest of the
 * marketing config: real bucket when configured, shoot-sheet rows as the interim shim.
 */

export type StoryLane = 'marrs' | 'polynize';
export type StoryGate = 1 | 2 | 3 | 4 | 5 | 'shipped';

export type Story = {
  id: string; // uuid
  /**
   * marrs = opinion in his own voice, polynize = educational. Lane ids equal existing
   * stream ids on purpose so brand voice and Metricool mappings resolve with no
   * translation.
   */
  lane: StoryLane;
  /** The caught idea, verbatim. Never rewritten by the pipeline. */
  idea: string;
  /** Id in idea-store when the story came from the inbox, so the note shows as spent. */
  idea_ref?: string;
  /**
   * Markdown. The long form, drafted at gate 2. Source of truth for everything
   * downstream: the kit, the pieces, the captions all derive from this text.
   */
  article: string;
  gate: StoryGate;
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
  created_at: string; // ISO
  updated_at: string; // ISO
};

/** The row the board renders. Light on purpose: no article, no kit, just position. */
export type StoryCard = {
  id: string;
  lane: StoryLane;
  headline: string;
  gate: StoryGate;
  updated_at: string;
};

/**
 * Ids are only ever minted by randomUUID here, so the key guard can demand a real uuid
 * rather than idea-store's looser slug shape. Anything else in a URL param is not a
 * story that exists.
 */
const SAFE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const INDEX_KEY = 'pam/stories/index.json';

function keyFor(id: string): string {
  if (!SAFE_ID.test(id)) throw new Error(`[stories] unsafe story id: ${id}`);
  return `pam/stories/${id}.json`;
}

/**
 * Caps. The idea is a caught note, not an essay; the article is the long form and gets
 * room, but not unbounded room, because every card and gate screen loads the file whole.
 */
const MAX_IDEA_CHARS = 4000;
const MAX_ARTICLE_CHARS = 40000;

const LANES: StoryLane[] = ['marrs', 'polynize'];

export function isStoryLane(x: unknown): x is StoryLane {
  return typeof x === 'string' && (LANES as string[]).includes(x);
}

function isStoryGate(x: unknown): x is StoryGate {
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
 * DO reject the whole story are id and lane, because a story without a valid id cannot
 * be keyed and a story without a lane cannot resolve brand voice or channels: there is
 * nothing safe to do with it downstream.
 */
export function normalizeStory(x: unknown): Story | null {
  if (!x || typeof x !== 'object') return null;
  const r = x as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id : '';
  if (!SAFE_ID.test(id)) return null;
  if (!isStoryLane(r.lane)) return null;
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
    // recoverable by clicking through the gates; losing the story is not.
    gate: isStoryGate(r.gate) ? r.gate : 1,
    ...(kit !== undefined ? { kit } : {}),
    ...(piece_ids !== undefined ? { piece_ids } : {}),
    ...(typeof r.wave_lock_at === 'string' ? { wave_lock_at: r.wave_lock_at } : {}),
    created_at: typeof r.created_at === 'string' ? r.created_at : '',
    updated_at: typeof r.updated_at === 'string' ? r.updated_at : '',
  };
}

/**
 * The first non-empty line, for a board card. Same idea as ideaHeadline in
 * idea-store.ts: stories have no title field, so one is derived to look at.
 */
export function storyHeadline(text: string, max = 60): string {
  const first = text.trim().split('\n').find((l) => l.trim() !== '')?.trim() ?? '';
  if (first === '') return 'Untitled story';
  return first.length <= max ? first : `${first.slice(0, max - 1).trimEnd()}…`;
}

/** The idea names the story; the article covers for an idea that was never filled in. */
function cardFor(story: Story): StoryCard {
  return {
    id: story.id,
    lane: story.lane,
    headline: storyHeadline(story.idea.trim() !== '' ? story.idea : story.article),
    gate: story.gate,
    updated_at: story.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Storage. Story files are truth; the index is a convenience for the board.
// ---------------------------------------------------------------------------

async function readStoryFile(id: string): Promise<Story | null> {
  const key = keyFor(id);
  if (isBucketConfigured()) {
    const text = await getObjectText(key);
    if (text === null) return null;
    return normalizeStory(JSON.parse(text) as unknown);
  }
  const s = (await getSheetState(key)) as { story?: unknown } | null;
  return normalizeStory(s?.story);
}

async function writeStoryFile(story: Story): Promise<void> {
  const key = keyFor(story.id);
  if (isBucketConfigured()) {
    await putObjectText(key, JSON.stringify(story, null, 2));
  } else {
    await saveSheetState(key, { story });
  }
}

async function deleteStoryFile(id: string): Promise<void> {
  const key = keyFor(id);
  if (isBucketConfigured()) {
    await deleteObject(key);
  } else {
    await deleteSheetState(key);
  }
}

/** Tolerant row filter for the index: a bad row is dropped, never the whole board. */
function normalizeCards(x: unknown): StoryCard[] {
  if (!Array.isArray(x)) return [];
  const out: StoryCard[] = [];
  for (const raw of x) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const id = typeof r.id === 'string' ? r.id : '';
    if (!SAFE_ID.test(id)) continue;
    if (!isStoryLane(r.lane)) continue;
    out.push({
      id,
      lane: r.lane,
      headline: typeof r.headline === 'string' ? r.headline : 'Untitled story',
      gate: isStoryGate(r.gate) ? r.gate : 1,
      updated_at: typeof r.updated_at === 'string' ? r.updated_at : '',
    });
  }
  return out;
}

async function readIndex(): Promise<StoryCard[]> {
  try {
    if (isBucketConfigured()) {
      return normalizeCards(JSON.parse((await getObjectText(INDEX_KEY)) || '[]') as unknown);
    }
    const s = (await getSheetState(INDEX_KEY)) as { cards?: unknown } | null;
    return normalizeCards(s?.cards);
  } catch (err) {
    // The index is derived data. A broken index means an empty board, not a broken
    // console, and the rebuild path below heals it.
    console.error('[stories] index read failed:', err);
    return [];
  }
}

async function writeIndex(cards: StoryCard[]): Promise<void> {
  const clean = normalizeCards(cards);
  if (isBucketConfigured()) {
    await putObjectText(INDEX_KEY, JSON.stringify(clean, null, 2));
  } else {
    await saveSheetState(INDEX_KEY, { cards: clean });
  }
}

/**
 * REBUILD NOTE: the index carries no state of its own, every row is derived from its
 * story file by cardFor(). If the index is ever wrong (a crash between the two writes,
 * a manual edit), deleting pam/stories/index.json and re-saving each story through
 * saveStory() heals it completely.
 */
async function upsertIndexRow(story: Story): Promise<void> {
  const cards = await readIndex();
  const row = cardFor(story);
  const i = cards.findIndex((c) => c.id === story.id);
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

/** A new story at gate 1: the idea is caught, nothing downstream exists yet. */
export async function createStory(
  lane: StoryLane,
  idea: string,
  idea_ref?: string
): Promise<Story> {
  const now = new Date().toISOString();
  const story: Story = {
    id: randomUUID(),
    lane,
    idea: idea.slice(0, MAX_IDEA_CHARS),
    ...(idea_ref !== undefined ? { idea_ref } : {}),
    article: '',
    gate: 1,
    created_at: now,
    updated_at: now,
  };
  await writeStoryFile(story);
  await upsertIndexRow(story);
  return story;
}

/**
 * Null for an unknown id, a malformed id, or a read failure. Route params come
 * straight off the URL, so a malformed id is a not-found, never a 500; and a
 * transient read failure must not take the gate screen down with a throw.
 */
export async function getStory(id: string): Promise<Story | null> {
  if (!SAFE_ID.test(id)) return null;
  try {
    return await readStoryFile(id);
  } catch (err) {
    console.error(`[stories] read failed for ${id}:`, err);
    return null;
  }
}

/**
 * Persist the whole story and refresh its board row. Whole-story saves, not field
 * patches, because every gate screen holds the full story anyway; the caps and the
 * id/lane rejection in normalizeStory are the guard against a bad caller.
 */
export async function saveStory(story: Story): Promise<Story> {
  const clean = normalizeStory(story);
  if (!clean) throw new Error('[stories] refusing to save a story with an invalid id or lane');
  const next: Story = { ...clean, updated_at: new Date().toISOString() };
  await writeStoryFile(next);
  await upsertIndexRow(next);
  return next;
}

/** Every story's board row, newest updated first. [] on any failure: see readIndex. */
export async function listStoryCards(): Promise<StoryCard[]> {
  return (await readIndex()).sort((a, b) =>
    String(b.updated_at).localeCompare(String(a.updated_at))
  );
}

/**
 * File first, index second: if the file delete throws, the index still points at a
 * story that exists. The reverse order would leave a live file invisible to the board.
 * A malformed id is a no-op for the same reason getStory returns null for one.
 */
export async function deleteStory(id: string): Promise<void> {
  if (!SAFE_ID.test(id)) return;
  await deleteStoryFile(id);
  await removeIndexRow(id);
}
