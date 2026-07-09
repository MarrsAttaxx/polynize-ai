'use client';

/**
 * Map each stream to a Metricool brand (D24). A dropdown per stream, saved as
 * team config. The stream's posts then schedule under the chosen brand's blogId.
 */

import { useState } from 'react';
import type { MetricoolBrand } from '@/lib/marketing/metricool-client';
import type { BrandMap } from '@/lib/marketing/metricool-config-store';
import s from './metricool.module.css';

export function MetricoolSettings({
  streams,
  brands,
  initialMap,
}: {
  streams: { id: string; label: string }[];
  brands: MetricoolBrand[];
  initialMap: BrandMap;
}) {
  const [map, setMap] = useState<BrandMap>(initialMap);
  const [saved, setSaved] = useState<BrandMap>(initialMap);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(map) !== JSON.stringify(saved);

  const setStreamBrand = (streamId: string, blogId: string) => {
    setMap((m) => {
      const next = { ...m };
      if (blogId) next[streamId] = blogId;
      else delete next[streamId];
      return next;
    });
    if (state !== 'idle') setState('idle');
  };

  const save = async () => {
    if (state === 'saving' || !dirty) return;
    setState('saving');
    setError(null);
    try {
      const url = window.location.pathname.replace(/\/+$/, '') + '/save';
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ map }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(b?.error ?? 'Could not save.');
        setState('error');
        return;
      }
      setSaved(map);
      setState('saved');
    } catch {
      setError('Network error. Try again.');
      setState('error');
    }
  };

  return (
    <div className={s.mapper}>
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
      <div className={s.actions}>
        <button type="button" className={s.save} onClick={save} disabled={!dirty || state === 'saving'}>
          {state === 'saving' ? 'Saving…' : dirty ? 'Save mapping' : state === 'saved' ? 'Saved ✓' : 'Saved'}
        </button>
        {error ? <span className={s.err}>{error}</span> : null}
      </div>
    </div>
  );
}
