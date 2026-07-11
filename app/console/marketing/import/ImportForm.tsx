'use client';

/**
 * Import-a-concept form (D25): stream + title + pasted Markdown. The title
 * auto-fills from the doc's first `# heading` if left empty. Saves via ./save
 * and lands on the new concept page.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { StreamId } from '@/lib/marketing/streams';
import s from './import.module.css';

export function ImportForm({
  streams,
  initialStream,
}: {
  streams: { id: string; label: string }[];
  initialStream: StreamId;
}) {
  const router = useRouter();
  const [stream, setStream] = useState<string>(initialStream);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const derivedTitle = () => {
    if (title.trim()) return title.trim();
    const m = body.match(/^#\s+(.+)$/m);
    return m ? m[1].trim() : '';
  };

  const save = async (mode?: 'update') => {
    if (busy) return;
    const finalTitle = derivedTitle();
    if (!finalTitle) {
      setError('Give the concept a title (or start the doc with a # heading).');
      return;
    }
    if (!body.trim()) {
      setError('Paste the concept document.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const url = window.location.pathname.replace(/\/+$/, '') + '/save';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stream, title: finalTitle, body_md: body, mode }),
      });
      const b = (await res.json().catch(() => null)) as
        | { slug?: string; error?: string; conflict?: boolean }
        | null;
      if (res.status === 409 && b?.conflict) {
        // Same-titled concept exists: replacing its body is destructive, so it
        // only happens on an explicit second confirmation.
        setBusy(false);
        if (
          window.confirm(
            `A concept titled "${finalTitle}" already exists. Replace its content with this document? (The old content is not recoverable.)`
          )
        ) {
          void save('update');
        } else {
          setError('Import cancelled. Change the title to import this as a new concept.');
        }
        return;
      }
      if (!res.ok || !b?.slug) {
        setError(b?.error ?? 'Could not import the concept.');
        setBusy(false);
        return;
      }
      router.push(`/console/marketing/concept/${b.slug}`);
    } catch {
      setError('Network error. Try again.');
      setBusy(false);
    }
  };

  return (
    <div className={s.form}>
      <div className={s.rowFields}>
        <label className={s.field}>
          Stream
          <select
            className={s.input}
            value={stream}
            onChange={(e) => setStream(e.target.value)}
          >
            {streams.map((st) => (
              <option key={st.id} value={st.id}>
                {st.label}
              </option>
            ))}
          </select>
        </label>
        <label className={s.fieldGrow}>
          Title
          <input
            className={s.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Auto-fills from the doc's # heading if left empty"
          />
        </label>
      </div>

      <label className={s.fieldWide}>
        Concept document
        <textarea
          className={s.doc}
          value={body}
          spellCheck={false}
          onChange={(e) => setBody(e.target.value)}
          placeholder={'Paste the concept Markdown here.\n\nWorks great with docs extracted from meetings: title, who it\'s for, the core concept, how to frame it.'}
        />
      </label>

      <div className={s.actions}>
        <button type="button" className={s.save} onClick={() => save()} disabled={busy}>
          {busy ? 'Importing…' : 'Import concept →'}
        </button>
        {error ? <span className={s.error}>{error}</span> : null}
      </div>
    </div>
  );
}
