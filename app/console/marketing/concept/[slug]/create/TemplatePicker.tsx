'use client';

/**
 * The template picker (D25): the stream's own templates first, then the built-in
 * library. Each card shows what you bring / what you get and an example, so the
 * user sees what they're about to create before committing. "Use" POSTs to ./go
 * and lands on the created piece. Templates whose format module isn't built yet
 * show as developing and can't be used (honest about what one-shots today).
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ContentTemplate } from '@/lib/marketing/template-store';
import type { LibraryTemplate } from '@/lib/marketing/template-library';
import { formatById } from '@/lib/marketing/output-plan';
import { channelLabel } from '@/lib/marketing/channels';
import s from './create.module.css';

type AnyTemplate = (ContentTemplate | LibraryTemplate) & { stream?: string };

export function TemplatePicker({
  streamTemplates,
  libraryTemplates,
  stream,
}: {
  streamTemplates: ContentTemplate[];
  libraryTemplates: LibraryTemplate[];
  stream: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Hide library templates the stream has already copied (same id).
  const streamIds = new Set(streamTemplates.map((t) => t.template_id));
  const library = libraryTemplates.filter((t) => !streamIds.has(t.template_id));

  const use = async (t: AnyTemplate, source: 'stream' | 'library') => {
    const key = `${source}:${t.template_id}`;
    if (busy) return;
    setBusy(key);
    setError(null);
    try {
      const url = window.location.pathname.replace(/\/+$/, '') + '/go';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ source, template_id: t.template_id }),
      });
      const b = (await res.json().catch(() => null)) as
        | { target?: string; error?: string }
        | null;
      if (!res.ok || !b?.target) {
        setError(b?.error ?? 'Could not create from this template.');
        setBusy(null);
        return;
      }
      router.push(b.target);
    } catch {
      setError('Network error. Try again.');
      setBusy(null);
    }
  };

  const renderCard = (t: AnyTemplate, source: 'stream' | 'library') => {
    const fmt = formatById(t.format);
    const usable = fmt?.module === 'built' && t.status === 'active';
    const key = `${source}:${t.template_id}`;
    return (
      <div key={key} className={`${s.card} ${usable ? '' : s.cardDim}`}>
        <div className={s.cardHead}>
          <span className={s.cardName}>{t.name}</span>
          <span className={`${s.status} ${t.status === 'active' ? s.stActive : s.stDev}`}>
            {t.status}
          </span>
        </div>
        <p className={s.cardDesc}>{t.description}</p>
        <p className={s.cardMakes}>
          Makes: <strong>{fmt?.label ?? t.format}</strong>
          {t.platforms.length ? <> → {t.platforms.map(channelLabel).join(', ')}</> : null}
        </p>
        {t.inputs ? (
          <p className={s.cardIo}>
            <span className={s.ioLabel}>You bring:</span> {t.inputs}
          </p>
        ) : null}
        {t.outputs ? (
          <p className={s.cardIo}>
            <span className={s.ioLabel}>You get:</span> {t.outputs}
          </p>
        ) : null}
        {t.example ? <p className={s.cardExample}>Example: {t.example}</p> : null}
        <div className={s.cardFoot}>
          {usable ? (
            <button
              type="button"
              className={s.useBtn}
              onClick={() => use(t, source)}
              disabled={busy !== null}
            >
              {busy === key ? 'Creating…' : 'Use this series →'}
            </button>
          ) : (
            <span className={s.comingNote}>
              {fmt?.module !== 'built' ? 'Production module coming' : 'In development'}
            </span>
          )}
          {source === 'library' ? <span className={s.libTag}>library</span> : null}
        </div>
      </div>
    );
  };

  return (
    <div className={s.picker}>
      {error ? <p className={s.error}>{error}</p> : null}

      <section className={s.panel}>
        <h2 className={s.groupTitle}>Your series</h2>
        {streamTemplates.length === 0 ? (
          <p className={s.emptyNote}>
            No series in this stream yet.{' '}
            <Link href={`/console/marketing/stream/${stream}/templates`} className={s.manageLink}>
              Create one →
            </Link>
          </p>
        ) : (
          <div className={s.cards}>{streamTemplates.map((t) => renderCard(t, 'stream'))}</div>
        )}
      </section>

      {library.length > 0 ? (
        <section className={s.panel}>
          <h2 className={s.groupTitle}>From the series library</h2>
          <div className={s.cards}>{library.map((t) => renderCard(t, 'library'))}</div>
        </section>
      ) : null}

      <p className={s.manageFoot}>
        <Link href={`/console/marketing/stream/${stream}/templates`} className={s.manageLink}>
          Manage this stream&rsquo;s series →
        </Link>
      </p>
    </div>
  );
}
