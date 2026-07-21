'use client';

/**
 * Generate images with Higgsfield, inside the media library. Pick a model, write a
 * prompt (April sharpens it server-side), generate, then save the ones you want
 * into the library. For the Soul model you can attach a Soul ID (a trained person)
 * or a reference image, and set one up from the stream's own library photos.
 *
 * Options (live Soul styles + Soul IDs) are lazy-loaded on mount. Generated images
 * are saved via the existing ./add route; a save triggers router.refresh() so the
 * library grid below picks them up.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MediaAsset } from '@/lib/marketing/media-store';
import {
  IMAGE_MODELS,
  imageModelById,
  ASPECT_RATIOS,
  SOUL_SIZES,
} from '@/lib/marketing/higgsfield-models';
import s from './media.module.css';

type SoulStyle = { id: string; name: string };
type SoulIdOpt = { id: string; name: string; status: string };
type Options = { configured: boolean; soulStyles: SoulStyle[]; soulIds: SoulIdOpt[] };

export function MediaGenerate({
  stream,
  images,
}: {
  stream: string;
  images: MediaAsset[];
}) {
  const router = useRouter();
  const base = () => window.location.pathname.replace(/\/+$/, '');

  const [modelId, setModelId] = useState(IMAGE_MODELS[0]?.id ?? 'soul');
  const model = imageModelById(modelId);

  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<string>(ASPECT_RATIOS[0]);
  const [size, setSize] = useState<string>(SOUL_SIZES[0]?.id ?? '1152x2048');
  const [soulId, setSoulId] = useState('');
  const [styleId, setStyleId] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [batchSize, setBatchSize] = useState(1);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<string[]>([]);
  const [refinedPrompt, setRefinedPrompt] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [savingUrls, setSavingUrls] = useState<Set<string>>(new Set());

  const [options, setOptions] = useState<Options | null>(null);

  // Soul ID setup
  const [showSoulSetup, setShowSoulSetup] = useState(false);
  const [soulName, setSoulName] = useState('');
  const [soulPhotos, setSoulPhotos] = useState<string[]>([]);
  const [creatingSoul, setCreatingSoul] = useState(false);
  const [soulError, setSoulError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(base() + '/generate', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (!cancelled) {
          setOptions({
            configured: Boolean(d.configured),
            soulStyles: Array.isArray(d.soulStyles) ? d.soulStyles : [],
            soulIds: Array.isArray(d.soulIds) ? d.soulIds : [],
          });
        }
      })
      .catch(() => {
        if (!cancelled) setOptions({ configured: false, soulStyles: [], soulIds: [] });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generate = async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setError(null);
    setResults([]);
    setRefinedPrompt(null);
    try {
      const payload: Record<string, unknown> = { modelId, prompt: prompt.trim() };
      if (model?.sizing === 'aspect_ratio') {
        payload.aspectRatio = aspectRatio;
      } else {
        payload.size = size;
        payload.batchSize = batchSize;
        if (model?.supportsSoulId && soulId) payload.soulId = soulId;
        if (model?.supportsStyle && styleId) payload.styleId = styleId;
        if (model?.supportsReferenceImage && referenceUrl) payload.referenceUrl = referenceUrl;
      }
      const res = await fetch(base() + '/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const b = (await res.json().catch(() => null)) as
        | { urls?: string[]; refinedPrompt?: string; error?: string }
        | null;
      if (!res.ok || !b?.urls?.length) {
        setError(b?.error ?? 'Generation failed.');
        if (b?.refinedPrompt) setRefinedPrompt(b.refinedPrompt);
        return;
      }
      setResults(b.urls);
      setRefinedPrompt(b.refinedPrompt ?? null);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const saveToLibrary = async (url: string) => {
    if (saved.has(url) || savingUrls.has(url)) return; // in-flight + done guard
    setSavingUrls((prev) => new Set(prev).add(url));
    const label = (refinedPrompt || prompt).trim().slice(0, 90) || 'Generated image';
    try {
      const res = await fetch(base() + '/add', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url, kind: 'image', label }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(b?.error ?? 'Could not save to library.');
        return;
      }
      setSaved((prev) => new Set(prev).add(url));
      router.refresh(); // sync the library grid below
    } catch {
      setError('Network error saving to library.');
    } finally {
      setSavingUrls((prev) => {
        const n = new Set(prev);
        n.delete(url);
        return n;
      });
    }
  };

  const togglePhoto = (url: string) =>
    setSoulPhotos((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
    );

  // Jump to the "add media" form (in the library below) and focus its URL field,
  // so "Add images" from the Soul setup has somewhere to go.
  const goAddImage = () => {
    const el = document.getElementById('media-add');
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.querySelector('input')?.focus({ preventScroll: true });
  };

  const createSoul = async () => {
    if (!soulName.trim() || soulPhotos.length === 0 || creatingSoul) return;
    setCreatingSoul(true);
    setSoulError(null);
    try {
      const res = await fetch(base() + '/soul-id', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: soulName.trim(), imageUrls: soulPhotos }),
      });
      const b = (await res.json().catch(() => null)) as
        | { soul?: SoulIdOpt; error?: string }
        | null;
      if (!res.ok || !b?.soul) {
        setSoulError(b?.error ?? 'Could not create the Soul ID.');
        return;
      }
      setOptions((o) =>
        o ? { ...o, soulIds: [b.soul as SoulIdOpt, ...o.soulIds] } : o
      );
      setSoulId(b.soul.id);
      setSoulName('');
      setSoulPhotos([]);
      setShowSoulSetup(false);
    } catch {
      setSoulError('Network error. Try again.');
    } finally {
      setCreatingSoul(false);
    }
  };

  if (options && !options.configured) {
    return (
      <section className={s.genPanel}>
        <h2 className={s.genTitle}>Generate with AI</h2>
        <p className={s.genNote}>
          Image generation is not connected yet. Add the Higgsfield keys in Vercel to
          turn this on.
        </p>
      </section>
    );
  }

  const isSoul = model?.sizing === 'width_and_height';

  return (
    <section className={s.genPanel}>
      <h2 className={s.genTitle}>Generate with AI</h2>
      <p className={s.genNote}>
        Describe the image you want in plain words. April rewrites it into a strong
        image prompt, sends it to Higgsfield, and shows you the results; save the ones
        you like into this stream&rsquo;s library. The Soul model makes photoreal images
        of people: attach a Soul ID (a person you have trained) to get the same face
        every time, or a one-off reference image for a looser likeness. More models,
        including one for putting text on images, are coming.
      </p>

      <div className={s.genModels}>
        {IMAGE_MODELS.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`${s.genModelBtn} ${m.id === modelId ? s.genModelOn : ''}`}
            onClick={() => setModelId(m.id)}
            title={m.blurb}
          >
            {m.label}
          </button>
        ))}
      </div>
      {model ? <p className={s.genBlurb}>{model.blurb}</p> : null}

      <textarea
        className={s.genPrompt}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={
          model?.goodForText
            ? 'e.g. a bold quote card, dark background, the words "Strip the AI out first" in large type'
            : 'e.g. a confident founder at a laptop, warm cinematic light, shot from a low angle'
        }
        aria-label="Image prompt"
        disabled={busy}
      />

      <div className={s.genControls}>
        {model?.sizing === 'aspect_ratio' ? (
          <label className={s.genField}>
            <span>Aspect</span>
            <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} disabled={busy}>
              {ASPECT_RATIOS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label className={s.genField}>
              <span>Size</span>
              <select value={size} onChange={(e) => setSize(e.target.value)} disabled={busy}>
                {SOUL_SIZES.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={s.genField}>
              <span>Count</span>
              <select
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                disabled={busy}
              >
                <option value={1}>1</option>
                <option value={4}>4</option>
              </select>
            </label>
            {model?.supportsSoulId ? (
              <label className={s.genField}>
                <span>Person (Soul ID)</span>
                <select value={soulId} onChange={(e) => setSoulId(e.target.value)} disabled={busy}>
                  <option value="">None</option>
                  {(options?.soulIds ?? []).map((sid) => (
                    <option key={sid.id} value={sid.id}>
                      {sid.name}
                      {sid.status !== 'completed' ? ` (${sid.status})` : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {model?.supportsStyle ? (
              <label className={s.genField}>
                <span>Style</span>
                <select value={styleId} onChange={(e) => setStyleId(e.target.value)} disabled={busy}>
                  <option value="">No style</option>
                  {(options?.soulStyles ?? []).map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </>
        )}
        <button
          type="button"
          className={s.genBtn}
          onClick={generate}
          disabled={busy || !prompt.trim()}
        >
          {busy ? 'Generating…' : 'Generate'}
        </button>
      </div>

      {isSoul && model?.supportsReferenceImage && images.length > 0 ? (
        <div className={s.refRow}>
          <span className={s.refLabel}>Reference image (optional)</span>
          <div className={s.photoPick}>
            {images.map((im) => (
              <button
                key={im.media_id}
                type="button"
                className={`${s.photoTile} ${referenceUrl === im.url ? s.photoOn : ''}`}
                onClick={() => setReferenceUrl(referenceUrl === im.url ? '' : im.url)}
                title={im.label}
                disabled={busy}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im.url} alt={im.label} loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {isSoul ? (
        <div className={s.soulSetup}>
          <button
            type="button"
            className={s.soulToggle}
            onClick={() => setShowSoulSetup((v) => !v)}
          >
            {showSoulSetup ? 'Hide Soul ID setup' : '+ Set up a Soul ID (a consistent person)'}
          </button>
          {showSoulSetup ? (
            <div className={s.soulForm}>
              <p className={s.genNote}>
                Pick photos of one person from this stream&rsquo;s library (more angles is
                better), name the identity, and create it. Then choose it as the Person
                above. Add photos to the library first if there are none.
              </p>
              <input
                className={s.soulName}
                value={soulName}
                onChange={(e) => setSoulName(e.target.value)}
                placeholder="Name this person (e.g. Marrs)"
                aria-label="Soul ID name"
                disabled={creatingSoul}
              />
              {images.length === 0 ? (
                <div className={s.soulEmpty}>
                  <p className={s.genNote}>
                    No images in this stream&rsquo;s library yet. Add 10 to 20 good photos
                    of the person to train from: varied angles, lighting, and
                    expressions, a clear face, no sunglasses. One photo works but the
                    likeness is weaker.
                  </p>
                  <button type="button" className={s.addImageBtn} onClick={goAddImage}>
                    + Add images
                  </button>
                </div>
              ) : (
                <div className={s.photoPick}>
                  {images.map((im) => (
                    <button
                      key={im.media_id}
                      type="button"
                      className={`${s.photoTile} ${soulPhotos.includes(im.url) ? s.photoOn : ''}`}
                      onClick={() => togglePhoto(im.url)}
                      title={im.label}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={im.url} alt={im.label} loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
              {soulError ? <p className={s.genError}>{soulError}</p> : null}
              <button
                type="button"
                className={s.genBtn}
                onClick={createSoul}
                disabled={creatingSoul || !soulName.trim() || soulPhotos.length === 0}
              >
                {creatingSoul ? 'Creating…' : `Create Soul ID (${soulPhotos.length} photo${soulPhotos.length === 1 ? '' : 's'})`}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className={s.genError}>{error}</p> : null}
      {refinedPrompt ? (
        <p className={s.genRefined}>
          <span className={s.genRefinedLabel}>Prompt used:</span> {refinedPrompt}
        </p>
      ) : null}

      {results.length > 0 ? (
        <div className={s.genResults}>
          {results.map((url) => (
            <div key={url} className={s.genResult}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="generated" className={s.genResultImg} loading="lazy" />
              <button
                type="button"
                className={s.genSaveBtn}
                onClick={() => saveToLibrary(url)}
                disabled={saved.has(url) || savingUrls.has(url)}
              >
                {saved.has(url)
                  ? 'Saved ✓'
                  : savingUrls.has(url)
                    ? 'Saving…'
                    : 'Save to library'}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
