'use client';

/**
 * The publishing calendar (Step 1) — the team's window on what is going out.
 * Entries are grouped by planned date (plus an "Unscheduled" bucket), each showing
 * its platform mark, the piece it came from, the channel caption, and links back
 * to the piece in the console (and to Metricool once a post exists there). You can
 * set/clear a date per entry and remove entries. Dates are plans for now; actually
 * scheduling to Metricool is a later step.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PlatformIcon } from '../_components/PlatformIcon';
import { channelLabel } from '@/lib/marketing/channels';
import { streamLabel } from '@/lib/marketing/streams';
import type { CalendarEntry } from '@/lib/marketing/calendar-store';
import s from './calendar.module.css';

function dateKey(iso?: string): string {
  return iso ? iso.slice(0, 10) : '';
}

function prettyDate(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  if (!y || !m || !d) return dayKey;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function CalendarBoard({ initial }: { initial: CalendarEntry[] }) {
  const [entries, setEntries] = useState<CalendarEntry[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);

  const { dated, undated } = useMemo(() => {
    const dated = entries.filter((e) => e.scheduled_at).slice();
    const undated = entries.filter((e) => !e.scheduled_at);
    dated.sort((a, b) => (a.scheduled_at! < b.scheduled_at! ? -1 : 1));
    const byDay = new Map<string, CalendarEntry[]>();
    for (const e of dated) {
      const k = dateKey(e.scheduled_at);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k)!.push(e);
    }
    return { dated: byDay, undated };
  }, [entries]);

  const entryUrl = (entryId: string) =>
    window.location.pathname.replace(/\/+$/, '') + '/' + entryId;

  const setDate = async (entry: CalendarEntry, date: string) => {
    setBusy(entry.entry_id);
    const prev = entries;
    const scheduled_at = date || undefined;
    setEntries((es) =>
      es.map((e) => (e.entry_id === entry.entry_id ? { ...e, scheduled_at } : e))
    );
    try {
      const res = await fetch(entryUrl(entry.entry_id), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scheduled_at: date || null }),
      });
      if (!res.ok) setEntries(prev); // revert on failure
    } catch {
      setEntries(prev);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (entry: CalendarEntry) => {
    setBusy(entry.entry_id);
    const prev = entries;
    setEntries((es) => es.filter((e) => e.entry_id !== entry.entry_id));
    try {
      const res = await fetch(entryUrl(entry.entry_id), { method: 'DELETE' });
      if (!res.ok) setEntries(prev);
    } catch {
      setEntries(prev);
    } finally {
      setBusy(null);
    }
  };

  if (entries.length === 0) {
    return (
      <p className={s.empty}>
        Nothing scheduled yet. Approve a post and hit &ldquo;Prepare posts for channels&rdquo;
        to add it here.
      </p>
    );
  }

  const renderEntry = (e: CalendarEntry) => (
    <div key={e.entry_id} className={s.entry} data-busy={busy === e.entry_id}>
      <span className={s.entryIcon} title={channelLabel(e.channel)}>
        <PlatformIcon channel={e.channel} size={20} title={channelLabel(e.channel)} />
      </span>
      <div className={s.entryMain}>
        <div className={s.entryTop}>
          <span className={s.entryTitle}>{e.title}</span>
          <span className={s.entryStream}>{streamLabel(e.stream)}</span>
          <span className={s.entryChannel}>{channelLabel(e.channel)}</span>
          <span className={`${s.entryStatus} ${e.scheduled_at ? s.stPlanned : s.stDraft}`}>
            {e.scheduled_at ? 'Planned' : 'Draft'}
          </span>
        </div>
        <p className={s.entryCopy}>{e.post_copy}</p>
        <div className={s.entryActions}>
          <label className={s.dateLabel}>
            Date
            <input
              type="date"
              className={s.dateInput}
              value={dateKey(e.scheduled_at)}
              onChange={(ev) => setDate(e, ev.target.value)}
              disabled={busy === e.entry_id}
            />
          </label>
          <Link className={s.entryLink} href={`/console/marketing/piece/${e.piece_id}`}>
            Open piece
          </Link>
          {e.metricool_url ? (
            <a
              className={s.entryLink}
              href={e.metricool_url}
              target="_blank"
              rel="noreferrer"
            >
              View in Metricool
            </a>
          ) : (
            <span className={s.entryLinkMuted} title="Available once the post is scheduled to Metricool">
              Metricool link (after scheduling)
            </span>
          )}
          <button
            type="button"
            className={s.removeBtn}
            onClick={() => remove(e)}
            disabled={busy === e.entry_id}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={s.board}>
      {[...dated.entries()].map(([day, items]) => (
        <section key={day} className={s.dayGroup}>
          <h2 className={s.dayHead}>{prettyDate(day)}</h2>
          <div className={s.entries}>{items.map(renderEntry)}</div>
        </section>
      ))}

      {undated.length > 0 ? (
        <section className={s.dayGroup}>
          <h2 className={s.dayHead}>Unscheduled</h2>
          <div className={s.entries}>{undated.map(renderEntry)}</div>
        </section>
      ) : null}
    </div>
  );
}
