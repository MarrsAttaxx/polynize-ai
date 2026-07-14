/**
 * Per-stream media library (D2 amended 2026-07-14 — supersedes the Lightsail-media
 * plan). A media asset is a REFERENCE to a file hosted elsewhere (a Box.com live
 * link, or any public direct-download URL) plus light metadata. The console never
 * handles the bytes: the host (Box) stores and serves the file, and Metricool
 * fetches it by URL at publish time. So an asset is small JSON and rides the same
 * bucket-or-interim dispatch as templates/brand-voice, keyed per-stream at
 * `pam/media-library/{stream}/{mediaId}.json`.
 *
 * Server-side only.
 */

import {
  getSheetState,
  saveSheetState,
  deleteSheetState,
} from '@/lib/content/shoot-sheet-store';
import { supabaseService } from '@/lib/supabase';
import {
  isBucketConfigured,
  getObjectText,
  putObjectText,
  deleteObject,
  listKeys,
} from '@/lib/agents/bucket';

export type MediaKind = 'image' | 'video';
export type MediaSource = 'box' | 'url';

export type MediaAsset = {
  /** uuid; also the storage key tail. */
  media_id: string;
  /** The stream (brand bucket) this asset belongs to. */
  stream: string;
  /** Who added it (D4: owner on every row, even for a per-stream asset). */
  owner: string;
  /** The public, direct-download URL Metricool can fetch (e.g. a Box live link). */
  url: string;
  kind: MediaKind;
  /** Human label (a filename or short description). */
  label: string;
  /** Where the file lives: a Box live link, or a generic public URL. */
  source: MediaSource;
  created_at: string;
  updated_at?: string;
};

const PREFIX = 'pam/media-library';

export function mediaKey(stream: string, id: string): string {
  return `${PREFIX}/${stream}/${id}.json`;
}

export function isValidMediaAsset(x: unknown): x is MediaAsset {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const m = x as Record<string, unknown>;
  const str = (v: unknown) => typeof v === 'string' && v.length > 0;
  return (
    str(m.media_id) &&
    str(m.stream) &&
    str(m.owner) &&
    str(m.url) &&
    (m.kind === 'image' || m.kind === 'video') &&
    typeof m.label === 'string'
  );
}

async function readAt(key: string): Promise<MediaAsset | null> {
  if (isBucketConfigured()) {
    const text = await getObjectText(key);
    if (!text) return null;
    try {
      const obj = JSON.parse(text) as unknown;
      return isValidMediaAsset(obj) ? obj : null;
    } catch {
      return null;
    }
  }
  const s = await getSheetState(key);
  return isValidMediaAsset(s) ? s : null;
}

export async function getMediaAsset(
  stream: string,
  id: string
): Promise<MediaAsset | null> {
  return readAt(mediaKey(stream, id));
}

export async function saveMediaAsset(asset: MediaAsset): Promise<void> {
  const key = mediaKey(asset.stream, asset.media_id);
  if (isBucketConfigured()) {
    await putObjectText(key, JSON.stringify(asset, null, 2));
  } else {
    await saveSheetState(key, asset);
  }
}

export async function deleteMediaAsset(stream: string, id: string): Promise<void> {
  const key = mediaKey(stream, id);
  if (isBucketConfigured()) {
    await deleteObject(key);
  } else {
    await deleteSheetState(key);
  }
}

/** List a stream's media assets, newest first. Malformed rows are dropped. */
export async function listMediaForStream(stream: string): Promise<MediaAsset[]> {
  const prefix = `${PREFIX}/${stream}/`;
  let docs: MediaAsset[] = [];
  if (isBucketConfigured()) {
    const keys = (await listKeys(prefix)).filter((k) => k.endsWith('.json'));
    for (const k of keys) {
      const m = await readAt(k);
      if (m) docs.push(m);
    }
  } else {
    const { data, error } = await supabaseService()
      .from('content_shoot_sheets')
      .select('episode_id, state')
      .like('episode_id', `${PREFIX}/%`);
    if (error) throw new Error(`media list failed: ${error.message}`);
    docs = (data ?? [])
      .filter((r) => {
        const id = (r as { episode_id?: unknown }).episode_id;
        return typeof id === 'string' && id.startsWith(prefix);
      })
      .map((r) => (r as { state: unknown }).state)
      .filter(isValidMediaAsset);
  }
  return docs.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
}

/**
 * Resolve a piece/entry's attached media ids to their public URLs for a stream,
 * dropping any that no longer exist. Called at publish time so Metricool always
 * receives the current URL (and never a dangling reference to a deleted asset).
 */
export async function resolveMediaUrls(
  stream: string,
  ids: string[]
): Promise<string[]> {
  const urls: string[] = [];
  for (const id of ids) {
    const asset = await getMediaAsset(stream, id);
    if (asset) urls.push(asset.url);
  }
  return urls;
}

/** Detect image vs video from a URL's file extension; null if unknown. */
export function kindFromUrl(url: string): MediaKind | null {
  const clean = url.split('?')[0].split('#')[0].toLowerCase();
  if (/\.(mp4|mov|m4v|webm|avi|mkv)$/.test(clean)) return 'video';
  if (/\.(jpe?g|png|gif|webp|bmp|tiff?)$/.test(clean)) return 'image';
  return null;
}
