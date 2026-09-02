'use client';

/**
 * Edit an existing library image with AI (add text, restyle) via Nano Banana
 * (OpenRouter). Pick a source image from this stream's library, describe the
 * change, apply it, then save the result back into the library (through the same
 * ./add route generated images use). Separate from the Generate panel, which makes
 * NEW images from a text prompt; this edits one you already have.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MediaAsset } from '@/lib/marketing/media-store';
import s from './media.module.css';

export function MediaEdit({
  stream: _stream,
  images,
}: {
  stream: string;
  images: MediaAsset[];
}) {
  const router = useRouter();
  const base = () => window.location.pathname.replace(/\/+$/, '');

  const [sourceUrl, setSourceUrl] = useState('');
  const [prompt, setPrompt] = useState('');
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
    if (!sourceUrl || !prompt.trim() || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setSaved(false);
    try {
      const res = await fetch(base() + '/edit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ imageUrl: sourceUrl, prompt: prompt.trim() }),
      });
      const b = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !b?.url) {
        setError(b?.error ?? 'Editing failed.');
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
    const label = prompt.trim().slice(0, 90) || 'Edited image';
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
      <h2 className={s.genTitle}>Edit an Image</h2>
      <p className={s.genNote}>
        Pick an image from this stream&rsquo;s library, then tell the model what to
        change, for example adding words onto it. It uses Nano Banana (Google), which
        renders text cleanly, and you can save the result back here.
      </p>

      {images.length === 0 ? (
        <div className={s.soulEmpty}>
          <p className={s.genNote}>
            No images in this stream&rsquo;s library yet. Add one first, then you can edit it.
          </p>
          <button type="button" className={s.addImageBtn} onClick={goAddImage}>
            + Add images
          </button>
        </div>
      ) : (
        <>
          <span className={s.refLabel}>Pick the image to edit</span>
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
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={'e.g. Add the text "Strip the AI out first" across the top in large bold white letters'}
            aria-label="Edit instruction"
            disabled={busy}
          />

          <div className={s.genControls}>
            <button
              type="button"
              className={s.genBtn}
              onClick={apply}
              disabled={busy || !sourceUrl || !prompt.trim()}
            >
              {busy ? 'Editing…' : 'Apply edit'}
            </button>
            {!sourceUrl ? <span className={s.genNote}>Select an image above first.</span> : null}
          </div>
        </>
      )}

      {error ? <p className={s.genError}>{error}</p> : null}

      {result ? (
        <div className={s.genResults}>
          <div className={s.genResult}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result} alt="edited result" className={s.genResultImg} loading="lazy" />
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
