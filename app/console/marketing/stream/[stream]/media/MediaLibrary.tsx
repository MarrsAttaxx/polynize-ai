'use client';

/**
 * The stream media library UI (client). Add an asset by pasting a public direct
 * link (a Box live link, or any public media URL), then it appears in the grid and
 * becomes selectable when producing a piece in this stream. Delete drops the
 * reference only (the file in Box is untouched). POSTs to path-relative sibling
 * routes (/add, /delete, /move) so it works on pam.polynize.ai and the console host.
 *
 * Assets can also be MOVED to another stream, because uploading a batch to the wrong
 * library is an easy mistake and the alternative fix is deleting and re-uploading all of
 * them. Selection is multi-select for exactly that reason: the mistake is usually made
 * once across many files.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { MediaAsset } from '@/lib/marketing/media-store';
import {
  checkUpload,
  labelFromFilename,
  UPLOAD_TYPES,
  MAX_UPLOAD_BYTES,
} from '@/lib/marketing/media-upload';
import { STREAMS } from '@/lib/marketing/streams';
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState('');
  const [moving, setMoving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Assets whose file would not load. A broken link used to render as an invisible or
  // collapsed tile, which is how Marrs ended up with one he could see the name of but
  // could not work out how to remove. A dead link is exactly the one you most want to
  // delete, so it now says so and keeps its controls.
  const [broken, setBroken] = useState<Set<string>>(new Set());

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

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const move = async () => {
    if (moving || !target || selected.size === 0) return;
    const ids = [...selected];
    setMoving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(base() + '/move', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ media_ids: ids, target_stream: target }),
      });
      const data = (await res.json().catch(() => null)) as
        | { moved?: string[]; failed?: string[]; message?: string; error?: string }
        | null;
      if (!res.ok || !data?.moved?.length) {
        setError(data?.error ?? 'Could not move those.');
        return;
      }
      // Drop only what actually moved, so a partial batch leaves the stragglers on
      // screen and still selected rather than pretending they are gone.
      const gone = new Set(data.moved);
      gone.forEach((id) => deletedIds.current.add(id));
      setAssets((a) => a.filter((m) => !gone.has(m.media_id)));
      setSelected(new Set(ids.filter((id) => !gone.has(id))));
      setNotice(data.message ?? `Moved ${data.moved.length}.`);
      setTarget('');
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setMoving(false);
    }
  };

  /**
   * UPLOAD A FILE (D65), which is three steps and only the middle one is big.
   *
   * Ask for a presigned url, PUT the bytes straight to the bucket, then register the result
   * through the same /add route a pasted link uses. The bytes never touch a Vercel function, which
   * is what gets past the 4.5MB request body cap that a phone photo clears on its own.
   *
   * Registration is the LAST step on purpose: an abandoned upload leaves bytes nobody points at,
   * never a library entry pointing at nothing.
   */
  const upload = async (file: File) => {
    if (busy) return;
    const check = checkUpload(file.type || '', file.size);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(`Uploading ${file.name}…`);
    try {
      const signRes = await fetch(base() + '/upload-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contentType: file.type, bytes: file.size }),
      });
      const sign = (await signRes.json().catch(() => null)) as
        | { uploadUrl?: string; url?: string; contentType?: string; error?: string }
        | null;
      if (!signRes.ok || !sign?.uploadUrl || !sign.url) {
        setError(sign?.error ?? 'Could not start the upload.');
        return;
      }

      // Exactly the content type the signature committed to, or the bucket rejects the PUT.
      const put = await fetch(sign.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': sign.contentType ?? file.type },
        body: file,
      });
      if (!put.ok) {
        setError(`The upload was rejected (${put.status}). Try again.`);
        return;
      }

      const res = await fetch(base() + '/add', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url: sign.url,
          kind: 'image',
          label: label.trim() || labelFromFilename(file.name),
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { asset?: MediaAsset; error?: string }
        | null;
      if (!res.ok) {
        setError(data?.error ?? 'It uploaded but could not be added to the library.');
        return;
      }
      if (data?.asset) setAssets((a) => [data.asset as MediaAsset, ...a]);
      setLabel('');
      setNotice(`${file.name} is in the library.`);
      router.refresh();
    } catch {
      setError('Network error during the upload. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={s.wrap}>
      {/* UPLOAD, above the paste field, because it is now the easier of the two ways in. */}
      <div className={s.uploadRow}>
        <label className={s.uploadBtn}>
          <input
            type="file"
            accept={Object.keys(UPLOAD_TYPES).join(',')}
            onChange={(e) => {
              const f = e.target.files?.[0];
              // Cleared so picking the same file twice still fires a change.
              e.target.value = '';
              if (f) void upload(f);
            }}
            disabled={busy}
            hidden
          />
          {busy ? 'Working…' : 'Upload an image'}
        </label>
        <span className={s.uploadNote}>
          PNG, JPEG or WebP, up to {MAX_UPLOAD_BYTES / 1024 / 1024}MB. Video still goes through Box:
          our bucket is private and a video is too large to serve through the console.
        </span>
      </div>

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
      {notice ? <p className={s.notice}>{notice}</p> : null}

      {assets.length > 0 ? (
        <div className={s.selectBar}>
          <span className={s.selectCount}>
            {selected.size ? `${selected.size} selected` : 'Select to move'}
          </span>
          <button
            type="button"
            className={s.selectAction}
            onClick={() =>
              setSelected(
                selected.size === assets.length
                  ? new Set()
                  : new Set(assets.map((m) => m.media_id))
              )
            }
          >
            {selected.size === assets.length ? 'Clear' : 'Select all'}
          </button>
          <select
            className={s.kindSelect}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            aria-label="Move to which library"
            disabled={moving || selected.size === 0}
          >
            <option value="">Move to…</option>
            {STREAMS.filter((st) => st.id !== stream).map((st) => (
              <option key={st.id} value={st.id}>
                {st.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={s.addBtn}
            onClick={move}
            disabled={moving || !target || selected.size === 0}
          >
            {moving ? 'Moving…' : 'Move'}
          </button>
        </div>
      ) : null}

      {assets.length === 0 ? (
        <p className={s.empty}>No media yet. Add your first asset above.</p>
      ) : (
        <div className={s.grid}>
          {assets.map((m) => (
            <div
              key={m.media_id}
              className={`${s.thumb} ${selected.has(m.media_id) ? s.thumbOn : ''}`}
            >
              <label className={s.pick}>
                <input
                  type="checkbox"
                  checked={selected.has(m.media_id)}
                  onChange={() => toggle(m.media_id)}
                  aria-label={`Select ${m.label}`}
                />
              </label>
              <a
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                className={s.thumbLink}
              >
                {m.kind === 'image' && !broken.has(m.media_id) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.url}
                    alt={m.label}
                    className={s.thumbImg}
                    loading="lazy"
                    onError={() =>
                      setBroken((prev) => {
                        const next = new Set(prev);
                        next.add(m.media_id);
                        return next;
                      })
                    }
                  />
                ) : m.kind === 'image' ? (
                  <span className={s.brokenTile}>link broken</span>
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
