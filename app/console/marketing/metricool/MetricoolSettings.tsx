'use client';

/**
 * Metricool config (D24): (1) map each stream to a Metricool brand, and (2) set
 * each stream's posting timezone + ideal time slots that power "Add to queue".
 * One Save writes both. Timezone should match what the brand is set to in
 * Metricool (default Australia/Sydney), so scheduled times display correctly.
 */

import { useState } from 'react';
import type { MetricoolBrand } from '@/lib/marketing/metricool-client';
import type { BrandMap, PostingSchedule } from '@/lib/marketing/metricool-config-store';
import { defaultStreamSchedule } from '@/lib/marketing/posting-schedule';
import s from './metricool.module.css';

type ScheduleDraft = Record<string, { timezone: string; slotsText: string }>;

export function MetricoolSettings({
  streams,
  brands,
  initialMap,
  initialSchedule,
}: {
  streams: { id: string; label: string }[];
  brands: MetricoolBrand[];
  initialMap: BrandMap;
  initialSchedule: PostingSchedule;
}) {
  const buildDraft = (): ScheduleDraft => {
    const d: ScheduleDraft = {};
    for (const st of streams) {
      const cfg = initialSchedule[st.id] ?? defaultStreamSchedule();
      d[st.id] = { timezone: cfg.timezone, slotsText: cfg.slots.join(', ') };
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
  const setField = (streamId: string, key: 'timezone' | 'slotsText', value: string) => {
    setDraft((d) => ({ ...d, [streamId]: { ...d[streamId], [key]: value } }));
    if (state !== 'idle') setState('idle');
  };

  const save = async () => {
    if (state === 'saving' || !dirty) return;
    setState('saving');
    setError(null);
    const schedule: PostingSchedule = {};
    for (const st of streams) {
      const row = draft[st.id];
      schedule[st.id] = {
        timezone: row.timezone.trim(),
        slots: row.slotsText
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      };
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
      setSavedMap(map);
      setSavedDraft(draft);
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
        <h2 className={s.sectionTitle}>Posting times</h2>
        <p className={s.sectionHint}>
          Timezone should match what the brand is set to in Metricool. Ideal times feed the
          &ldquo;Add to queue&rdquo; button, filled next-in-line. Times are 24-hour, comma separated.
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
                    onChange={(e) => setField(st.id, 'timezone', e.target.value)}
                    placeholder="Australia/Sydney"
                  />
                </label>
                <label className={s.fieldLabel}>
                  Ideal times
                  <input
                    className={s.input}
                    value={draft[st.id].slotsText}
                    onChange={(e) => setField(st.id, 'slotsText', e.target.value)}
                    placeholder="09:00, 13:00, 17:00"
                  />
                </label>
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
