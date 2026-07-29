'use client';

/**
 * The INTERFACE stage (D31, renamed from "Screen Prompt" 2026-07-28). It edits the SCENE
 * the presenter operates on the touchscreen: one board of objects they open, reveal and
 * close on camera.
 *
 * The name matters because it IS the mental model (Marrs: "screen prompt seems a little
 * weird now, this is the interface for this piece of content"). "Prompt" was left over
 * from when the artifact was a brief handed to an animator, and it described a document.
 * What the stage produces is the thing itself.
 *
 * It used to edit slide cards, because the screen used to be a deck. Under D31 the screen
 * is an interface built from DATA, and that changes what this page is for. The engine owns
 * every pixel and every behaviour, so there is nothing here about layout, size, motion or
 * gestures. What is left is only the words and the meaning:
 *
 *   - the CONCEPT over the board
 *   - the OBJECTS on it, each with a name, a colour role, and its facts
 *   - the CLOSE, broken where the punch should land
 *
 * The important consequence: changing a word is TYPING, not asking April to regenerate.
 * Under the old model a small fix meant a rebuild that re-decided every state, which is
 * what made minor edits feel impossible. April is here to propose a scene from the script
 * and to refine one on request; she is never in the way of an edit.
 *
 * Scenes persist through their own endpoint (`interface/scene`), not on the piece.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { MarketingPiece } from '@/lib/marketing/piece-store';
import { scriptSections } from '@/lib/marketing/script-sections';
import { StageRail } from '../StageRail';
import { BackLink } from '@/app/console/marketing/_components/BackLink';
import s from '../script.module.css';
import d from './interface.module.css';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type Colour = 'coral' | 'amber' | 'gold' | 'mint';
type Fact = { label: string; value: string };
type Node = { label: string; colour: Colour; facts: Fact[] };
type Scene = { title?: string; concept: string; nodes: Node[]; close?: string };

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

export function InterfaceScreen({
  initial,
  scene: initialScene,
}: {
  initial: MarketingPiece;
  scene: Scene | null;
}) {
  const [scene, setScene] = useState<Scene | null>(initialScene);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [direction, setDirection] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState(-1);
  const [previewV, setPreviewV] = useState(0);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<Scene | null>(initialScene);
  const inFlight = useRef(false);
  const script = (initial.script ?? '').trim();
  const hasScript = Boolean(script);
  const sections = scriptSections(script);
  const sceneUrl = `/console/scene/${initial.piece_id}`;

  const baseUrlRef = useRef('');
  useEffect(() => {
    baseUrlRef.current = window.location.pathname
      .replace(/\/interface\/?$/, '')
      .replace(/\/+$/, '');
  }, []);

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
        try {
          const res = await fetch(baseUrlRef.current + '/interface/scene', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(content),
          });
          ok = res.ok;
        } catch {
          ok = false;
        }
        if (!ok) {
          setSaveState('error');
          break;
        }
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
    (next: Scene) => {
      setScene(next);
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
  const patch = (p: Partial<Scene>) => {
    if (!scene) return;
    commit({ ...scene, ...p });
  };
  const patchNode = (i: number, p: Partial<Node>) => {
    if (!scene) return;
    commit({ ...scene, nodes: scene.nodes.map((n, k) => (k === i ? { ...n, ...p } : n)) });
  };
  const patchFact = (i: number, j: number, p: Partial<Fact>) => {
    if (!scene) return;
    patchNode(i, { facts: scene.nodes[i].facts.map((f, k) => (k === j ? { ...f, ...p } : f)) });
  };
  const addFact = (i: number) => {
    if (!scene || scene.nodes[i].facts.length >= MAX_FACTS) return;
    patchNode(i, { facts: [...scene.nodes[i].facts, { label: '', value: '' }] });
  };
  const removeFact = (i: number, j: number) => {
    if (!scene) return;
    patchNode(i, { facts: scene.nodes[i].facts.filter((_, k) => k !== j) });
  };
  const addNode = () => {
    if (!scene || scene.nodes.length >= MAX_NODES) return;
    commit({ ...scene, nodes: [...scene.nodes, emptyNode(scene.nodes.length)] });
  };
  const removeNode = (i: number) => {
    if (!scene || scene.nodes.length < 2) return;
    const nodes = scene.nodes.filter((_, k) => k !== i);
    commit({ ...scene, nodes });
    setSel((k) => (k >= nodes.length ? nodes.length - 1 : k));
  };
  const moveNode = (i: number, dir: -1 | 1) => {
    if (!scene) return;
    const j = i + dir;
    if (j < 0 || j >= scene.nodes.length) return;
    const nodes = scene.nodes.slice();
    [nodes[i], nodes[j]] = [nodes[j], nodes[i]];
    commit({ ...scene, nodes });
  };

  const ask = async () => {
    if (busy || !hasScript) return;
    setBusy(true);
    setError(null);
    flush();
    try {
      const res = await fetch(baseUrlRef.current + '/interface/scene', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ direction: direction.trim() }),
      });
      const b = (await res.json().catch(() => null)) as
        | { scene?: Scene; note?: string; error?: string }
        | null;
      if (!res.ok || !b?.scene) {
        setError(b?.error ?? 'Could not build the scene.');
        return;
      }
      setScene(b.scene);
      latest.current = b.scene;
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

  const startBlank = () =>
    commit({
      concept: initial.title,
      nodes: [emptyNode(0), emptyNode(1), emptyNode(2)],
      close: '',
    });

  const saveLabel =
    saveState === 'saving'
      ? 'Saving…'
      : saveState === 'saved'
        ? 'Saved ✓'
        : saveState === 'error'
          ? 'Save failed'
          : '';

  const nodes = scene?.nodes ?? [];

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
              {(initial.format ?? '').replace(/_/g, ' ')} · interface
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
          <h2 className={d.colTitle}>The script</h2>
          {sections.length === 0 ? (
            <p className={d.empty}>Write the script first. The scene is built from it.</p>
          ) : (
            sections.map((sec, i) => (
              <div key={i} className={d.section}>
                {sec.label ? <span className={d.sectionLabel}>{sec.label}</span> : null}
                <p className={d.sectionBody}>{sec.body}</p>
              </div>
            ))
          )}
        </section>

        <section className={d.slideCol}>
          <div className={d.colHead}>
            <h2 className={d.colTitle}>The scene</h2>
            {scene ? (
              <span className={d.count}>
                {nodes.length}/{MAX_NODES} objects
              </span>
            ) : null}
          </div>

          {!scene ? (
            <p className={d.empty}>
              Nothing on the screen yet. Tell April what you want and she will build it from
              the script, or start one by hand.
            </p>
          ) : (
            <>
              <label className={d.field}>
                <span>The concept, over the whole board</span>
                <textarea
                  value={scene.concept}
                  onChange={(e) => patch({ concept: e.target.value })}
                  onBlur={flush}
                  placeholder="e.g. Three divergent classes"
                  rows={1}
                />
              </label>

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
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveNode(i, 1)}
                        disabled={i === nodes.length - 1}
                        title="Move right"
                      >
                        ↓
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
                  value={scene.close ?? ''}
                  onChange={(e) => patch({ close: e.target.value })}
                  onBlur={flush}
                  placeholder={'Build a human\nthen amplify with AI'}
                  rows={2}
                />
              </label>
            </>
          )}

          <div className={d.aprilBox}>
            <input
              className={d.aprilInput}
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              placeholder={
                scene
                  ? 'Tell April what to change, e.g. make the third one the payoff'
                  : 'Tell April what you want on screen'
              }
              aria-label="Direction for April"
              disabled={busy || !hasScript}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void ask();
                }
              }}
            />
            <button
              type="button"
              className={d.aprilBtn}
              onClick={ask}
              disabled={busy || !hasScript}
            >
              {busy ? 'Building…' : scene ? 'Ask April to revise' : 'Ask April to build it'}
            </button>
          </div>
          {!scene ? (
            <button type="button" className={d.addBtn} onClick={startBlank}>
              + Start one by hand
            </button>
          ) : null}
          {note ? <p className={d.note}>April: {note}</p> : null}
          {error ? <p className={d.error}>{error}</p> : null}
        </section>
      </div>

      {scene && nodes.length ? (
        <section className={d.deckPanel}>
          <div className={d.colHead}>
            <h2 className={d.colTitle}>On the touchscreen</h2>
            <a href={sceneUrl} target="_blank" rel="noopener noreferrer" className={d.openLink}>
              Open the scene ↗
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
              key={`${sel}-${previewV}`}
              className={d.preview}
              src={sel >= 0 ? `${sceneUrl}?node=${sel}&v=${previewV}` : `${sceneUrl}?v=${previewV}`}
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
