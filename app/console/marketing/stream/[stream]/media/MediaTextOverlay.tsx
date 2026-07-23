'use client';

/**
 * Add brand-standard TEXT to a library image, rendered deterministically (not by
 * an AI model) so the font, colours, position and highlight are exact and identical
 * every time. Pick an image, type the words (wrap *words* in asterisks to highlight
 * them, use line breaks to control wrapping), choose a position, and the fixed
 * Space Grotesk font + your colours are composited on precisely. Save back to the
 * library. For restyles/background changes use the AI "Edit an image" panel instead.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MediaAsset } from '@/lib/marketing/media-store';
import s from './media.module.css';

const POSITIONS = [
  { id: 'top', label: 'Top' },
  { id: 'centre', label: 'Centre' },
  { id: 'bottom', label: 'Bottom' },
] as const;

export function MediaTextOverlay({
  stream: _stream,
  images,
}: {
  stream: string;
  images: MediaAsset[];
}) {
  const router = useRouter();
  const base = () => window.location.pathname.replace(/\/+$/, '');

  const [sourceUrl, setSourceUrl] = useState('');
  const [text, setText] = useState('');
  const [position, setPosition] = useState<'top' | 'centre' | 'bottom'>('centre');
  const [baseColor, setBaseColor] = useState('#ffffff');
  const [highlightColor, setHighlightColor] = useState('#69fccb');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const goAddImage = () => {
    const el = document.getElementById('media-add');
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.querySelector('input')?.focus({ preventScroll: true });
  };

  const apply = async () => {
    if (!sourceUrl || !text.trim() || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setSaved(false);
    try {
      const res = await fetch(base() + '/overlay', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ imageUrl: sourceUrl, text: text.trim(), position, baseColor, highlightColor }),
      });
      const b = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !b?.url) {
        setError(b?.error ?? 'Overlay failed.');
        return;
      }
      setResult(b.url);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!result || saved || saving) return;
    setSaving(true);
    const label = text.replace(/\*/g, '').trim().slice(0, 90) || 'Text overlay';
    try {
      const res = await fetch(base() + '/add', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: result, kind: 'image', label }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(b?.error ?? 'Could not save to library.');
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError('Network error saving to library.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={s.genPanel}>
      <h2 className={s.genTitle}>Add text to an image (brand-standard)</h2>
      <p className={s.genNote}>
        Renders text onto a library image exactly, in Space Grotesk, every time (this
        is rendered in code, not by an AI model, so the font, colour, and placement
        are precise). Wrap <strong>*words*</strong> in asterisks to highlight them, and
        use line breaks to control wrapping.
      </p>

      {images.length === 0 ? (
        <div className={s.soulEmpty}>
          <p className={s.genNote}>
            No images in this stream&rsquo;s library yet. Add one first, then you can add text to it.
          </p>
          <button type="button" className={s.addImageBtn} onClick={goAddImage}>
            + Add images
          </button>
        </div>
      ) : (
        <>
          <span className={s.refLabel}>Pick the image</span>
          <div className={s.photoPick}>
            {images.map((im) => (
              <button
                key={im.media_id}
                type="button"
                className={`${s.photoTile} ${sourceUrl === im.url ? s.photoOn : ''}`}
                onClick={() => setSourceUrl(sourceUrl === im.url ? '' : im.url)}
                title={im.label}
                disabled={busy}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im.url} alt={im.label} loading="lazy" />
              </button>
            ))}
          </div>

          <textarea
            className={s.genPrompt}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'e.g. YOUR *CEO* NEEDS\nTO KNOW THIS'}
            aria-label="Overlay text"
            disabled={busy}
          />

          <div className={s.genControls}>
            <label className={s.genField}>
              <span>Position</span>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value as 'top' | 'centre' | 'bottom')}
                disabled={busy}
              >
                {POSITIONS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={s.genField}>
              <span>Text colour</span>
              <input
                type="color"
                value={baseColor}
                onChange={(e) => setBaseColor(e.target.value)}
                disabled={busy}
                aria-label="Text colour"
              />
            </label>
            <label className={s.genField}>
              <span>Highlight colour</span>
              <input
                type="color"
                value={highlightColor}
                onChange={(e) => setHighlightColor(e.target.value)}
                disabled={busy}
                aria-label="Highlight colour"
              />
            </label>
            <button
              type="button"
              className={s.genBtn}
              onClick={apply}
              disabled={busy || !sourceUrl || !text.trim()}
            >
              {busy ? 'Rendering…' : 'Add text'}
            </button>
          </div>
          {!sourceUrl ? <p className={s.genNote}>Select an image above first.</p> : null}
        </>
      )}

      {error ? <p className={s.genError}>{error}</p> : null}

      {result ? (
        <div className={s.genResults}>
          <div className={s.genResult}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result} alt="text overlay result" className={s.genResultImg} loading="lazy" />
            <button
              type="button"
              className={s.genSaveBtn}
              onClick={save}
              disabled={saved || saving}
            >
              {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save to library'}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
