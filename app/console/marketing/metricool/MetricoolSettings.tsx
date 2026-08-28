'use client';

/**
 * Metricool config (D24, rebuilt D79): map each stream to a brand, then set THE QUEUE.
 *
 * Marrs: "for each of the brands, dictate on each of the platforms what time and how many posts per
 * day to do on each platform, and then it just adds to that queue. That's ideally what I'd like, so
 * I can set that once and just go add to queue, add to queue."
 *
 * So the times are per PLATFORM now, not one list per stream. The old single "Ideal times" field was
 * the second of two slot tables and nothing reads it any more.
 *
 * THE LIST IS THE POSTS-PER-DAY ANSWER. Two times on LinkedIn means two LinkedIn posts a day. There
 * is no separate count field, because a count and a list of times can disagree and then something
 * has to decide which one wins.
 *
 * MODE IS HERE TOO, because it is the setting that most needs explaining and had nowhere to be seen:
 * his own LinkedIn is hand-posted by default (D41), so a LinkedIn post on his lane never goes through
 * Metricool at all, and without this control that behaviour looks like a bug.
 */

import { useState } from 'react';
import type { MetricoolBrand } from '@/lib/marketing/metricool-client';
import type { BrandMap } from '@/lib/marketing/metricool-config-store';
import { channelLabel } from '@/lib/marketing/channels';
import s from './metricool.module.css';

/** The four we post to, in the order the kit uses, so this page reads like Gate 3. */
const QUEUE_NETWORKS = ['linkedin', 'instagram', 'tiktok', 'youtube'] as const;

/** Per stream: the zone, then one comma-separated time list and one mode per network. */
type LaneDraft = {
  timezone: string;
  times: Record<string, string>;
  modes: Record<string, 'auto' | 'manual'>;
};
type ScheduleDraft = Record<string, LaneDraft>;

export function MetricoolSettings({
  streams,
  brands,
  initialMap,
  initialLanes,
}: {
  streams: { id: string; label: string }[];
  brands: MetricoolBrand[];
  initialMap: BrandMap;
  /** The lane schedules, read server-side: the one table the wave and the queue both use. */
  initialLanes: Record<string, { timezone: string; channels: Record<string, string[]>; modes: Record<string, 'auto' | 'manual'> }>;
}) {
  const buildDraft = (): ScheduleDraft => {
    const d: ScheduleDraft = {};
    for (const st of streams) {
      const cfg = initialLanes[st.id];
      const times: Record<string, string> = {};
      const modes: Record<string, 'auto' | 'manual'> = {};
      for (const n of QUEUE_NETWORKS) {
        times[n] = (cfg?.channels?.[n] ?? []).join(', ');
        modes[n] = cfg?.modes?.[n] ?? 'auto';
      }
      d[st.id] = { timezone: cfg?.timezone ?? 'Australia/Sydney', times, modes };
    }
    return d;
  };

  const [map, setMap] = useState<BrandMap>(initialMap);
  const [draft, setDraft] = useState<ScheduleDraft>(buildDraft);
  const [savedMap, setSavedMap] = useState<BrandMap>(initialMap);
  const [savedDraft, setSavedDraft] = useState<ScheduleDraft>(buildDraft);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const dirty =
    JSON.stringify(map) !== JSON.stringify(savedMap) ||
    JSON.stringify(draft) !== JSON.stringify(savedDraft);

  const setStreamBrand = (streamId: string, blogId: string) => {
    setMap((m) => {
      const next = { ...m };
      if (blogId) next[streamId] = blogId;
      else delete next[streamId];
      return next;
    });
    if (state !== 'idle') setState('idle');
  };
  const setTimezone = (streamId: string, value: string) => {
    setDraft((d) => ({ ...d, [streamId]: { ...d[streamId], timezone: value } }));
    if (state !== 'idle') setState('idle');
  };
  const setTimes = (streamId: string, net: string, value: string) => {
    setDraft((d) => ({
      ...d,
      [streamId]: { ...d[streamId], times: { ...d[streamId].times, [net]: value } },
    }));
    if (state !== 'idle') setState('idle');
  };
  const setMode = (streamId: string, net: string, value: 'auto' | 'manual') => {
    setDraft((d) => ({
      ...d,
      [streamId]: { ...d[streamId], modes: { ...d[streamId].modes, [net]: value } },
    }));
    if (state !== 'idle') setState('idle');
  };

  const save = async () => {
    if (state === 'saving' || !dirty) return;
    setState('saving');
    setError(null);
    /**
     * Sent per network. The store normalises each list (valid HH:mm only, sorted, deduped) so a
     * typo here cannot persist as a slot, and an emptied list falls back to that network's defaults
     * rather than to no posting at all.
     */
    const schedule: Record<
      string,
      { timezone: string; channels: Record<string, string[]>; modes: Record<string, 'auto' | 'manual'> }
    > = {};
    for (const st of streams) {
      const row = draft[st.id];
      const channels: Record<string, string[]> = {};
      for (const n of QUEUE_NETWORKS) {
        channels[n] = row.times[n]
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
      }
      schedule[st.id] = { timezone: row.timezone.trim(), channels, modes: row.modes };
    }
    try {
      const url = window.location.pathname.replace(/\/+$/, '') + '/save';
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ map, schedule }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(b?.error ?? 'Could not save.');
        setState('error');
        return;
      }
      /**
       * ADOPT WHAT WAS STORED, not what was typed. The store rejects a malformed time and falls back
       * to a network's defaults when its list comes in empty, so echoing its answer back into the
       * fields is what makes those corrections visible rather than a surprise on the next visit.
       */
      const body = (await res.json().catch(() => null)) as {
        stored?: Record<string, { timezone: string; channels: Record<string, string[]>; modes: Record<string, string> }>;
      } | null;
      const next = body?.stored ? adopt(draft, body.stored) : draft;
      setDraft(next);
      setSavedMap(map);
      setSavedDraft(next);
      setState('saved');
    } catch {
      setError('Network error. Try again.');
      setState('error');
    }
  };

  return (
    <div className={s.mapper}>
      <section>
        <h2 className={s.sectionTitle}>Brand mapping</h2>
        <div className={s.rows}>
          {streams.map((st) => (
            <div key={st.id} className={s.row}>
              <span className={s.streamName}>{st.label}</span>
              <select
                className={s.select}
                value={map[st.id] ?? ''}
                onChange={(e) => setStreamBrand(st.id, e.target.value)}
                aria-label={`Metricool brand for ${st.label}`}
              >
                <option value="">— not connected —</option>
                {brands.map((b) => (
                  <option key={b.blogId} value={b.blogId}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className={s.sectionTitle}>The queue</h2>
        <p className={s.sectionHint}>
          The times each platform posts at, per stream. Set it once and &ldquo;Add to queue&rdquo;
          fills the next free slot, then the next. <strong>The number of times is the number of
          posts a day</strong>, so two times on LinkedIn means two LinkedIn posts a day. 24-hour,
          comma separated. Timezone should match what the brand is set to in Metricool.
        </p>
        <div className={s.rows}>
          {streams.map((st) => (
            <div key={st.id} className={s.rowStacked}>
              <span className={s.streamName}>{st.label}</span>
              <div className={s.fields}>
                <label className={s.fieldLabel}>
                  Timezone
                  <input
                    className={s.input}
                    value={draft[st.id].timezone}
                    onChange={(e) => setTimezone(st.id, e.target.value)}
                    placeholder="Australia/Sydney"
                  />
                </label>
                {QUEUE_NETWORKS.map((net) => (
                  <label key={net} className={s.fieldLabel}>
                    {channelLabel(net)}
                    <span className={s.netRow}>
                      <input
                        className={s.input}
                        value={draft[st.id].times[net]}
                        onChange={(e) => setTimes(st.id, net, e.target.value)}
                        placeholder="08:30, 12:30"
                      />
                      {/* MODE, where it can be seen. His own LinkedIn is hand-posted by default
                          (D41), and without this control that reads as a bug rather than a choice. */}
                      <select
                        className={s.modeSelect}
                        value={draft[st.id].modes[net]}
                        onChange={(e) => setMode(st.id, net, e.target.value as 'auto' | 'manual')}
                        aria-label={`${channelLabel(net)} posting mode for ${st.label}`}
                      >
                        <option value="auto">Metricool posts it</option>
                        <option value="manual">I post it by hand</option>
                      </select>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className={s.actions}>
        <button type="button" className={s.save} onClick={save} disabled={!dirty || state === 'saving'}>
          {state === 'saving' ? 'Saving…' : dirty ? 'Save' : state === 'saved' ? 'Saved ✓' : 'Saved'}
        </button>
        {error ? <span className={s.err}>{error}</span> : null}
      </div>
    </div>
  );
}

/**
 * Fold the server's stored schedule back over the draft.
 *
 * Only lanes the server reported are touched, so a partial response cannot blank a row the operator
 * can still see on screen.
 */
function adopt(
  draft: ScheduleDraft,
  stored: Record<string, { timezone: string; channels: Record<string, string[]>; modes: Record<string, string> }>
): ScheduleDraft {
  const out: ScheduleDraft = { ...draft };
  for (const [lane, cfg] of Object.entries(stored)) {
    if (!out[lane]) continue;
    const times: Record<string, string> = { ...out[lane].times };
    const modes: Record<string, 'auto' | 'manual'> = { ...out[lane].modes };
    for (const n of QUEUE_NETWORKS) {
      if (cfg.channels?.[n]) times[n] = cfg.channels[n].join(', ');
      if (cfg.modes?.[n]) modes[n] = cfg.modes[n] === 'manual' ? 'manual' : 'auto';
    }
    out[lane] = { timezone: cfg.timezone || out[lane].timezone, times, modes };
  }
  return out;
}
