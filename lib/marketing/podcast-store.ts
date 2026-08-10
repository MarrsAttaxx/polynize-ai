/**
 * PODCAST EPISODES and their CLIP PROPOSALS.
 *
 * The second video series in the production model: a released long-form episode is mined for short
 * vertical clips. The method and its editorial rules are in
 * `docs/pam-console/podcast-clip-extraction.md`, validated on a real 54-minute episode.
 *
 * THE ONE IDEA THIS FILE EXISTS TO ENCODE. A podcast clip is not a slice of the episode, it is a
 * THEME CONDENSED: the strongest line moved to the front, everything that does not serve that one
 * idea cut away. So a clip is stored as an ordered EDL of spans, not as a start and an end. Any
 * shape with `from` and `to` on it would make the format impossible to express, which is the same
 * mistake the prezie scene shape made (D33) and worth not repeating.
 *
 * WHY AN EPISODE IS NOT A CONCEPT. Concepts are ideas the business argues; an episode is SOURCE
 * MATERIAL, already recorded and released. It has a transcript, a Descript project and a set of
 * candidate clips, none of which a concept has. But an APPROVED clip becomes an ordinary marketing
 * piece, so everything downstream (calendar, Metricool, publishing) is the path that already works
 * rather than a second one built alongside it.
 *
 * Keyed `pam/podcast/{owner}/{episode_id}.json`. Server-side only.
 */

import { getSheetState, saveSheetState, deleteSheetState } from '@/lib/content/shoot-sheet-store';
import {
  isBucketConfigured,
  getObjectText,
  putObjectText,
  deleteObject,
  listKeys,
} from '@/lib/agents/bucket';
import { supabaseService } from '@/lib/supabase';

/** One span to keep, anchored to where it sits in the source transcript. */
export type ClipSpan = {
  /** The paragraph anchor from the transcript, `HH:MM:SS`. How Descript finds it. */
  at: string;
  /** The speaker's words, verbatim (D22: selected and ordered, never paraphrased). */
  text: string;
  /** What was dropped around this span, and why. Operator context, not an instruction. */
  cut_note?: string;
};

/**
 * A clip's life: proposed by April, ruled on by Marrs, cut by Descript, then published as a piece.
 *
 * `assembling` is a real state rather than a spinner because a Descript agent job outlives the
 * request that started it, so the job id has to be persisted or a page reload loses the clip.
 */
export type ClipStatus = 'proposed' | 'approved' | 'rejected' | 'assembling' | 'assembled';

export type ClipProposal = {
  clip_id: string;
  /** April's ranking, strongest first. Kept even after reordering so her judgment is legible. */
  rank: number;
  title: string;
  /** The single idea, in a phrase. */
  theme: string;
  why_strong: string;
  /** The first line of the clip, wherever it sat in the episode. */
  hook: ClipSpan;
  /** The ordered cut, hook first. This IS the clip. */
  edl: ClipSpan[];
  est_duration_seconds: number;
  cuts_made?: string;
  platforms?: string[];
  status: ClipStatus;
  /** Marrs's own words when he changed something, so a re-cut knows what he wanted. */
  operator_note?: string;
  /** The Descript agent job, while it runs and after it finishes. */
  job_id?: string;
  descript_composition_id?: string;
  descript_url?: string;
  assembly_error?: string;
  /**
   * TRUE when the cut exists but is not publishable yet, because a landscape source needs Descript's
   * speaker-tracking reframe and that is a manual toggle rather than something automation can apply.
   *
   * A flag rather than nothing, because the failure this guards against is not the manual step, it is
   * a clip that looks finished, gets published, and has a speaker cropped out of frame.
   */
  needs_reframe?: boolean;
  /** What the agent REPORTED the source to be. Never assumed: he once misremembered it himself. */
  source_aspect?: '9:16' | '16:9' | 'unknown';
  /** The marketing piece this clip became, once it entered the publishing pipeline. */
  piece_id?: string;
  created_at: string;
  updated_at?: string;
};

export type PodcastEpisode = {
  episode_id: string;
  owner: string;
  /** Whose stream the resulting clips belong to. */
  stream: string;
  /** "6" for Episode 6. Kept separate from the title so clips can be labelled consistently. */
  number?: string;
  title: string;
  guest?: string;
  /** Where the media lives, once it is in Descript. */
  descript_project_id?: string;
  descript_composition_id?: string;
  /**
   * The transcript with `[HH:MM:SS]` anchors.
   *
   * Two ways in, and both matter. PULLED from Descript is the real path. PASTED exists because the
   * editorial half is the valuable half and must not be blocked on an upload: Marrs can propose
   * clips from a transcript he already has while the episode is still exporting.
   */
  transcript?: string;
  transcript_source?: 'pasted' | 'descript';
  transcript_chars?: number;
  /**
   * Source aspect, REPORTED not assumed (a clip-1 review learning: he misremembered a 16:9 source
   * as 9:16). A 16:9 source normally needs Descript's "Center active speaker", which is a manual
   * toggle and not exposed to automation, so this field is what tells the operator a clip is not
   * done yet. Unless `pre_framed` below says the framing problem was already solved upstream.
   */
  source_aspect?: '9:16' | '16:9' | 'unknown';
  /**
   * TRUE when the source is 16:9 but ALREADY COMPOSED so that a plain centre crop to 9:16 works.
   *
   * Marrs solved the hardest part of this pipeline in Final Cut rather than in software: "I'll export
   * the version of the podcast out of Final Cut Pro, already at 16:9 with Shourov and I centred. All
   * we have to do is cut the clip and put the captions and the title." Both speakers sit inside the
   * centre of the frame, so the crop that would normally lose one of them is safe.
   *
   * This is the difference between a clip needing a manual toggle and the pipeline being fully
   * automatic, so it is an explicit operator statement about the export rather than something
   * inferred. It cannot be detected: a landscape frame gives no clue whether its subjects were
   * deliberately placed for a vertical crop.
   */
  pre_framed?: boolean;
  clips: ClipProposal[];
  created_at: string;
  updated_at?: string;
};

const PREFIX = 'pam/podcast';

export function episodeKey(owner: string, id: string): string {
  return `${PREFIX}/${owner}/${id}.json`;
}

export function isEpisode(x: unknown): x is PodcastEpisode {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const e = x as Record<string, unknown>;
  // `clips` must be an ARRAY but may be empty: an episode exists before any clip is proposed, and
  // requiring one would make a freshly created episode read as malformed and vanish. That exact
  // trap cost a working prezie once; not repeating it.
  return (
    typeof e.episode_id === 'string' &&
    e.episode_id.length > 0 &&
    typeof e.title === 'string' &&
    Array.isArray(e.clips)
  );
}

async function readAt(key: string): Promise<PodcastEpisode | null> {
  if (isBucketConfigured()) {
    const text = await getObjectText(key);
    if (!text) return null;
    const parsed: unknown = JSON.parse(text);
    return isEpisode(parsed) ? parsed : null;
  }
  const state = await getSheetState(key);
  return isEpisode(state) ? state : null;
}

export async function saveEpisode(ep: PodcastEpisode): Promise<void> {
  const key = episodeKey(ep.owner, ep.episode_id);
  if (isBucketConfigured()) {
    await putObjectText(key, JSON.stringify(ep, null, 2));
  } else {
    await saveSheetState(key, ep as unknown as Record<string, unknown>);
  }
}

export async function getEpisode(owner: string, id: string): Promise<PodcastEpisode | null> {
  try {
    return await readAt(episodeKey(owner, id));
  } catch (err) {
    console.error('[podcast-store] read failed:', err);
    return null;
  }
}

export async function deleteEpisode(owner: string, id: string): Promise<void> {
  const key = episodeKey(owner, id);
  if (isBucketConfigured()) {
    await deleteObject(key);
  } else {
    await deleteSheetState(key);
  }
}

/** Every episode for an owner, newest first. Malformed rows are dropped, never thrown. */
export async function listEpisodes(owner: string): Promise<PodcastEpisode[]> {
  const prefix = `${PREFIX}/${owner}/`;
  let docs: PodcastEpisode[] = [];
  try {
    if (isBucketConfigured()) {
      const keys = (await listKeys(prefix)).filter((k) => k.endsWith('.json'));
      // Read every key at once rather than one round trip per episode.
      docs = (await Promise.all(keys.map((k) => readAt(k)))).filter(
        (e): e is PodcastEpisode => e !== null
      );
    } else {
      const { data, error } = await supabaseService()
        .from('content_shoot_sheets')
        .select('episode_id, state')
        .like('episode_id', `${prefix}%`);
      if (error) throw new Error(error.message);
      docs = (data ?? []).map((r) => (r as { state: unknown }).state).filter(isEpisode);
    }
  } catch (err) {
    console.error('[podcast-store] list failed:', err);
    return [];
  }
  return docs.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
}

/**
 * Replace one clip in place, returning the updated episode.
 *
 * A helper rather than inline spread at each call site because every route touches clips this way,
 * and a missed `updated_at` is the kind of thing that only shows up as a stale list weeks later.
 */
export function withClip(ep: PodcastEpisode, clip: ClipProposal): PodcastEpisode {
  const now = new Date().toISOString();
  return {
    ...ep,
    clips: ep.clips.map((c) =>
      c.clip_id === clip.clip_id ? { ...clip, updated_at: now } : c
    ),
    updated_at: now,
  };
}

/**
 * THE OPERATOR'S VIEW OF A CLIP: the hook labelled, then the body as flowing prose in play order.
 *
 * Explicitly from Marrs reviewing the first assembled clip: "Operator review = a readable TEXT
 * BLOCK, not an EDL. The timecoded EDL is for the assembly engine only; keep it out of the human
 * review view." He is judging whether it plays as one thought, and timecodes actively obstruct
 * that judgment.
 */
export function clipAsProse(clip: ClipProposal): { hook: string; body: string } {
  // The hook is the first EDL span by construction, so it must not be printed twice.
  const rest = clip.edl.filter((s, i) => !(i === 0 && s.text.trim() === clip.hook.text.trim()));
  return {
    hook: clip.hook.text.trim(),
    body: rest
      .map((s) => s.text.trim())
      .filter(Boolean)
      .join(' '),
  };
}

/** Spoken seconds at roughly 2.7 words per second, the rate the proposal prompt estimates with. */
export function spokenSeconds(clip: ClipProposal): number {
  const words = clip.edl.reduce((n, s) => n + s.text.trim().split(/\s+/).filter(Boolean).length, 0);
  return Math.round(words / 2.7);
}
