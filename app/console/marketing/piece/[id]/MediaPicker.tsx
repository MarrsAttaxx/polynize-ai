'use client';

/**
 * Attach media from the piece's own stream library to a piece. Loads the stream's
 * assets (path-relative GET so it works on pam.polynize.ai and the console host),
 * shows a selectable grid, and reports the selected asset ids up to the screen,
 * which persists them on the piece via its normal autosave. The bytes live in Box;
 * these are references, resolved to public URLs at publish time.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { MediaAsset, MediaKind } from '@/lib/marketing/media-store';
import s from './media-picker.module.css';

export function MediaPicker({
  pieceId,
  stream,
  narrativeRef,
  selected,
  onChange,
  disabled,
}: {
  pieceId: string;
  stream: string;
  /**
   * THIS NARRATIVE'S POOL COMES FIRST (D52). Set on any piece cut from a narrative, which is
   * every piece the Gates produce.
   */
  narrativeRef?: string;
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [assets, setAssets] = useState<MediaAsset[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const base = window.location.pathname.replace(/\/+$/, '');
    fetch(`${base}/media?stream=${encodeURIComponent(stream)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (!cancelled) setAssets((d.media ?? []) as MediaAsset[]);
      })
      .catch(() => {
        if (!cancelled) {
          setAssets([]);
          setError('Could not load the media library.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [stream, pieceId]);

  const toggle = (id: string, kind: MediaKind) => {
    if (disabled) return;
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
      return;
    }
    // Metricool rejects a post that mixes media types or carries more than one
    // video. So a video is EXCLUSIVE (picking one clears the rest); an image
    // groups with other images but replaces a selected video.
    if (kind === 'video') {
      onChange([id]);
      return;
    }
    const hasVideo = (assets ?? []).some(
      (a) => selected.includes(a.media_id) && a.kind === 'video'
    );
    onChange(hasVideo ? [id] : [...selected, id]);
  };

  /**
   * TWO POOLS, and the narrative's own comes first.
   *
   * Marrs: "the image selection should be a contextual, narrative specific image pool. As the
   * images would be created for this narrative, then we can have a hidden section at the bottom
   * which with a click you can open the media library."
   *
   * Every approved slide and every hero registers into the stream library, so without this split
   * a text post's picker is a wall of other narratives' slides within a week. Assets with no
   * narrative stamp (a hand-pasted Box link, anything from before D52) belong to the library
   * half, which is the right home for them.
   */
  const { mine, rest } = useMemo(() => {
    const all = assets ?? [];
    if (!narrativeRef) return { mine: [], rest: all };
    return {
      mine: all.filter((a) => a.narrative_ref === narrativeRef),
      rest: all.filter((a) => a.narrative_ref !== narrativeRef),
    };
  }, [assets, narrativeRef]);

  /** The library half is folded by default: it is the escape hatch, not the first choice. */
  const [libraryOpen, setLibraryOpen] = useState(false);

  const manageHref = `/console/marketing/stream/${stream}/media`;

  const tile = (m: MediaAsset) => {
    const on = selected.includes(m.media_id);
    return (
      <button
        key={m.media_id}
        type="button"
        className={`${s.tile} ${on ? s.on : ''}`}
        onClick={() => toggle(m.media_id, m.kind)}
        disabled={disabled}
        aria-pressed={on}
        title={m.label}
      >
        {m.kind === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.url} alt={m.label} className={s.img} loading="lazy" />
        ) : (
          <span className={s.video} aria-hidden>
            ▶
          </span>
        )}
        {on ? (
          <span className={s.check} aria-hidden>
            ✓
          </span>
        ) : null}
        <span className={s.tileLabel}>{m.label}</span>
      </button>
    );
  };

  return (
    <div className={s.wrap}>
      <div className={s.head}>
        <span className={s.label}>
          Media{selected.length > 0 ? ` · ${selected.length} attached` : ''}
        </span>
        <Link href={manageHref} className={s.manage}>
          Manage library →
        </Link>
      </div>
      {error ? <span className={s.err}>{error}</span> : null}
      {assets === null ? (
        <span className={s.status}>Loading media…</span>
      ) : assets.length === 0 ? (
        <p className={s.empty}>
          No media in this stream&rsquo;s library yet.{' '}
          <Link href={manageHref} className={s.manage}>
            Add some &rarr;
          </Link>
        </p>
      ) : (
        <>
          {/* THIS NARRATIVE'S OWN IMAGES, first and open (D52). */}
          {narrativeRef ? (
            mine.length > 0 ? (
              <div className={s.grid}>{mine.map(tile)}</div>
            ) : (
              <p className={s.empty}>
                Nothing made for this narrative yet. Make the look at gate 4, or open the library
                below.
              </p>
            )
          ) : null}

          {/* THE WHOLE LIBRARY, folded: the escape hatch, not the first choice. */}
          {rest.length > 0 ? (
            narrativeRef ? (
              <>
                <button
                  type="button"
                  className={s.libToggle}
                  onClick={() => setLibraryOpen((v) => !v)}
                  aria-expanded={libraryOpen}
                >
                  {libraryOpen ? '▾' : '▸'} the whole library
                  <span className={s.libCount}>{rest.length}</span>
                </button>
                {libraryOpen ? <div className={s.grid}>{rest.map(tile)}</div> : null}
              </>
            ) : (
              <div className={s.grid}>{rest.map(tile)}</div>
            )
          ) : null}
        </>
      )}
      {assets && assets.length > 0 ? (
        <p className={s.constraint}>
          One video on its own, or multiple images. Mixing types in one post
          isn&rsquo;t allowed.
        </p>
      ) : null}
    </div>
  );
}
