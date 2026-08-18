import type { Network } from './channel-schedule';
import type { StoryLane } from './story-store';

/**
 * THE KIT: what one Story produces, per platform.
 *
 * Gate 3 of the Gates shows the operator this as a tick list grouped by channel. Confirming
 * the ticks creates the MASTER pieces (one per master asset below), and Gate 5 later expands
 * each master into per-channel scheduled posts. The maths this file encodes is the one from
 * the build plan: the default ticks make 19 posts, so "2/day across LinkedIn, Instagram,
 * TikTok, YouTube = 56 slots a week" means roughly 3 stories a week in flight. We fill the
 * second daily slot by adding stories, never by padding kits.
 *
 * PURE AND CLIENT-SAFE ON PURPOSE, same reasoning as lib/crm/model.ts: the Gate 3 screen
 * needs the catalogue and the tick maths in the browser, and the stores import server-only
 * code. Nothing in here may import storage.
 */

/**
 * The six master assets one Story is cut into. Shoot once, cut many: the shorts master is
 * ONE script with 3 hooks and one body, and the reels, TikToks and YouTube shorts are the
 * same cuts placed on different channels, not three separate shoots.
 */
export type MasterAsset = 'article' | 'texts' | 'shorts' | 'long' | 'carousel' | 'images';

export type KitItem = {
  /** Stable tick id, e.g. 'li_article'. Persisted against the Story, so never renamed. */
  id: string;
  network: Network;
  /** 'Article', '4 posts', '3 reels'. The bold line on the tick. */
  label: string;
  /** The small line under it, e.g. 'the long form, posted whole'. */
  sub: string;
  /** How many scheduled posts this tick creates on that network. */
  count: number;
  /** Which master asset those posts carry. */
  master: MasterAsset;
  defaultOn: boolean;
};

export type MasterPlan = {
  master: MasterAsset;
  kind: 'text' | 'video' | 'image';
  /** What Gate 4's card calls the thing being made, e.g. 'Script, 3 hooks one body'. */
  label: string;
  placements: { network: Network; count: number }[];
};

/**
 * The catalogue, in the order the Gate 3 screen shows it: LinkedIn, Instagram, TikTok,
 * YouTube. Channels for the first target as Marrs decided: "Marrs LinkedIn, Instagram,
 * TikTok, YouTube. Polynize page joins after the hold." No X.
 *
 * YouTube long form defaults OFF because no long edit exists yet: ticking it is a promise
 * Gate 4 cannot keep until the long-form pipeline lands, so the operator opts in per story.
 */
const CATALOGUE: KitItem[] = [
  { id: 'li_article', network: 'linkedin', label: 'Article', sub: 'the long form, posted whole', count: 1, master: 'article', defaultOn: true },
  { id: 'li_posts', network: 'linkedin', label: '4 posts', sub: 'text, one per beat', count: 4, master: 'texts', defaultOn: true },
  { id: 'li_car', network: 'linkedin', label: 'Carousel', sub: 'pdf, 6 prezie frames', count: 1, master: 'carousel', defaultOn: true },
  { id: 'ig_reels', network: 'instagram', label: '3 reels', sub: 'your 3 hooks, one body', count: 3, master: 'shorts', defaultOn: true },
  { id: 'ig_car', network: 'instagram', label: 'Carousel', sub: 'same 6 frames', count: 1, master: 'carousel', defaultOn: true },
  { id: 'ig_img', network: 'instagram', label: '3 images', sub: 'hook lines on prezie stills', count: 3, master: 'images', defaultOn: true },
  { id: 'tt_v', network: 'tiktok', label: '3 videos', sub: 'same cuts as the reels', count: 3, master: 'shorts', defaultOn: true },
  { id: 'yt_s', network: 'youtube', label: '3 shorts', sub: 'same cuts', count: 3, master: 'shorts', defaultOn: true },
  { id: 'yt_l', network: 'youtube', label: 'Long form', sub: 'no long edit exists yet', count: 1, master: 'long', defaultOn: false },
];

/**
 * The tick list for a lane. Identical for both lanes in v1: the polynize lane will later add
 * the Polynize page repost once that channel joins after the hold, which is why the lane is
 * already in the signature rather than bolted on when it starts mattering.
 *
 * Returns fresh copies so a caller mutating a tick for its own UI state cannot corrupt the
 * catalogue for the next caller.
 */
export function kitForLane(lane: StoryLane): KitItem[] {
  void lane;
  return CATALOGUE.map((item) => ({ ...item }));
}

/** Fixed per-master metadata: what Gate 4's card is called, and what kind of work it is. */
const MASTER_META: Record<MasterAsset, { kind: 'text' | 'video' | 'image'; label: string }> = {
  article: { kind: 'text', label: 'The article' },
  texts: { kind: 'text', label: '4 text posts' },
  shorts: { kind: 'video', label: 'Script, 3 hooks one body' },
  long: { kind: 'video', label: 'Long-form script' },
  carousel: { kind: 'image', label: 'Carousel, 6 prezie frames' },
  images: { kind: 'image', label: '3 quote images' },
};

/**
 * Gate 4 shows one card at a time in a deliberate order, video first because it is the long
 * pole. This is the MASTER order underneath that: the fixed sequence plans come back in, so
 * the card flow and the piece list render identically no matter which ticks were flipped.
 */
const MASTER_ORDER: MasterAsset[] = ['article', 'texts', 'shorts', 'long', 'carousel', 'images'];

export function masterKind(m: MasterAsset): 'text' | 'video' | 'image' {
  return MASTER_META[m].kind;
}

/**
 * The masters a set of ticks demands, deduped and in stable order.
 *
 * Three shorts ticks yield ONE shorts master with three placements, not three masters:
 * that is the whole shoot-once-cut-many economy the Kit exists to enforce. Unknown tick ids
 * are ignored rather than thrown on, because ticks are persisted against the Story and a
 * catalogue edit must not brick every story saved before it.
 */
export function piecesForTicks(ticks: string[]): MasterPlan[] {
  // A tick list is a set. Dedupe so a doubled id (a stale UI writing twice) cannot
  // double a placement count.
  const wanted = new Set(ticks);
  const byMaster = new Map<MasterAsset, MasterPlan>();
  // Walk the catalogue, not the ticks, so placement order follows the screen (LinkedIn
  // first, YouTube last) regardless of the order the tick ids arrive in.
  for (const item of CATALOGUE) {
    if (!wanted.has(item.id)) continue;
    let plan = byMaster.get(item.master);
    if (!plan) {
      plan = { master: item.master, kind: MASTER_META[item.master].kind, label: MASTER_META[item.master].label, placements: [] };
      byMaster.set(item.master, plan);
    }
    const existing = plan.placements.find((p) => p.network === item.network);
    if (existing) existing.count += item.count;
    else plan.placements.push({ network: item.network, count: item.count });
  }
  const out: MasterPlan[] = [];
  for (const master of MASTER_ORDER) {
    const plan = byMaster.get(master);
    if (plan) out.push(plan);
  }
  return out;
}

/**
 * Total scheduled posts the ticks produce. The default kit comes to 19, the number the
 * cadence maths in the build plan leans on, so this is the figure the Gate 3 footer shows
 * the operator before they confirm.
 */
export function tickCount(ticks: string[]): number {
  const wanted = new Set(ticks);
  let total = 0;
  for (const item of CATALOGUE) {
    if (wanted.has(item.id)) total += item.count;
  }
  return total;
}
