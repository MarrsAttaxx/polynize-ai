'use client';

/**
 * The Output-plan form (D19/D23). Pre-filled from the concept + stream so the
 * common case is one tap ("Create outputs"). Built formats are selectable with
 * per-format platform chips; coming formats show but are disabled. Posts to
 * ./plan (path-relative so it works on pam.polynize.ai and www/console) and
 * routes to the created output (or back to the concept hub for several).
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FormatDef, OutputPlanDefaults } from '@/lib/marketing/output-plan';
import s from './plan.module.css';

function channelLabel(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

export function OutputPlanForm({
  formats,
  icps,
  defaults,
}: {
  formats: FormatDef[];
  icps: { id: string; label: string }[];
  defaults: OutputPlanDefaults;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(defaults.formats));
  const [platforms, setPlatforms] = useState<Record<string, string[]>>(defaults.platforms);
  const [icp, setIcp] = useState<string>(defaults.icp ?? '');
  const [pillar, setPillar] = useState<string>(defaults.pillar ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const built = useMemo(() => formats.filter((f) => f.module === 'built'), [formats]);
  const coming = useMemo(() => formats.filter((f) => f.module === 'coming'), [formats]);

  const toggleFormat = (f: FormatDef) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(f.id)) {
        next.delete(f.id);
      } else {
        next.add(f.id);
        // seed platforms to the format's channels when first ticked
        setPlatforms((p) => (p[f.id]?.length ? p : { ...p, [f.id]: f.channels.slice() }));
      }
      return next;
    });
  };

  const togglePlatform = (fmtId: string, channel: string) => {
    setPlatforms((prev) => {
      const cur = prev[fmtId] ?? [];
      const next = cur.includes(channel)
        ? cur.filter((c) => c !== channel)
        : [...cur, channel];
      return { ...prev, [fmtId]: next };
    });
  };

  const create = async () => {
    if (busy) return;
    const chosen = [...selected];
    if (chosen.length === 0) {
      setError('Pick at least one output.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const url = window.location.pathname.replace(/\/+$/, '') + '/create';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          formats: chosen,
          platforms,
          icp: icp || undefined,
          pillar: pillar.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(b?.error ?? 'Could not create the outputs.');
        setBusy(false);
        return;
      }
      const { target } = (await res.json()) as { target: string };
      router.push(target);
    } catch {
      setError('Network error. Try again.');
      setBusy(false);
    }
  };

  return (
    <div className={s.form}>
      <section className={s.group}>
        <h2 className={s.groupTitle}>Outputs</h2>
        <div className={s.formats}>
          {built.map((f) => {
            const on = selected.has(f.id);
            return (
              <div key={f.id} className={`${s.format} ${on ? s.formatOn : ''}`}>
                <label className={s.formatHead}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleFormat(f)}
                    className={s.check}
                  />
                  <span className={s.formatLabel}>{f.label}</span>
                  <span className={`${s.kind} ${s[`kind_${f.kind}`]}`}>{f.kind}</span>
                </label>
                {on && f.channels.length > 0 ? (
                  <div className={s.channels}>
                    {f.channels.map((c) => {
                      const active = (platforms[f.id] ?? []).includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          className={`${s.chip} ${active ? s.chipOn : ''}`}
                          onClick={() => togglePlatform(f.id, c)}
                        >
                          {channelLabel(c)}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {coming.length > 0 ? (
          <div className={s.coming}>
            <span className={s.comingLabel}>Coming soon</span>
            <div className={s.comingList}>
              {coming.map((f) => (
                <span key={f.id} className={s.comingItem}>
                  {f.label}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className={s.group}>
        <h2 className={s.groupTitle}>Audience (ICP)</h2>
        <select
          className={s.select}
          value={icp}
          onChange={(e) => setIcp(e.target.value)}
          aria-label="Ideal customer persona"
        >
          <option value="">No specific persona</option>
          {icps.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </section>

      <section className={s.group}>
        <h2 className={s.groupTitle}>Content pillar (optional)</h2>
        <input
          type="text"
          className={s.input}
          value={pillar}
          placeholder="e.g. Marrs Attacks, Show and Tell"
          onChange={(e) => setPillar(e.target.value)}
          aria-label="Content pillar"
        />
      </section>

      <div className={s.actions}>
        <button
          type="button"
          className={s.create}
          onClick={create}
          disabled={busy || selected.size === 0}
        >
          {busy ? 'Creating…' : 'Create outputs →'}
        </button>
        {error ? <span className={s.error}>{error}</span> : null}
      </div>
    </div>
  );
}
