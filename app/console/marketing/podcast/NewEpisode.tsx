'use client';

/**
 * Add an episode.
 *
 * Deliberately three fields and a stream. The Descript project is chosen on the episode screen
 * afterwards, not here, because an episode is usually created while the upload is still running:
 * requiring the project up front would mean waiting twenty minutes before being allowed to start.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { STREAMS, DEFAULT_STREAM, type StreamId } from '@/lib/marketing/streams';
import s from '../../_components/client-card.module.css';
import d from './podcast.module.css';

export function NewEpisode({
  defaultStream,
  startOpen,
}: {
  /** Pre-picked when arriving from a stream's Podcasts section. */
  defaultStream?: StreamId;
  /** Open immediately, so "Add one" from a stream lands on the form rather than a button. */
  startOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(startOpen));
  const [number, setNumber] = useState('');
  const [title, setTitle] = useState('');
  const [guest, setGuest] = useState('');
  const [stream, setStream] = useState<StreamId>(defaultStream ?? DEFAULT_STREAM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (busy || !title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/console/marketing/podcast/episodes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          number: number.trim() || undefined,
          title: title.trim(),
          guest: guest.trim() || undefined,
          stream,
        }),
      });
      const b = (await res.json().catch(() => null)) as
        | { episode_id?: string; error?: string }
        | null;
      if (!res.ok || !b?.episode_id) {
        setError(b?.error ?? 'Could not create it.');
        return;
      }
      router.push(`/console/marketing/podcast/${b.episode_id}`);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className={s.marketingCtaRow}>
        <div className={s.ctaGroup}>
          <button type="button" className={s.startConceptCta} onClick={() => setOpen(true)}>
            Add an episode
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={d.newBox}>
      <div className={d.newRow}>
        <input
          className={d.newNum}
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="6"
          aria-label="Episode number"
        />
        <input
          className={d.newTitle}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Episode title"
          aria-label="Episode title"
          autoFocus
        />
      </div>
      <div className={d.newRow}>
        <input
          className={d.newTitle}
          value={guest}
          onChange={(e) => setGuest(e.target.value)}
          placeholder="Guest (optional)"
          aria-label="Guest"
        />
        <select
          className={d.newStream}
          value={stream}
          onChange={(e) => setStream(e.target.value as StreamId)}
          aria-label="Stream"
        >
          {STREAMS.map((st) => (
            <option key={st.id} value={st.id}>
              {st.label}
            </option>
          ))}
        </select>
      </div>
      <div className={d.newRow}>
        <button
          type="button"
          className={d.primaryBtn}
          onClick={() => void create()}
          disabled={busy || !title.trim()}
        >
          {busy ? 'Adding…' : 'Add episode'}
        </button>
        <button type="button" className={d.ghostBtn} onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
      </div>
      {error ? <p className={d.error}>{error}</p> : null}
    </div>
  );
}
