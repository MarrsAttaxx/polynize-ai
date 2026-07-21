'use client';

/**
 * The stream media library UI (client). Add an asset by pasting a public direct
 * link (a Box live link, or any public media URL), then it appears in the grid and
 * becomes selectable when producing a piece in this stream. Delete drops the
 * reference only (the file in Box is untouched). POSTs to path-relative sibling
 * routes (/add, /delete) so it works on pam.polynize.ai and the console host.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { MediaAsset } from '@/lib/marketing/media-store';
import s from './media.module.css';

export function MediaLibrary({
  stream,
  initial,
}: {
  stream: string;
  initial: MediaAsset[];
}) {
  const router = useRouter();
  const [assets, setAssets] = useState<MediaAsset[]>(initial);
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<'auto' | 'image' | 'video'>('auto');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ids deleted this session, so a server-list re-sync (below) never resurrects one
  // whose delete is still committing server-side.
  const deletedIds = useRef<Set<string>>(new Set());

  // Re-sync from the server list when it changes (only fires on a server re-render,
  // e.g. router.refresh() after the Generate panel saves an image — not on our own
  // local add/delete, since those don't change the `initial` prop identity).
  useEffect(() => {
    setAssets(initial.filter((a) => !deletedIds.current.has(a.media_id)));
  }, [initial]);

  const base = () => window.location.pathname.replace(/\/+$/, '');

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const u = url.trim();
    if (!u || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(base() + '/add', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url: u,
          label: label.trim() || undefined,
          kind: kind === 'auto' ? undefined : kind,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { asset?: MediaAsset; error?: string }
        | null;
      if (!res.ok) {
        setError(data?.error ?? 'Could not add that.');
        return;
      }
      if (data?.asset) setAssets((a) => [data.asset as MediaAsset, ...a]);
      setUrl('');
      setLabel('');
      setKind('auto');
      // Re-render the server page so the sibling Generate panel (its Soul photo
      // picker reads a server-rendered images prop) picks up the new asset.
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (
      !window.confirm(
        'Remove this from the library? The file in Box is not deleted.'
      )
    )
      return;
    const removed = assets.find((m) => m.media_id === id);
    deletedIds.current.add(id);
    setAssets((a) => a.filter((m) => m.media_id !== id));
    setError(null);
    // Re-insert ONLY this item on failure (functional updater), so a concurrent
    // delete of a different asset is never resurrected by a stale snapshot.
    const restore = () => {
      deletedIds.current.delete(id);
      if (!removed) return;
      setAssets((a) => (a.some((m) => m.media_id === id) ? a : [removed, ...a]));
    };
    try {
      const res = await fetch(base() + '/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ media_id: id }),
      });
      if (!res.ok) {
        restore();
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? 'Could not remove it.');
      }
    } catch {
      restore();
      setError('Network error. Try again.');
    }
  };

  return (
    <div className={s.wrap}>
      <form id="media-add" className={s.addForm} onSubmit={add}>
        <input
          className={s.urlInput}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a Box Direct Link or public media URL"
          aria-label="Media URL"
          disabled={busy}
          inputMode="url"
        />
        <select
          className={s.kindSelect}
          value={kind}
          onChange={(e) => setKind(e.target.value as 'auto' | 'image' | 'video')}
          aria-label="Media type"
          disabled={busy}
        >
          <option value="auto">Auto</option>
          <option value="image">Image</option>
          <option value="video">Video</option>
        </select>
        <input
          className={s.labelInput}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (optional)"
          aria-label="Label"
          disabled={busy}
        />
        <button className={s.addBtn} type="submit" disabled={busy || !url.trim()}>
          {busy ? 'Adding…' : 'Add'}
        </button>
      </form>
      <p className={s.hint}>
        In Box, open a file&rsquo;s Share settings and copy the{' '}
        <strong>Direct Link</strong> (it contains /shared/static/ and ends in the
        file type). That is the link Metricool can fetch.
      </p>
      {error ? <p className={s.error}>{error}</p> : null}

      {assets.length === 0 ? (
        <p className={s.empty}>No media yet. Add your first asset above.</p>
      ) : (
        <div className={s.grid}>
          {assets.map((m) => (
            <div key={m.media_id} className={s.thumb}>
              <a
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                className={s.thumbLink}
              >
                {m.kind === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.url}
                    alt={m.label}
                    className={s.thumbImg}
                    loading="lazy"
                  />
                ) : (
                  <span className={s.videoTile} aria-hidden>
                    ▶
                  </span>
                )}
                <span className={s.kindBadge}>{m.kind}</span>
              </a>
              <div className={s.thumbFoot}>
                <span className={s.assetLabel} title={m.label}>
                  {m.label}
                </span>
                <button
                  type="button"
                  className={s.assetDelete}
                  onClick={() => remove(m.media_id)}
                  aria-label={`Remove ${m.label}`}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
