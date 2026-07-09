'use client';

/**
 * The publishing calendar (Step 1) — the team's window on what is going out, in
 * three views: List (grouped by date), Month (a grid), and Day (one day at a
 * time). Entries show their platform mark, the piece they came from, the channel
 * caption, and links back to the piece (and to Metricool once a post exists).
 * You can set/clear a date per entry and remove entries. Dates are plans for now;
 * actually scheduling to Metricool is a later step.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PlatformIcon } from '../_components/PlatformIcon';
import { channelLabel, metricoolNetwork } from '@/lib/marketing/channels';
import { streamLabel } from '@/lib/marketing/streams';
import type { CalendarEntry } from '@/lib/marketing/calendar-store';
import s from './calendar.module.css';

type View = 'list' | 'month' | 'day';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
/** Local calendar-date key (YYYY-MM-DD), matching the <input type=date> value. */
function fmtKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function keyOf(iso?: string): string {
  return iso ? iso.slice(0, 10) : '';
}
function prettyDay(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  if (!y || !m || !d) return dayKey;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
/** Monday-first column index (0..6) for a date. */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function CalendarBoard({ initial }: { initial: CalendarEntry[] }) {
  const [entries, setEntries] = useState<CalendarEntry[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [view, setView] = useState<View>('list');
  const [cursor, setCursor] = useState<Date>(() => new Date());

  // Only mark "today" after mount so server and client HTML match (the server's
  // clock could differ), avoiding a hydration mismatch on the highlight.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const todayKey = mounted ? fmtKey(new Date()) : '';

  const byDay = useMemo(() => {
    const m = new Map<string, CalendarEntry[]>();
    for (const e of entries) {
      if (!e.scheduled_at) continue;
      const k = keyOf(e.scheduled_at);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    return m;
  }, [entries]);

  const undated = useMemo(() => entries.filter((e) => !e.scheduled_at), [entries]);

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
      if (!res.ok) setEntries(prev);
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

  const setErr = (entryId: string, msg: string | null) =>
    setErrs((e) => {
      const n = { ...e };
      if (msg) n[entryId] = msg;
      else delete n[entryId];
      return n;
    });

  const schedule = async (entry: CalendarEntry) => {
    const when = entry.scheduled_at ? ` for ${entry.scheduled_at.slice(0, 10)}` : '';
    if (
      !window.confirm(
        `Schedule this ${channelLabel(entry.channel)} post${when}? It will be sent to Metricool.`
      )
    ) {
      return;
    }
    setBusy(entry.entry_id);
    setErr(entry.entry_id, null);
    try {
      const res = await fetch(entryUrl(entry.entry_id) + '/schedule', { method: 'POST' });
      const b = (await res.json().catch(() => null)) as
        | { entry?: CalendarEntry; error?: string; warning?: string }
        | null;
      if (!res.ok) {
        setErr(entry.entry_id, b?.error ?? 'Could not schedule.');
        return;
      }
      if (b?.entry) {
        setEntries((es) => es.map((x) => (x.entry_id === entry.entry_id ? b.entry! : x)));
      }
      if (b?.warning) setErr(entry.entry_id, b.warning);
    } catch {
      setErr(entry.entry_id, 'Network error. Try again.');
    } finally {
      setBusy(null);
    }
  };

  // -------- shared full entry card (List + Day) --------
  const renderEntry = (e: CalendarEntry) => {
    const isScheduled = e.status === 'scheduled' || e.status === 'published';
    const statusLabel =
      e.status === 'published'
        ? 'Published'
        : e.status === 'scheduled'
          ? 'Scheduled'
          : e.scheduled_at
            ? 'Planned'
            : 'Draft';
    const statusClass = isScheduled ? s.stScheduled : e.scheduled_at ? s.stPlanned : s.stDraft;
    const metricoolSupported = metricoolNetwork(e.channel) !== null;
    const canSchedule = !!e.scheduled_at && !isScheduled && metricoolSupported;

    return (
      <div key={e.entry_id} className={s.entry} data-busy={busy === e.entry_id}>
        <span className={s.entryIcon} title={channelLabel(e.channel)}>
          <PlatformIcon channel={e.channel} size={20} title={channelLabel(e.channel)} />
        </span>
        <div className={s.entryMain}>
          <div className={s.entryTop}>
            <span className={s.entryTitle}>{e.title}</span>
            <span className={s.entryStream}>{streamLabel(e.stream)}</span>
            <span className={s.entryChannel}>{channelLabel(e.channel)}</span>
            <span className={`${s.entryStatus} ${statusClass}`}>{statusLabel}</span>
          </div>
          <p className={s.entryCopy}>{e.post_copy}</p>
          <div className={s.entryActions}>
            <label className={s.dateLabel}>
              Date
              <input
                type="date"
                className={s.dateInput}
                value={keyOf(e.scheduled_at)}
                onChange={(ev) => setDate(e, ev.target.value)}
                disabled={busy === e.entry_id || isScheduled}
              />
            </label>
            <Link className={s.entryLink} href={`/console/marketing/piece/${e.piece_id}`}>
              Open piece
            </Link>
            {e.metricool_url ? (
              <a className={s.entryLink} href={e.metricool_url} target="_blank" rel="noreferrer">
                View in Metricool
              </a>
            ) : null}
            {canSchedule ? (
              <button
                type="button"
                className={s.scheduleBtn}
                onClick={() => schedule(e)}
                disabled={busy === e.entry_id}
              >
                Schedule
              </button>
            ) : !metricoolSupported ? (
              <span className={s.entryLinkMuted}>Not published via Metricool</span>
            ) : null}
            <button
              type="button"
              className={s.removeBtn}
              onClick={() => remove(e)}
              disabled={busy === e.entry_id}
            >
              Remove
            </button>
          </div>
          {errs[e.entry_id] ? <p className={s.entryErr}>{errs[e.entry_id]}</p> : null}
        </div>
      </div>
    );
  };

  const unscheduledBanner =
    view !== 'list' && undated.length > 0 ? (
      <button type="button" className={s.unscheduledBanner} onClick={() => setView('list')}>
        {undated.length} unscheduled draft{undated.length === 1 ? '' : 's'} — view in list
      </button>
    ) : null;

  // -------- List view --------
  const renderList = () => {
    const dated = entries.filter((e) => e.scheduled_at).slice();
    dated.sort((a, b) => (a.scheduled_at! < b.scheduled_at! ? -1 : 1));
    const days = new Map<string, CalendarEntry[]>();
    for (const e of dated) {
      const k = keyOf(e.scheduled_at);
      if (!days.has(k)) days.set(k, []);
      days.get(k)!.push(e);
    }
    return (
      <div className={s.board}>
        {[...days.entries()].map(([day, items]) => (
          <section key={day} className={s.dayGroup}>
            <h2 className={s.dayHead}>{prettyDay(day)}</h2>
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
  };

  // -------- Month view --------
  const renderMonth = () => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const lead = mondayIndex(first);
    const cells: (Date | null)[] = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);

    return (
      <div className={s.monthWrap}>
        <div className={s.weekdays}>
          {WEEKDAYS.map((w) => (
            <div key={w} className={s.weekday}>
              {w}
            </div>
          ))}
        </div>
        <div className={s.monthGrid}>
          {cells.map((cell, i) => {
            if (!cell) return <div key={`e${i}`} className={s.dayCellEmpty} />;
            const k = fmtKey(cell);
            const items = byDay.get(k) ?? [];
            return (
              <button
                type="button"
                key={k}
                className={`${s.dayCell} ${k === todayKey ? s.today : ''}`}
                onClick={() => {
                  setCursor(cell);
                  setView('day');
                }}
              >
                <span className={s.dayNum}>{cell.getDate()}</span>
                <span className={s.dayChips}>
                  {items.slice(0, 4).map((e) => (
                    <span
                      key={e.entry_id}
                      className={s.dayChip}
                      title={`${e.title} · ${channelLabel(e.channel)}`}
                    >
                      <PlatformIcon channel={e.channel} size={14} title={channelLabel(e.channel)} />
                    </span>
                  ))}
                  {items.length > 4 ? (
                    <span className={s.dayMore}>+{items.length - 4}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // -------- Day view --------
  const renderDay = () => {
    const k = fmtKey(cursor);
    const items = (byDay.get(k) ?? []).slice();
    return (
      <div className={s.board}>
        {items.length === 0 ? (
          <p className={s.empty}>Nothing scheduled for this day.</p>
        ) : (
          <div className={s.entries}>{items.map(renderEntry)}</div>
        )}
      </div>
    );
  };

  // -------- Navigation label + steppers --------
  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const dayLabel = cursor.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const step = (delta: number) => {
    const d = new Date(cursor);
    if (view === 'month') d.setMonth(d.getMonth() + delta);
    else d.setDate(d.getDate() + delta);
    setCursor(d);
  };

  return (
    <>
      <div className={s.toolbar}>
        <div className={s.viewToggle}>
          {(['list', 'month', 'day'] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              className={`${s.viewBtn} ${view === v ? s.viewBtnActive : ''}`}
              onClick={() => setView(v)}
            >
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        {view !== 'list' ? (
          <div className={s.nav}>
            <button type="button" className={s.navBtn} onClick={() => step(-1)} aria-label="Previous">
              ‹
            </button>
            <button type="button" className={s.navToday} onClick={() => setCursor(new Date())}>
              Today
            </button>
            <span className={s.navLabel}>{view === 'month' ? monthLabel : dayLabel}</span>
            <button type="button" className={s.navBtn} onClick={() => step(1)} aria-label="Next">
              ›
            </button>
          </div>
        ) : null}
      </div>

      {entries.length === 0 ? (
        <p className={s.empty}>
          Nothing scheduled yet. Approve a post and hit &ldquo;Prepare posts for channels&rdquo;
          to add it here.
        </p>
      ) : (
        <>
          {unscheduledBanner}
          {view === 'list' ? renderList() : view === 'month' ? renderMonth() : renderDay()}
        </>
      )}
    </>
  );
}
