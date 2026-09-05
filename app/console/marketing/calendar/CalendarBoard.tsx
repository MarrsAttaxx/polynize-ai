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
import { LINK_MEDIA, withMedium } from '@/lib/marketing/tracking-link';
import { labelForUseCase } from '@/lib/marketing/use-case';

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
/**
 * HAS THIS POST'S TIME PASSED (D85), judged in the timezone the time was chosen in.
 *
 * Marrs: "I have a post from Monday, the 31st of August... It says 'scheduled'. It should already
 * say 'posted'."
 *
 * WE INFER THIS FROM THE CLOCK, and it is worth being precise about what that means: nothing in this
 * console has ever confirmed a post actually went out. `status` reaches 'scheduled' when Metricool
 * accepts it and never changes again, because there is no callback and no nightly pull yet. So a
 * scheduled post whose time has passed is one Metricool said it would publish and almost certainly
 * did. The analytics second read is what will make this a fact rather than an inference, and when it
 * lands it replaces this function rather than joining it.
 *
 * The entry's own timezone decides, not the browser's: a Kristin post at 08:30 Los Angeles is still
 * hours away when Sydney has finished the day, and treating the reader's clock as the truth would
 * mark it posted before it happened.
 */
function hasPassed(scheduledAt: string | undefined, timezone: string | undefined, now: Date): boolean {
  if (!scheduledAt) return false;
  const when = scheduledAt.length >= 16 ? scheduledAt.slice(0, 16) : `${scheduledAt.slice(0, 10)}T23:59`;
  let nowKey: string;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || undefined,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const get = (t: string) => parts.find((x) => x.type === t)?.value ?? '';
    nowKey = `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
  } catch {
    // An unrecognised zone is a config typo, not a reason to mislabel every post on the board.
    nowKey = `${fmtKey(now)}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
  return when < nowKey;
}

/** Monday-first column index (0..6) for a date. */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function CalendarBoard({
  initial,
  prepared,
}: {
  initial: CalendarEntry[];
  /**
   * How many posts the piece that sent us here just made (D81).
   *
   * Said out loud because the silent redirect made a partial prepare invisible: three platforms
   * ticked and one post created looked exactly like it had worked.
   */
  prepared?: number;
}) {
  const [entries, setEntries] = useState<CalendarEntry[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  /** Which link was just copied, as `entryId:medium`, so the button can say so for a moment. */
  const [copied, setCopied] = useState<string | null>(null);
  const copyLink = (entryId: string, medium: string, link: string) => {
    void navigator.clipboard
      ?.writeText(link)
      .then(() => {
        setCopied(`${entryId}:${medium}`);
        setTimeout(() => setCopied(null), 1600);
      })
      .catch(() => window.prompt('Copy this link', link));
  };
  const [errs, setErrs] = useState<Record<string, string>>({});
  /**
   * Notes are NOT errors and must not be painted as them (D79). A queue that reached three weeks out
   * is worth saying and is not a failure; coral is the colour of something going wrong here, and
   * telling him a successful add went wrong is how a useful sentence gets learned as noise.
   */
  const [notes, setNotes] = useState<Record<string, string>>({});
  /**
   * THE DATE AND TIME BEING TYPED, PER ENTRY, BEFORE ANYTHING IS SAVED (D90).
   *
   * Marrs: "It is super disorienting because I'm looking at a line, and then I select the date. As
   * soon as I select the date, it disappears and moves somewhere else because it's sorting by date
   * and time... If I change the number 7 to 7:00 AM and I need to change that to 12:00, as soon as I
   * press 1, it goes to 1:00 AM and disappears."
   *
   * He has described the bug exactly. Every keystroke was a save: `<input type="time">` fires a
   * change on each digit, so typing 12:00 saves 01:00 on the way past, the board re-sorts by
   * scheduled_at, and the row he was editing leaves the screen mid-edit. The same applies to the
   * date: pick it and the row jumps before the time is even chosen.
   *
   * So a draft is held here, keyed by entry, and NOTHING is written until Set. Keyed rather than
   * held in the row because the row is a render function inside a list that re-sorts: state living
   * in the row would be thrown away by the very re-sort it caused.
   *
   * The draft is deleted once saved, so the inputs go back to following the entry itself and there
   * is only ever one answer to "what time is this post".
   */
  const [drafts, setDrafts] = useState<Record<string, { date: string; time: string }>>({});
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

  /** What the entry itself says, which is what the inputs show until he starts typing. */
  const savedTime = (e: CalendarEntry) => ({
    date: keyOf(e.scheduled_at),
    time: e.scheduled_at && e.scheduled_at.length >= 16 ? e.scheduled_at.slice(11, 16) : '',
  });

  const draftFor = (e: CalendarEntry) => drafts[e.entry_id] ?? savedTime(e);

  const editDraft = (entry: CalendarEntry, patch: { date?: string; time?: string }) => {
    const base = draftFor(entry);
    setDrafts((d) => ({ ...d, [entry.entry_id]: { ...base, ...patch } }));
    // A previous failure is no longer the story once he starts editing again.
    if (errs[entry.entry_id]) setErr(entry.entry_id, null);
  };

  /** Whether this row has an unsaved change worth a Set button. */
  const dirtyTime = (e: CalendarEntry) => {
    const d = drafts[e.entry_id];
    if (!d) return false;
    const was = savedTime(e);
    return d.date !== was.date || d.time !== was.time;
  };

  /**
   * COMMIT THE DRAFT. A date with no time is allowed and means "that day": publish then takes the
   * first posting time on it that has not passed (D83). An empty date clears the schedule, which is
   * how a post goes back to being an unscheduled draft.
   */
  const commitTime = async (entry: CalendarEntry) => {
    const d = draftFor(entry);
    const at = d.date ? (d.time ? `${d.date}T${d.time}` : d.date) : '';
    await setSchedule(entry, at);
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[entry.entry_id];
      return next;
    });
  };

  const setSchedule = async (entry: CalendarEntry, scheduledAt: string) => {
    setBusy(entry.entry_id);
    const prev = entries;
    const scheduled_at = scheduledAt || undefined;
    setEntries((es) =>
      es.map((e) => (e.entry_id === entry.entry_id ? { ...e, scheduled_at } : e))
    );
    try {
      const res = await fetch(entryUrl(entry.entry_id), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scheduled_at: scheduledAt || null }),
      });
      if (!res.ok) setEntries(prev);
    } catch {
      setEntries(prev);
    } finally {
      setBusy(null);
    }
  };

  /**
   * MAKE EVERGREEN (D100): put a published post on the repeating Metricool list for its stream and
   * network. The route answers with every step it took as sentences, printed under the entry,
   * because the autolist API is the least documented thing this console calls and the first press
   * on a real post is the proof.
   */
  const makeEvergreen = async (entry: CalendarEntry) => {
    if (
      !window.confirm(
        `Make this ${channelLabel(entry.channel)} post evergreen? It goes on a repeating Metricool list for ${streamLabel(entry.stream)} on ${channelLabel(entry.channel)}, posting once a day at a quiet time with two rewrites by April so the cycles differ. You can edit or switch the list off in Metricool at any time.`
      )
    ) {
      return;
    }
    setBusy(entry.entry_id);
    setErr(entry.entry_id, null);
    setNote(entry.entry_id, null);
    try {
      const res = await fetch(entryUrl(entry.entry_id) + '/evergreen', { method: 'POST' });
      const b = (await res.json().catch(() => null)) as
        | { ok?: boolean; steps?: string[]; error?: string; list_id?: string; item_ids?: string[] }
        | null;
      const said = (b?.steps ?? []).join(' ');
      if (!res.ok || !b?.ok) {
        setErr(entry.entry_id, `${b?.error ?? 'Could not make it evergreen.'}${said ? ` (${said})` : ''}`);
        return;
      }
      if (b.list_id) {
        const evergreen = { list_id: b.list_id, item_ids: b.item_ids ?? [], added_at: new Date().toISOString() };
        setEntries((es) => es.map((x) => (x.entry_id === entry.entry_id ? { ...x, evergreen } : x)));
      }
      setNote(entry.entry_id, said || 'Evergreen.');
    } catch {
      setErr(entry.entry_id, 'Network error. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const addToQueue = async (entry: CalendarEntry) => {
    if (
      /**
       * SAYS WHAT THE BUTTON DOES, because Marrs asked exactly that: "I want to know what that
       * feature does." The queue is this console's, not Metricool's (their API has no queue endpoint),
       * and it is per platform, and the times come from one editable place. Three facts, one line.
       */
      !window.confirm(
        `Add this ${channelLabel(entry.channel)} post to the ${channelLabel(entry.channel)} queue? It takes the next free ${channelLabel(entry.channel)} posting time for this stream, from the times set on Connect Metricool, and sends it to Metricool at that time.`
      )
    ) {
      return;
    }
    setBusy(entry.entry_id);
    setErr(entry.entry_id, null);
    setNote(entry.entry_id, null);
    try {
      const res = await fetch(entryUrl(entry.entry_id) + '/queue', { method: 'POST' });
      const b = (await res.json().catch(() => null)) as
        | { entry?: CalendarEntry; error?: string; warning?: string }
        | null;
      if (!res.ok) {
        setErr(entry.entry_id, b?.error ?? 'Could not add to the queue.');
        return;
      }
      if (b?.entry) setEntries((es) => es.map((x) => (x.entry_id === entry.entry_id ? b.entry! : x)));
      // The add succeeded, so anything it has to say is a note. Depth included.
      if (b?.warning) setNote(entry.entry_id, b.warning);
    } catch {
      setErr(entry.entry_id, 'Network error. Try again.');
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

  const setNote = (entryId: string, msg: string | null) =>
    setNotes((e) => {
      const n = { ...e };
      if (msg) n[entryId] = msg;
      else delete n[entryId];
      return n;
    });

  const setErr = (entryId: string, msg: string | null) =>
    setErrs((e) => {
      const n = { ...e };
      if (msg) n[entryId] = msg;
      else delete n[entryId];
      return n;
    });

  /**
   * SEND ONE ENTRY TO METRICOOL. `draft` sends it with autoPublish off (D67), which is the dry run
   * for the first ever real write: everything is proved except going public.
   *
   * The two confirms are deliberately different sentences. A draft says where it will and will not
   * appear, because the whole value of it is knowing nothing went out; a publish names the channel
   * and the date, because that is the thing that cannot be taken back.
   */
  const schedule = async (entry: CalendarEntry, draft = false) => {
    const when = entry.scheduled_at ? ` for ${entry.scheduled_at.slice(0, 10)}` : '';
    const ask = draft
      ? `Send this ${channelLabel(entry.channel)} post to Metricool as a DRAFT? It will appear in the Metricool planner and will NOT be published anywhere.`
      : `Schedule this ${channelLabel(entry.channel)} post${when}? It will be sent to Metricool and it WILL go out at that time.`;
    if (!window.confirm(ask)) {
      return;
    }
    setBusy(entry.entry_id);
    setErr(entry.entry_id, null);
    try {
      const res = await fetch(entryUrl(entry.entry_id) + '/schedule', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ draft }),
      });
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
    /**
     * FOUR STATES, and the fourth is the one that was missing (D85). A post whose time has gone said
     * "Scheduled" forever, which reads as still to come.
     *
     * Only computed after mount, like the today marker below: the server has no clock the browser
     * agrees with, and rendering a different label on each would be a hydration mismatch.
     */
    const gone = mounted && isScheduled && hasPassed(e.scheduled_at, e.timezone, new Date());
    const statusLabel = gone
      ? 'Posted'
      : e.status === 'published'
        ? 'Published'
        : e.status === 'scheduled'
          ? 'Scheduled'
          : e.scheduled_at
            ? 'Planned'
            : 'Draft';
    const statusClass = gone
      ? s.stPosted
      : isScheduled
        ? s.stScheduled
        : e.scheduled_at
          ? s.stPlanned
          : s.stDraft;
    const metricoolSupported = metricoolNetwork(e.channel) !== null;
    /** The draft, not the entry: nothing is saved until Set (D90). */
    const draft = draftFor(e);
    const dateVal = draft.date;
    const timeVal = draft.time;
    const unsaved = dirtyTime(e);

    return (
      <div
        key={e.entry_id}
        className={`${s.entry} ${gone ? s.entryGone : ''}`}
        data-busy={busy === e.entry_id}
      >
        <span className={s.entryIcon} title={channelLabel(e.channel)}>
          <PlatformIcon channel={e.channel} size={20} title={channelLabel(e.channel)} />
        </span>
        <div className={s.entryMain}>
          <div className={s.entryTop}>
            <span className={s.entryTitle}>{e.title}</span>
            <span className={s.entryStream}>{streamLabel(e.stream)}</span>
            <span className={s.entryChannel}>{channelLabel(e.channel)}</span>
            <span
              className={`${s.entryStatus} ${statusClass}`}
              title={
                gone
                  ? 'Its scheduled time has passed. Metricool accepted it, and nothing here has confirmed the platform published it yet.'
                  : undefined
              }
            >
              {statusLabel}
            </span>
          </div>
          <p className={s.entryCopy}>{e.post_copy}</p>
          {/* THE POST'S OWN LINK (D96), with the delivery variants. Copy, never click: the point of
              the link is to be pasted where the viewer will find it (the ManyChat flow, a reply, a
              description), and every copy carries this entry's id so the click comes back to it. */}
          {e.link ? (
            <div className={s.entryTrack}>
              <span className={s.entryTrackLabel}>
                {labelForUseCase(e.use_case)}
                {e.first_comment === e.link ? ' · link goes in the first comment' : ''}
              </span>
              <span className={s.entryTrackBtns}>
                {LINK_MEDIA.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`${s.copyBtn} ${copied === `${e.entry_id}:${m.id}` ? s.copyBtnDone : ''}`}
                    title={`${m.hint} Copies the link labelled "${m.id}".`}
                    onClick={() => copyLink(e.entry_id, m.id, withMedium(e.link ?? '', m.id))}
                  >
                    {copied === `${e.entry_id}:${m.id}` ? 'Copied' : `Copy · ${m.label}`}
                  </button>
                ))}
              </span>
            </div>
          ) : null}
          <div className={s.entryActions}>
            <label className={s.dateLabel}>
              Date
              <input
                type="date"
                className={s.dateInput}
                value={dateVal}
                onChange={(ev) => editDraft(e, { date: ev.target.value })}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' && unsaved) void commitTime(e);
                }}
                disabled={busy === e.entry_id || isScheduled}
              />
            </label>
            <label className={s.dateLabel}>
              Time
              <input
                type="time"
                className={s.dateInput}
                value={timeVal}
                onChange={(ev) => editDraft(e, { time: ev.target.value })}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' && unsaved) void commitTime(e);
                }}
                disabled={busy === e.entry_id || isScheduled || !dateVal}
              />
            </label>
            {/* SET, and only when there is something to set (D90). Its absence is the signal that
                the row on screen and the row in the store agree. */}
            {unsaved ? (
              <button
                type="button"
                className={s.setBtn}
                onClick={() => void commitTime(e)}
                disabled={busy === e.entry_id}
                title={
                  dateVal
                    ? timeVal
                      ? `Set this post to ${dateVal} at ${timeVal}`
                      : `Set this post to ${dateVal}, at the first free posting time that day`
                    : 'Clear the date and put this back with the unscheduled drafts'
                }
              >
                {busy === e.entry_id ? 'Setting…' : dateVal ? 'Set' : 'Clear date'}
              </button>
            ) : null}
            <Link className={s.entryLink} href={`/console/marketing/piece/${e.piece_id}`}>
              Open piece
            </Link>
            {e.metricool_url ? (
              <a className={s.entryLink} href={e.metricool_url} target="_blank" rel="noreferrer">
                View in Metricool
              </a>
            ) : null}
            {/* EVERGREEN (D100), offered once the platform has the post (a public url, or it is
                marked published) and it went through Metricool. A second press is a no-op. */}
            {(e.public_url || e.status === 'published') && metricoolSupported && e.publish_mode !== 'manual' ? (
              e.evergreen ? (
                <span className={s.entryLinkMuted} title={`On Metricool autolist ${e.evergreen.list_id}, ${e.evergreen.item_ids.length} item${e.evergreen.item_ids.length === 1 ? '' : 's'}.`}>
                  Evergreen ✓
                </span>
              ) : (
                <button
                  type="button"
                  className={s.queueBtn}
                  onClick={() => makeEvergreen(e)}
                  disabled={busy === e.entry_id}
                  title="Put this post on a repeating Metricool list for this stream and network."
                >
                  {busy === e.entry_id ? 'Working…' : 'Make evergreen'}
                </button>
              )
            ) : null}
            {!isScheduled && metricoolSupported ? (
              <>
                {/* EVERY ACTION WAITS FOR SET (D90). "Schedule at set time" means the time in the
                    store, so offering it while the row shows a different one is offering to publish
                    at a time he can see and did not choose. Add to queue would silently discard the
                    draft instead. One rule: the row has to agree with the store before it can act. */}
                <button
                  type="button"
                  className={s.queueBtn}
                  onClick={() => addToQueue(e)}
                  disabled={busy === e.entry_id || unsaved}
                  title={
                    unsaved
                      ? 'Press Set first, or clear the date, so this row and the calendar agree'
                      : 'Schedule at the next ideal time for this brand'
                  }
                >
                  Add to queue
                </button>
                {/* THE DRY RUN (D67), and it sits BEFORE the real button on purpose: the first
                    thing you should be able to do to a post is prove the pipe works without
                    putting anything in public. Needs a time, because the time and its timezone
                    are half of what the dry run is checking. */}
                {e.scheduled_at ? (
                  <button
                    type="button"
                    className={s.queueBtn}
                    onClick={() => schedule(e, true)}
                    disabled={busy === e.entry_id || unsaved}
                    title={
                      unsaved
                        ? 'Press Set first: this would send the time already saved, not the one shown'
                        : 'Send it to the Metricool planner without publishing it'
                    }
                  >
                    Send as draft
                  </button>
                ) : null}
                {e.scheduled_at ? (
                  <button
                    type="button"
                    className={s.scheduleBtn}
                    onClick={() => schedule(e)}
                    disabled={busy === e.entry_id || unsaved}
                    title={
                      unsaved
                        ? 'Press Set first: this would publish at the time already saved, not the one shown'
                        : undefined
                    }
                  >
                    Schedule at set time
                  </button>
                ) : null}
              </>
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
          {notes[e.entry_id] ? <p className={s.entryNote}>{notes[e.entry_id]}</p> : null}
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
    /**
     * THE TODAY LINE (D85). Marrs: "There just needs to be a clear line that says today."
     *
     * It goes before the first day that is not already past, which puts it after the history and
     * before what is coming even when today itself has no posts. Days behind it are dimmed rather
     * than hidden: he asked for them out of the way, not gone, and a calendar that forgets what it
     * published is no use for judging what to publish next.
     *
     * `todayKey` is empty until mount, so the server renders no divider and no dimming and the
     * browser adds both. Same discipline as the month view's today cell.
     */
    const groups = [...days.entries()];
    const firstAhead = todayKey ? groups.findIndex(([day]) => day >= todayKey) : -1;

    return (
      <div className={s.board}>
        {groups.map(([day, items], ix) => (
          <div key={day}>
            {ix === firstAhead ? (
              <div className={s.todayLine}>
                <span className={s.todayMark}>today</span>
                <span className={s.todayDate}>{prettyDay(todayKey)}</span>
              </div>
            ) : null}
            <section className={`${s.dayGroup} ${todayKey && day < todayKey ? s.dayPast : ''}`}>
              <h2 className={s.dayHead}>
                {prettyDay(day)}
                {day === todayKey ? <span className={s.dayToday}>today</span> : null}
              </h2>
              <div className={s.entries}>{items.map(renderEntry)}</div>
            </section>
          </div>
        ))}
        {/* Everything on the board is behind us: the line still belongs, at the end, because it is
            the answer to "what is coming up" as much as it is a divider. */}
        {firstAhead === -1 && groups.length > 0 ? (
          <div className={s.todayLine}>
            <span className={s.todayMark}>today</span>
            <span className={s.todayDate}>
              {prettyDay(todayKey)} · nothing scheduled from here on
            </span>
          </div>
        ) : null}
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

      {prepared ? (
        <p className={s.preparedNote}>
          {prepared} post{prepared === 1 ? '' : 's'} prepared. If that is fewer than the platforms
          you ticked, open the piece and check they are all still on.
        </p>
      ) : null}

      {entries.length === 0 ? (
        <p className={s.empty}>
          Nothing scheduled yet. Approve a post and hit &ldquo;Prepare posts for channels&rdquo;
          to add it here. Already have a finished video or image? Add it to a stream&rsquo;s media
          library and press &ldquo;Post this&rdquo;.
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
