'use client';

/**
 * Add brand-standard TEXT to a library image, rendered deterministically (not by
 * an AI model) so the font, colours, size and placement are exact and identical
 * every time. Pick an image, type the words (wrap *words* in asterisks to
 * highlight them, line breaks control wrapping), click WHERE the text goes on the
 * image itself (placement reads differently per aspect ratio, so it's visual),
 * pick a size, and Space Grotesk + your brand colours are composited on precisely.
 * Save back to the library. For restyles/background changes use the AI "Edit an
 * image" panel instead.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MediaAsset } from '@/lib/marketing/media-store';
import { BRAND_COLORS } from '@/lib/marketing/brand-colors';
import s from './media.module.css';

type Position = 'top' | 'upper' | 'centre' | 'lower' | 'bottom';
type HAlign = 'left' | 'centre' | 'right';
type Size = 'small' | 'medium' | 'large';

// Anchor coordinates (percent of the preview) roughly matching the render's anchors.
const H_ANCHORS: { id: HAlign; x: number }[] = [
  { id: 'left', x: 16 },
  { id: 'centre', x: 50 },
  { id: 'right', x: 84 },
];
const V_ANCHORS: { id: Position; y: number }[] = [
  { id: 'top', y: 9 },
  { id: 'upper', y: 27 },
  { id: 'centre', y: 50 },
  { id: 'lower', y: 73 },
  { id: 'bottom', y: 91 },
];
const SIZES: { id: Size; label: string }[] = [
  { id: 'small', label: 'Small' },
  { id: 'medium', label: 'Medium' },
  { id: 'large', label: 'Large' },
];

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
  const [position, setPosition] = useState<Position>('centre');
  const [hAlign, setHAlign] = useState<HAlign>('centre');
  const [size, setSize] = useState<Size>('medium');
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
        body: JSON.stringify({
          imageUrl: sourceUrl,
          text: text.trim(),
          position,
          hAlign,
          size,
          baseColor,
          highlightColor,
        }),
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
        is rendered in code, not by an AI model, so the font, colour, size and
        placement are precise). Wrap <strong>*words*</strong> in asterisks to
        highlight them, and use line breaks to control wrapping.
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

          {sourceUrl ? (
            <div className={s.placeBlock}>
              <span className={s.refLabel}>Placement (click where the text goes)</span>
              <div className={s.placeWrap}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sourceUrl} alt="selected" className={s.placeImg} />
                <div className={s.placeGrid}>
                  {V_ANCHORS.flatMap((v) =>
                    H_ANCHORS.map((h) => {
                      const on = position === v.id && hAlign === h.id;
                      return (
                        <button
                          key={`${v.id}-${h.id}`}
                          type="button"
                          className={`${s.placeDot} ${on ? s.placeDotOn : ''}`}
                          style={{ left: `${h.x}%`, top: `${v.y}%` }}
                          onClick={() => {
                            setPosition(v.id);
                            setHAlign(h.id);
                          }}
                          aria-label={`${v.id} ${h.id}`}
                          title={`${v.id} ${h.id}`}
                          disabled={busy}
                        />
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className={s.genNote}>Select an image above to place the text.</p>
          )}

          <div className={s.genControls}>
            <label className={s.genField}>
              <span>Size</span>
              <select value={size} onChange={(e) => setSize(e.target.value as Size)} disabled={busy}>
                {SIZES.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={s.genField}>
              <span>Text colour</span>
              <select
                value={baseColor}
                onChange={(e) => setBaseColor(e.target.value)}
                disabled={busy}
                aria-label="Text colour"
              >
                {BRAND_COLORS.map((c) => (
                  <option key={c.id} value={c.hex}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={s.genField}>
              <span>Highlight colour</span>
              <select
                value={highlightColor}
                onChange={(e) => setHighlightColor(e.target.value)}
                disabled={busy}
                aria-label="Highlight colour"
              >
                {BRAND_COLORS.map((c) => (
                  <option key={c.id} value={c.hex}>
                    {c.name}
                  </option>
                ))}
              </select>
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
