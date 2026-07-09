/**
 * Metricool brand mapping — team-level config (D24). Metricool splits accounts by
 * brand (Polynize, Marrs Coiro, …) and each of our streams posts under one brand,
 * so we store a stream -> blogId map. This is NOT per-owner and NOT an env var:
 * blogIds are discovered from Metricool and mapped in-console once.
 *
 * Bucket-or-interim dispatch (like the concept store): a JSON object in the bucket
 * when configured, else the interim content_shoot_sheets row under the same key.
 * Server-side only.
 */

import { getSheetState, saveSheetState } from '@/lib/content/shoot-sheet-store';
import { isBucketConfigured, getObjectText, putObjectText } from '@/lib/agents/bucket';
import {
  normalizeStreamSchedule,
  type PostingSchedule,
  type StreamSchedule,
} from './posting-schedule';

/** stream id -> Metricool blogId. */
export type BrandMap = Record<string, string>;

const KEY = 'pam/config/metricool-brand-map.json';
const SCHEDULE_KEY = 'pam/config/posting-schedule.json';

export async function getBrandMap(): Promise<BrandMap> {
  try {
    if (isBucketConfigured()) {
      const text = await getObjectText(KEY);
      if (!text) return {};
      const obj = JSON.parse(text) as unknown;
      return normalize(obj);
    }
    const s = await getSheetState(KEY);
    return normalize((s as { map?: unknown } | null)?.map);
  } catch (e) {
    console.error(`[metricool-config] read failed, treating as empty: ${e instanceof Error ? e.message : String(e)}`);
    return {};
  }
}

export async function saveBrandMap(map: BrandMap): Promise<void> {
  const clean = normalize(map);
  if (isBucketConfigured()) {
    await putObjectText(KEY, JSON.stringify(clean, null, 2));
  } else {
    await saveSheetState(KEY, { map: clean });
  }
}

/** Keep only string->non-empty-string pairs, so a malformed blob can't break callers. */
function normalize(x: unknown): BrandMap {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return {};
  const out: BrandMap = {};
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    if (typeof v === 'string' && v.trim()) out[k] = v;
  }
  return out;
}

// --- Posting schedule (per-stream timezone + ideal time slots) ----------------

function normalizeSchedule(x: unknown): PostingSchedule {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return {};
  const out: PostingSchedule = {};
  for (const [stream, v] of Object.entries(x as Record<string, unknown>)) {
    out[stream] = normalizeStreamSchedule(v);
  }
  return out;
}

export async function getPostingSchedule(): Promise<PostingSchedule> {
  try {
    if (isBucketConfigured()) {
      const text = await getObjectText(SCHEDULE_KEY);
      return text ? normalizeSchedule(JSON.parse(text) as unknown) : {};
    }
    const s = await getSheetState(SCHEDULE_KEY);
    return normalizeSchedule((s as { schedule?: unknown } | null)?.schedule);
  } catch (e) {
    console.error(`[metricool-config] schedule read failed, treating as empty: ${e instanceof Error ? e.message : String(e)}`);
    return {};
  }
}

export async function savePostingSchedule(schedule: PostingSchedule): Promise<void> {
  const clean = normalizeSchedule(schedule);
  if (isBucketConfigured()) {
    await putObjectText(SCHEDULE_KEY, JSON.stringify(clean, null, 2));
  } else {
    await saveSheetState(SCHEDULE_KEY, { schedule: clean });
  }
}

export type { PostingSchedule, StreamSchedule };
