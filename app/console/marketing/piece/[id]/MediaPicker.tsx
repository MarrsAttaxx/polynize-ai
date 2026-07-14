'use client';

/**
 * Attach media from the piece's own stream library to a piece. Loads the stream's
 * assets (path-relative GET so it works on pam.polynize.ai and the console host),
 * shows a selectable grid, and reports the selected asset ids up to the screen,
 * which persists them on the piece via its normal autosave. The bytes live in Box;
 * these are references, resolved to public URLs at publish time.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { MediaAsset } from '@/lib/marketing/media-store';
import s from './media-picker.module.css';

export function MediaPicker({
  pieceId,
  stream,
  selected,
  onChange,
  disabled,
}: {
  pieceId: string;
  stream: string;
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

  const toggle = (id: string) => {
    if (disabled) return;
    onChange(
      selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
    );
  };

  const manageHref = `/console/marketing/stream/${stream}/media`;

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
            Add some →
          </Link>
        </p>
      ) : (
        <div className={s.grid}>
          {assets.map((m) => {
            const on = selected.includes(m.media_id);
            return (
              <button
                key={m.media_id}
                type="button"
                className={`${s.tile} ${on ? s.on : ''}`}
                onClick={() => toggle(m.media_id)}
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
          })}
        </div>
      )}
    </div>
  );
}
