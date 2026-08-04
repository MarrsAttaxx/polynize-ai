'use client';

/**
 * The PREZIE stage (D31; the stage has been called treatment, screen prompt and interface
 * before this). It edits the interactive presentation the presenter operates on the
 * touchscreen: one board of objects they open, reveal and close on camera.
 *
 * "Prezie" is Marrs's own word for it, which is the best argument for using it: it is what
 * he calls the thing when he is not thinking about the console. The earlier names all
 * described a DOCUMENT, which is what the artifact used to be.
 *
 * Three things this page is built around, all from him using it:
 *
 * 1. VERSIONS, NEVER OVERWRITES. Prezies belong to the concept and accumulate. Generating
 *    makes a new one; the list is always there to click back to. He expects to return to
 *    these later, including in the podcast, so they are assets rather than by-products.
 * 2. EDITING IS TYPING. Every value on the board is a text field here. Changing "medium"
 *    to "high" costs one keystroke and no LLM call, and the page says so out loud, because
 *    the previous version left him unsure it was possible at all.
 * 3. THE BOARD COMES BEFORE THE WORDS. The narrative box, not the script, is the brief.
 *    He can build the prezie first and write from it, which is the order that actually
 *    matches how he works.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { MarketingPiece } from '@/lib/marketing/piece-store';
import { scriptSections } from '@/lib/marketing/script-sections';
import { StageRail } from '../StageRail';
import { BackLink } from '@/app/console/marketing/_components/BackLink';
import s from '../script.module.css';
import d from './prezie.module.css';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type Colour = 'coral' | 'amber' | 'gold' | 'mint';
type Fact = { label: string; value: string };
type Node = { label: string; colour: Colour; facts: Fact[] };
type Scene = { title?: string; concept: string; nodes: Node[]; close?: string };
type Version = {
  prezie_id: string;
  name: string;
  concept: string;
  for_this_piece: boolean;
  created_at: string;
  updated_at?: string;
  url: string;
  node_count: number;
};
type Open = { prezie_id: string; name: string; scene: Scene };

const MAX_NODES = 4;
const MAX_FACTS = 4;

/** The colour ROLES, named by what they MEAN rather than by what they look like. */
const COLOURS: { id: Colour; role: string }[] = [
  { id: 'coral', role: 'problem' },
  { id: 'amber', role: 'tension' },
  { id: 'gold', role: 'proof' },
  { id: 'mint', role: 'resolution' },
];

const emptyNode = (i: number): Node => ({
  label: '',
  colour: COLOURS[i % COLOURS.length].id,
  facts: [{ label: '', value: '' }],
});

export function PrezieScreen({
  initial,
  concept,
  versions: initialVersions,
  opening,
}: {
  initial: MarketingPiece;
  concept: string;
  versions: Version[];
  opening: Open | null;
}) {
  const [versions, setVersions] = useState<Version[]>(initialVersions);
  const [open, setOpen] = useState<Open | null>(opening);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  // Seeded from the piece's ANGLE, stated once at creation. The narrative can still be
  // sharpened here (the board often wants a tighter image than the brief did), but the
  // operator should never be asked for their intent a second time.
  const [narrative, setNarrative] = useState((initial.angle ?? '').trim());
  const [direction, setDirection] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState(-1);
  const [previewV, setPreviewV] = useState(0);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<Open | null>(opening);
  const inFlight = useRef(false);
  const script = (initial.script ?? '').trim();
  const sections = scriptSections(script);

  const baseUrlRef = useRef('');
  useEffect(() => {
    baseUrlRef.current = window.location.pathname
      .replace(/\/prezie\/?$/, '')
      .replace(/\/+$/, '');
  }, []);
  const endpoint = () => baseUrlRef.current + '/prezie/versions';

  // Serialized autosave: one PUT in flight, latest content coalesced.
  const save = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      for (;;) {
        const content = latest.current;
        if (!content) break;
        setSaveState('saving');
        let ok = false;
        let body: { versions?: Version[] } | null = null;
        try {
          const res = await fetch(endpoint(), {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              prezie_id: content.prezie_id,
              name: content.name,
              scene: content.scene,
            }),
          });
          ok = res.ok;
          body = (await res.json().catch(() => null)) as { versions?: Version[] } | null;
        } catch {
          ok = false;
        }
        if (!ok) {
          setSaveState('error');
          break;
        }
        if (body?.versions) setVersions(body.versions);
        if (latest.current !== content) continue;
        setSaveState('saved');
        // The preview IS the real page, so it only tells the truth once the save lands.
        setPreviewV((v) => v + 1);
        break;
      }
    } finally {
      inFlight.current = false;
    }
  }, []);

  const commit = useCallback(
    (next: Open) => {
      setOpen(next);
      latest.current = next;
      setSaveState('saving');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void save();
      }, 900);
    },
    [save]
  );

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      void save();
    }
  }, [save]);
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => flushRef.current(), []);

  // ---- edits: all direct, none of them cost an LLM call ----
  const patchScene = (p: Partial<Scene>) => {
    if (!open) return;
    commit({ ...open, scene: { ...open.scene, ...p } });
  };
  const patchNode = (i: number, p: Partial<Node>) => {
    if (!open) return;
    patchScene({ nodes: open.scene.nodes.map((n, k) => (k === i ? { ...n, ...p } : n)) });
  };
  const patchFact = (i: number, j: number, p: Partial<Fact>) => {
    if (!open) return;
    patchNode(i, { facts: open.scene.nodes[i].facts.map((f, k) => (k === j ? { ...f, ...p } : f)) });
  };
  const addFact = (i: number) => {
    if (!open || open.scene.nodes[i].facts.length >= MAX_FACTS) return;
    patchNode(i, { facts: [...open.scene.nodes[i].facts, { label: '', value: '' }] });
  };
  const removeFact = (i: number, j: number) => {
    if (!open) return;
    patchNode(i, { facts: open.scene.nodes[i].facts.filter((_, k) => k !== j) });
  };
  const addNode = () => {
    if (!open || open.scene.nodes.length >= MAX_NODES) return;
    patchScene({ nodes: [...open.scene.nodes, emptyNode(open.scene.nodes.length)] });
  };
  const removeNode = (i: number) => {
    if (!open || open.scene.nodes.length < 2) return;
    const nodes = open.scene.nodes.filter((_, k) => k !== i);
    patchScene({ nodes });
    setSel((k) => (k >= nodes.length ? nodes.length - 1 : k));
  };
  const moveNode = (i: number, dir: -1 | 1) => {
    if (!open) return;
    const j = i + dir;
    if (j < 0 || j >= open.scene.nodes.length) return;
    const nodes = open.scene.nodes.slice();
    [nodes[i], nodes[j]] = [nodes[j], nodes[i]];
    patchScene({ nodes });
  };

  // ---- versions ----
  const build = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    flush();
    try {
      const res = await fetch(endpoint(), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          narrative: narrative.trim(),
          direction: direction.trim(),
          // A direction with a version open refines THAT version rather than starting over.
          from: direction.trim() && open ? open.prezie_id : undefined,
        }),
      });
      const b = (await res.json().catch(() => null)) as
        | { prezie?: Open; versions?: Version[]; note?: string; error?: string }
        | null;
      if (!res.ok || !b?.prezie) {
        setError(b?.error ?? 'Could not build it.');
        return;
      }
      setOpen({ prezie_id: b.prezie.prezie_id, name: b.prezie.name, scene: b.prezie.scene });
      latest.current = { prezie_id: b.prezie.prezie_id, name: b.prezie.name, scene: b.prezie.scene };
      if (b.versions) setVersions(b.versions);
      setNote(b.note ?? null);
      setDirection('');
      setSel(-1);
      setSaveState('saved');
      setPreviewV((v) => v + 1);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  };

  /**
   * Opening a version re-enters the page with `?v=`, so the server hands back the full
   * scene. The alternative would be shipping every version's body to the client just in
   * case one gets clicked, which is a lot of payload for a rare action.
   */
  const load = (v: Version) => {
    flush();
    window.location.href = `${baseUrlRef.current}/prezie?v=${v.prezie_id}`;
  };

  const removeVersion = async (v: Version) => {
    if (busy || !window.confirm(`Delete "${v.name}"? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint(), {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prezie_id: v.prezie_id }),
      });
      const b = (await res.json().catch(() => null)) as
        | { versions?: Version[]; error?: string }
        | null;
      if (!res.ok || !b?.versions) {
        setError(b?.error ?? 'Could not delete it.');
        return;
      }
      setVersions(b.versions);
      if (open?.prezie_id === v.prezie_id) {
        setOpen(null);
        latest.current = null;
      }
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const saveLabel =
    saveState === 'saving'
      ? 'Saving…'
      : saveState === 'saved'
        ? 'Saved ✓'
        : saveState === 'error'
          ? 'Save failed'
          : '';

  const nodes = open?.scene.nodes ?? [];
  const mine = versions.filter((v) => v.for_this_piece);
  const others = versions.filter((v) => !v.for_this_piece);

  const versionRow = (v: Version) => (
    <div
      key={v.prezie_id}
      className={`${d.version} ${open?.prezie_id === v.prezie_id ? d.versionOn : ''}`}
    >
      <button type="button" className={d.versionPick} onClick={() => load(v)}>
        <span className={d.versionName}>{v.name}</span>
        <span className={d.versionMeta}>
          {v.node_count} objects · {(v.updated_at ?? v.created_at).slice(0, 10)}
        </span>
      </button>
      <a href={v.url} target="_blank" rel="noopener noreferrer" className={d.versionOpen}>
        open ↗
      </a>
      <button
        type="button"
        className={d.versionDel}
        onClick={() => void removeVersion(v)}
        aria-label={`Delete ${v.name}`}
      >
        ✕
      </button>
    </div>
  );

  return (
    <div className={s.root}>
      <StageRail pieceId={initial.piece_id} current="treatment_map" />
      <header className={s.head}>
        <div className={s.headLeft}>
          <BackLink
            fallbackHref={`/console/marketing/piece/${initial.piece_id}`}
            className={s.back}
            dashboardHref={`/console/marketing/stream/${initial.stream}`}
          />
          <div className={s.titleWrap}>
            <span className={s.eyebrow}>
              {(initial.format ?? '').replace(/_/g, ' ')} · prezie
            </span>
            <h1 className={s.title}>{initial.title}</h1>
          </div>
        </div>
        <div className={s.headRight}>
          <Link href={`/console/marketing/piece/${initial.piece_id}`} className={s.prompterLink}>
            ← Script
          </Link>
          <span
            className={`${s.saveInd} ${
              saveState === 'saving'
                ? s.saving
                : saveState === 'saved'
                  ? s.ok
                  : saveState === 'error'
                    ? s.err
                    : ''
            }`}
          >
            {saveLabel}
          </span>
        </div>
      </header>

      <div className={d.cols}>
        <section className={d.scriptCol}>
          <div className={d.colHead}>
            <h2 className={d.colTitle}>Prezies for this concept</h2>
            <span className={d.count}>{versions.length}</span>
          </div>
          {versions.length === 0 ? (
            <p className={d.empty}>
              None yet. Give April the narrative below and she will build the first one.
            </p>
          ) : (
            <>
              {mine.length ? (
                <>
                  <span className={d.sectionLabel}>For this piece</span>
                  {mine.map(versionRow)}
                </>
              ) : null}
              {others.length ? (
                <>
                  <span className={d.sectionLabel}>Elsewhere on this concept</span>
                  {others.map(versionRow)}
                </>
              ) : null}
            </>
          )}

          {sections.length ? (
            <>
              <div className={d.colHead} style={{ marginTop: 18 }}>
                <h2 className={d.colTitle}>The script</h2>
              </div>
              {sections.map((sec, i) => (
                <div key={i} className={d.section}>
                  {sec.label ? <span className={d.sectionLabel}>{sec.label}</span> : null}
                  <p className={d.sectionBody}>{sec.body}</p>
                </div>
              ))}
            </>
          ) : null}
        </section>

        <section className={d.slideCol}>
          <div className={d.colHead}>
            <h2 className={d.colTitle}>{open ? open.name : 'Build a prezie'}</h2>
            {open ? (
              <span className={d.count}>
                {nodes.length}/{MAX_NODES} objects
              </span>
            ) : null}
          </div>

          {open ? (
            <>
              <p className={d.editHint}>
                Every field here is editable. Type over any value and it saves itself. No
                need to rebuild for a wording change.
              </p>

              <label className={d.field}>
                <span>This version&rsquo;s name</span>
                <textarea
                  value={open.name}
                  onChange={(e) => commit({ ...open, name: e.target.value })}
                  onBlur={flush}
                  placeholder="e.g. Force multiplier"
                  rows={1}
                />
              </label>

              <label className={d.field}>
                <span>The concept, over the whole board</span>
                <textarea
                  value={open.scene.concept}
                  onChange={(e) => patchScene({ concept: e.target.value })}
                  onBlur={flush}
                  placeholder="e.g. Three divergent classes"
                  rows={1}
                />
              </label>

              <p className={d.editHint}>
                The objects read left to right, and that order is the narrative. Move them
                with the arrows.
              </p>

              {nodes.map((n, i) => (
                <article key={i} className={d.card}>
                  <div className={d.cardHead}>
                    <span className={d.cardNum}>Object {i + 1}</span>
                    <div className={d.cardActions}>
                      <button
                        type="button"
                        onClick={() => moveNode(i, -1)}
                        disabled={i === 0}
                        title="Move left"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        onClick={() => moveNode(i, 1)}
                        disabled={i === nodes.length - 1}
                        title="Move right"
                      >
                        →
                      </button>
                      <button
                        type="button"
                        onClick={() => removeNode(i)}
                        disabled={nodes.length < 2}
                        title="Remove this object"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <label className={d.field}>
                    <span>Name</span>
                    <textarea
                      value={n.label}
                      onChange={(e) => patchNode(i, { label: e.target.value })}
                      onBlur={flush}
                      placeholder="e.g. AI Addicts"
                      rows={1}
                    />
                  </label>

                  <div className={d.field}>
                    <span>What it means</span>
                    <div className={d.swatches}>
                      {COLOURS.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className={`${d.swatch} ${d[c.id]} ${
                            n.colour === c.id ? d.swatchOn : ''
                          }`}
                          onClick={() => patchNode(i, { colour: c.id })}
                        >
                          {c.role}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={d.field}>
                    <span>
                      Facts, revealed one touch at a time ({n.facts.length}/{MAX_FACTS})
                    </span>
                    {n.facts.map((f, j) => (
                      <div key={j} className={d.factRow}>
                        <input
                          className={d.factK}
                          value={f.label}
                          onChange={(e) => patchFact(i, j, { label: e.target.value })}
                          onBlur={flush}
                          placeholder="Risk profile"
                          aria-label="Fact label"
                        />
                        <input
                          className={d.factV}
                          value={f.value}
                          onChange={(e) => patchFact(i, j, { value: e.target.value })}
                          onBlur={flush}
                          placeholder="High"
                          aria-label="Fact value"
                        />
                        <button
                          type="button"
                          className={d.factX}
                          onClick={() => removeFact(i, j)}
                          title="Remove this fact"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    {n.facts.length < MAX_FACTS ? (
                      <button type="button" className={d.addBtn} onClick={() => addFact(i)}>
                        + Add a fact
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}

              {nodes.length < MAX_NODES ? (
                <button type="button" className={d.addBtn} onClick={addNode}>
                  + Add an object
                </button>
              ) : null}

              <label className={d.field}>
                <span>The closing line. Break it where the punch should land</span>
                <textarea
                  value={open.scene.close ?? ''}
                  onChange={(e) => patchScene({ close: e.target.value })}
                  onBlur={flush}
                  placeholder={'Build a human\nthen amplify with AI'}
                  rows={2}
                />
              </label>
            </>
          ) : (
            <p className={d.empty}>
              Nothing open. Pick a version on the left, or write the narrative below and let
              April build one.
            </p>
          )}

          <div className={d.buildBox}>
            <label className={d.field}>
              <span>The narrative. The governing image the board is built from</span>
              <textarea
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                placeholder="e.g. AI is a force multiplier, so mapping the work has to come first, or it multiplies the mess"
                rows={3}
                disabled={busy}
              />
            </label>
            <div className={d.aprilBox}>
              <input
                className={d.aprilInput}
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
                placeholder={
                  open
                    ? 'Optional: what to change about the open version'
                    : 'Optional: any extra direction'
                }
                aria-label="Direction for April"
                disabled={busy}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void build();
                  }
                }}
              />
              <button type="button" className={d.aprilBtn} onClick={build} disabled={busy}>
                {busy ? 'Building…' : versions.length ? 'Build a new version' : 'Build it'}
              </button>
            </div>
            <p className={d.hint}>
              Building always makes a NEW version. Nothing you already have is replaced.
            </p>
          </div>
          {note ? <p className={d.note}>April: {note}</p> : null}
          {error ? <p className={d.error}>{error}</p> : null}
        </section>
      </div>

      {open && nodes.length ? (
        <section className={d.deckPanel}>
          <div className={d.colHead}>
            <h2 className={d.colTitle}>On the touchscreen</h2>
            <a
              href={`/console/prezie/${concept}/${open.prezie_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={d.openLink}
            >
              Open on the touchscreen ↗
            </a>
          </div>

          <div className={d.chips}>
            <button
              type="button"
              className={`${d.chip} ${sel === -1 ? d.chipOn : ''}`}
              onClick={() => setSel(-1)}
            >
              <span className={d.chipNum}>◻</span>
              the board
            </button>
            {nodes.map((n, i) => (
              <button
                key={i}
                type="button"
                className={`${d.chip} ${i === sel ? d.chipOn : ''}`}
                onClick={() => setSel(i)}
              >
                <span className={d.chipNum}>{i + 1}</span>
                {n.label || 'unnamed'}
              </button>
            ))}
          </div>

          <div className={d.previewWrap}>
            <iframe
              key={`${open.prezie_id}-${sel}-${previewV}`}
              className={d.preview}
              src={
                sel >= 0
                  ? `/console/prezie/${concept}/${open.prezie_id}?node=${sel}&v=${previewV}`
                  : `/console/prezie/${concept}/${open.prezie_id}?v=${previewV}`
              }
              title={sel >= 0 ? `Object ${sel + 1}` : 'The board'}
            />
          </div>
          <p className={d.hint}>
            The live page, not a mock-up. Touch it here the way you will on the screen.
          </p>
        </section>
      ) : null}
    </div>
  );
}
