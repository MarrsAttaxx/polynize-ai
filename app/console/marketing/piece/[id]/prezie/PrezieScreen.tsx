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
  /** True when this version is a whole document drawn elsewhere and hosted here. */
  imported?: boolean;
};
type FigureView = {
  figure_id: string;
  name: string;
  brief: string;
  taps: number;
  /** True when the screen's touches belong to this figure rather than to the board. */
  interactive?: boolean;
};
type Open = {
  prezie_id: string;
  name: string;
  /** True when the open version is an imported document, which the console hosts but does not edit. */
  imported?: boolean;
  /** The legacy node board. Null on a figure prezie (D33). */
  scene: Scene | null;
  /** Authored figures, in performance order. Null on a board prezie. */
  figures: FigureView[] | null;
};

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
  /**
   * NOT prefilled from the angle any more.
   *
   * Seeding it looked like reuse and read as detritus: Marrs found "some old text stuck in
   * there" on every prezie, which was in fact his own angle for the piece, dumped into an
   * editable box with nothing saying where it came from. The angle is still used, and is now
   * shown as read-only context instead; generation falls back to it server-side whenever this
   * box is empty, so nothing is lost by leaving it blank.
   */
  const [narrative, setNarrative] = useState('');
  const [direction, setDirection] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState(-1);
  const [previewV, setPreviewV] = useState(0);
  // THE ITERATION LOOP. One selected figure, one thing to say about it. Everything else on
  // this panel exists to make those two obvious.
  const [figSel, setFigSel] = useState(0);
  const [ask, setAsk] = useState('');
  const [drawing, setDrawing] = useState(false);
  /**
   * SECONDS THE CURRENT CALL HAS BEEN RUNNING.
   *
   * Marrs reported the talking feature broken ("she sits there thinking for ages and nothing
   * happens") and then corrected himself: it had worked, it was just slower on the coding model.
   * The feature was fine and the FEEDBACK was not. A static "Thinking…" on one button, with the
   * draw buttons merely greying out, gives a slow call no way to look alive. A number that goes up
   * does, and it costs nothing.
   */
  const [elapsed, setElapsed] = useState(0);
  /**
   * WHAT SHE IS PRODUCING RIGHT NOW, as one rolling line.
   *
   * The timer proved the page was alive but not that SHE was. Marrs: "is there a way that I can
   * see her reasoning? so I can see if she's actually thinking things through, or frozen? even if
   * small, or just one line scrolling fast, would give me the confidence that she is actually
   * working on something." So the call streams, and this is the tail of it.
   *
   * `phase` separates deciding from writing, which is the more useful of the two signals: ninety
   * seconds of "thinking" is a different situation from ninety seconds of "writing", and only one
   * of them is worth cancelling.
   */
  const [think, setThink] = useState<{ phase: 'thinking' | 'writing'; text: string } | null>(null);
  /**
   * Which model actually served the last figure call, reported by the server from the same
   * function that picks it. Shown because "did my env var take effect" should not require
   * digging through function logs while trying to work.
   */
  const [model, setModel] = useState<string | null>(null);
  /**
   * The conversation about the current figure. Marrs asked for this because drawing first was
   * trial and error: he tells her the CONCEPT, she says what she can draw, and only when they
   * agree does she build it. Talking costs a sentence; drawing costs a turn.
   *
   * Client-side only, and cleared when the selected figure changes: it is a working
   * conversation about one picture, not a record worth keeping once the picture exists.
   */
  const [thread, setThread] = useState<{ role: 'operator' | 'april'; text: string }[]>([]);
  /**
   * IMPORTING A PREZIE HE DREW ELSEWHERE.
   *
   * A week of trying to get April to draw one figure, against an afternoon to one-shot a whole prezie in
   * a chat. So the console stops competing on the drawing and supplies what the file cannot have on its
   * own: his touch sounds, the operator strip, versioning on the concept, and the studio URL.
   */
  const [importHtml, setImportHtml] = useState('');
  const [showImport, setShowImport] = useState(false);

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

  // Tick while a figure call is in flight, and reset the moment it is not, so the number always
  // belongs to the call currently running.
  useEffect(() => {
    if (!drawing && !busy) {
      setElapsed(0);
      setThink(null);
      return;
    }
    setElapsed(0);
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [drawing, busy]);

  // Serialized autosave: one PUT in flight, latest content coalesced.
  const save = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      for (;;) {
        const content = latest.current;
        if (!content) break;
        // The autosave PUT carries a board. A figure prezie has none, and its figures are
        // already persisted by the figure endpoint as each turn lands, so there is nothing
        // here to save and attempting it would fail validation on every keystroke.
        if (!content.scene) break;
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
  // These edit the LEGACY node board, which a figure prezie does not have. Guarding on the
  // board rather than on `open` keeps the two models from tripping over each other.
  const patchScene = (p: Partial<Scene>) => {
    if (!open?.scene) return;
    commit({ ...open, scene: { ...open.scene, ...p } });
  };
  const patchNode = (i: number, p: Partial<Node>) => {
    if (!open?.scene) return;
    patchScene({ nodes: open.scene.nodes.map((n, k) => (k === i ? { ...n, ...p } : n)) });
  };
  const patchFact = (i: number, j: number, p: Partial<Fact>) => {
    if (!open?.scene) return;
    patchNode(i, { facts: open.scene.nodes[i].facts.map((f, k) => (k === j ? { ...f, ...p } : f)) });
  };
  const addFact = (i: number) => {
    if (!open?.scene || open.scene.nodes[i].facts.length >= MAX_FACTS) return;
    patchNode(i, { facts: [...open.scene.nodes[i].facts, { label: '', value: '' }] });
  };
  const removeFact = (i: number, j: number) => {
    if (!open?.scene) return;
    patchNode(i, { facts: open.scene.nodes[i].facts.filter((_, k) => k !== j) });
  };
  const addNode = () => {
    if (!open?.scene || open.scene.nodes.length >= MAX_NODES) return;
    patchScene({ nodes: [...open.scene.nodes, emptyNode(open.scene.nodes.length)] });
  };
  const removeNode = (i: number) => {
    if (!open?.scene || open.scene.nodes.length < 2) return;
    const nodes = open.scene.nodes.filter((_, k) => k !== i);
    patchScene({ nodes });
    setSel((k) => (k >= nodes.length ? nodes.length - 1 : k));
  };
  const moveNode = (i: number, dir: -1 | 1) => {
    if (!open?.scene) return;
    const j = i + dir;
    if (j < 0 || j >= open.scene.nodes.length) return;
    const nodes = open.scene.nodes.slice();
    [nodes[i], nodes[j]] = [nodes[j], nodes[i]];
    patchScene({ nodes });
  };

  /**
   * Create an empty FIGURE prezie, so the loop has something to hang off. It is a version like
   * any other and appears in the list on the left; it simply starts with no figures instead of
   * a generated board.
   */
  /** Paste a whole prezie in. No LLM call: the file IS the prezie. */
  const importPrezie = async () => {
    const html = importHtml.trim();
    if (busy || html.length < 200) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(endpoint(), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ imported_html: html }),
      });
      const b = (await res.json().catch(() => null)) as {
        note?: string;
        prezie?: { prezie_id: string; name: string };
        versions?: Version[];
        error?: string;
      } | null;
      if (!res.ok || !b?.prezie) {
        setError(b?.error ?? 'Could not import that.');
        return;
      }
      if (b.versions) setVersions(b.versions);
      setOpen({
        prezie_id: b.prezie.prezie_id,
        name: b.prezie.name,
        imported: true,
        scene: null,
        figures: null,
      });
      setImportHtml('');
      setShowImport(false);
      setNote(b.note ?? 'Imported.');
      setPreviewV((v) => v + 1);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const startFigures = async () => {
    if (drawing) return;
    setDrawing(true);
    setError(null);
    try {
      const res = await fetch(baseUrlRef.current + '/prezie/versions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ figures: true, name: initial.title }),
      });
      const b = (await res.json().catch(() => null)) as
        | { prezie?: { prezie_id: string; name: string }; versions?: Version[]; error?: string }
        | null;
      if (!res.ok || !b?.prezie) {
        setError(b?.error ?? 'Could not start it.');
        return;
      }
      setOpen({ prezie_id: b.prezie.prezie_id, name: b.prezie.name, scene: null, figures: [] });
      latest.current = null;
      if (b.versions) setVersions(b.versions);
      setFigSel(0);
      setSaveState('saved');
      setPreviewV((v) => v + 1);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setDrawing(false);
    }
  };

  /**
   * THE ONE-SHOT: the whole board from the script, in one call.
   *
   * Marrs got a complete five-figure prezie out of a single Claude pass after a week of failing to get
   * one board out of this loop, which said the loop was not the problem: starting from nothing was. This
   * produces the spine and the per-figure loop below fixes whatever missed.
   *
   * It saves as a NEW VERSION like everything else, so a disappointing pass costs nothing and the
   * version that worked is still one click away.
   */
  const oneShot = async () => {
    if (drawing) return;
    setDrawing(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(baseUrlRef.current + '/prezie/versions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ oneshot: true, direction: direction.trim() || undefined }),
      });
      const b = (await res.json().catch(() => null)) as
        | {
            prezie?: { prezie_id: string; name: string; figures?: FigureView[] };
            versions?: Version[];
            note?: string;
            model?: string;
            error?: string;
          }
        | null;
      if (!res.ok || !b?.prezie) {
        setError(b?.error ?? 'Could not build it.');
        return;
      }
      setOpen({
        prezie_id: b.prezie.prezie_id,
        name: b.prezie.name,
        scene: null,
        figures: b.prezie.figures ?? [],
      });
      latest.current = null;
      if (b.versions) setVersions(b.versions);
      if (b.model) setModel(b.model);
      setFigSel(0);
      setThread([]);
      setSaveState('saved');
      setPreviewV((v) => v + 1);
      setNote(b.note ?? 'Built it.');
    } catch {
      setError('Network error. Try again.');
    } finally {
      setDrawing(false);
    }
  };

  // ---- figures: draw, revise, remove ----
  const figures = open?.figures ?? [];
  const figEndpoint = () => baseUrlRef.current + '/prezie/figure';

  /**
   * Her last reply, and the numbered options in it if she offered any.
   *
   * This exists because talking used to be a dead end: she would propose two or three options
   * and there was no way to say "do that one". The box had been cleared by the reply, and the
   * draw buttons were disabled while it was empty, so after a proposal there was literally no
   * button to press (Marrs: "I have no way of telling her to do that solution").
   */
  const lastFromApril = thread.length && thread[thread.length - 1].role === 'april'
    ? thread[thread.length - 1].text
    : null;
  const offered = lastFromApril
    ? Array.from(
        new Set(
          // "1." / "2)" / "Option 3" at the start of a line: how she is asked to lay them out.
          (lastFromApril.match(/^\s*(?:option\s*)?([1-9])[.):]/gim) ?? []).map((m) =>
            Number(m.replace(/\D/g, ''))
          )
        )
      ).sort()
    : [];

  /**
   * Post to the figure endpoint and read her progress as it arrives.
   *
   * The response is newline-delimited JSON: any number of `think` events, then exactly one `ok` or
   * `err`. Errors raised before the stream starts (auth, validation, a stale prezie) still arrive
   * as ordinary JSON, so the content type decides how to read the body rather than assuming.
   */
  const askApril = async <T,>(payload: Record<string, unknown>): Promise<T> => {
    const res = await fetch(figEndpoint(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...payload, stream: true }),
    });
    if (!res.ok || !res.body || !(res.headers.get('content-type') ?? '').includes('ndjson')) {
      const b = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(b?.error ?? 'Could not reach her.');
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let finished: T | null = null;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      // Only whole lines are parsed; a chunk can split one anywhere.
      let nl: number;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let ev: {
          t?: string;
          phase?: 'thinking' | 'writing';
          d?: string;
          error?: string;
        };
        try {
          ev = JSON.parse(line) as typeof ev;
        } catch {
          continue;
        }
        if (ev.t === 'think') {
          setThink({ phase: ev.phase ?? 'thinking', text: ev.d ?? '' });
        } else if (ev.t === 'err') {
          throw new Error(ev.error ?? 'She could not finish that.');
        } else if (ev.t === 'ok') {
          finished = ev as T;
        }
      }
    }
    if (!finished) throw new Error('The connection dropped before she finished.');
    return finished;
  };

  /** Talk about the picture without drawing it. Nothing is saved and no figure changes. */
  const talk = async () => {
    const said = ask.trim();
    if (!open || drawing || !said) return;
    setDrawing(true);
    setError(null);
    const sent = [...thread, { role: 'operator' as const, text: said }];
    setThread(sent);
    setAsk('');
    try {
      const b = await askApril<{ reply?: string; model?: string }>({
        prezie_id: open.prezie_id,
        ask: said,
        mode: 'discuss',
        history: thread,
        figure_id: figures[figSel]?.figure_id,
      });
      if (!b.reply) {
        setError('She came back empty. Try again.');
        return;
      }
      if (b.model) setModel(b.model);
      setThread([...sent, { role: 'april', text: b.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error. Try again.');
    } finally {
      setDrawing(false);
    }
  };

  /**
   * One call for both drawing and revising: passing a figure_id makes it a revision, and the
   * brief accumulates server-side so earlier turns are not undone by later ones.
   */
  const draw = async (revise: boolean, instruction?: string) => {
    // The instruction may come from a button rather than the box: after she has proposed
    // something, the conversation IS the brief and there is nothing left to type.
    const said = (instruction ?? ask).trim();
    if (!open || drawing || !said) return;
    setDrawing(true);
    setError(null);
    try {
      const b = await askApril<{
        prezie?: { figures?: FigureView[] };
        note?: string;
        figure_id?: string;
        model?: string;
      }>({
        prezie_id: open.prezie_id,
        ask: said,
        mode: 'draw',
        // What was agreed while talking goes in with the ask, so the drawing honours the
        // conversation rather than only the last sentence of it.
        history: thread,
        figure_id: revise ? figures[figSel]?.figure_id : undefined,
      });
      if (!b.prezie?.figures) {
        setError('Could not draw that.');
        return;
      }
      if (b.model) setModel(b.model);
      const next = b.prezie.figures;
      setOpen({ ...open, figures: next });
      // Land on whatever was just drawn, so the preview shows the thing under discussion.
      const at = next.findIndex((f) => f.figure_id === b.figure_id);
      setFigSel(at >= 0 ? at : Math.max(0, next.length - 1));
      setNote(b.note ?? null);
      setAsk('');
      setThread([]);
      setPreviewV((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error. Try again.');
    } finally {
      setDrawing(false);
    }
  };

  const removeFigure = async (f: FigureView) => {
    if (!open || drawing || !window.confirm(`Delete "${f.name}"?`)) return;
    setDrawing(true);
    setError(null);
    try {
      const res = await fetch(figEndpoint(), {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prezie_id: open.prezie_id, figure_id: f.figure_id }),
      });
      const b = (await res.json().catch(() => null)) as
        | { prezie?: { figures?: FigureView[] }; error?: string }
        | null;
      if (!res.ok || !b?.prezie?.figures) {
        setError(b?.error ?? 'Could not delete it.');
        return;
      }
      setOpen({ ...open, figures: b.prezie.figures });
      setFigSel((k) => Math.max(0, Math.min(k, b.prezie!.figures!.length - 1)));
      setPreviewV((v) => v + 1);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setDrawing(false);
    }
  };

  /**
   * Whether this figure owns the screen's touches. His switch, not April's.
   *
   * She has the same flag and is told to set it, but he has been blocked twice waiting for her
   * to do something she could have done, and this is a one-bit fact he knows for certain.
   */
  const setOwnsScreen = async (f: FigureView, on: boolean) => {
    if (!open || drawing) return;
    // Optimistic: it is his own decision about his own figure, so it should feel instant.
    setOpen({
      ...open,
      figures: figures.map((g) =>
        g.figure_id === f.figure_id ? { ...g, interactive: on } : g
      ),
    });
    setPreviewV((v) => v + 1);
    try {
      await fetch(figEndpoint(), {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prezie_id: open.prezie_id,
          figure_id: f.figure_id,
          interactive: on,
        }),
      });
    } catch {
      setError('Could not save that.');
    }
  };

  const moveFigure = async (i: number, dir: -1 | 1) => {
    if (!open || drawing) return;
    const j = i + dir;
    if (j < 0 || j >= figures.length) return;
    const order = figures.map((f) => f.figure_id);
    [order[i], order[j]] = [order[j], order[i]];
    // Optimistic: the order is the operator's own decision, so it should feel instant.
    const shown = order.map((fid) => figures.find((f) => f.figure_id === fid)!);
    setOpen({ ...open, figures: shown });
    setFigSel(j);
    setPreviewV((v) => v + 1);
    try {
      await fetch(figEndpoint(), {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prezie_id: open.prezie_id, order }),
      });
    } catch {
      setError('Could not save the new order.');
    }
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
      const built: Open = {
        prezie_id: b.prezie.prezie_id,
        name: b.prezie.name,
        scene: b.prezie.scene,
        figures: null,
      };
      setOpen(built);
      latest.current = built;
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

  const nodes = open?.scene?.nodes ?? [];
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
          {v.imported ? 'imported' : `${v.node_count} objects`} ·{' '}
          {(v.updated_at ?? v.created_at).slice(0, 10)}
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
            {open?.imported ? (
              <span className={d.count}>imported</span>
            ) : open?.figures ? (
              <span className={d.count}>
                {figures.length} figure{figures.length === 1 ? '' : 's'}
              </span>
            ) : open ? (
              <span className={d.count}>
                {nodes.length}/{MAX_NODES} objects
              </span>
            ) : null}
          </div>

          {open?.imported ? (
            <>
              <p className={d.editHint}>
                This one was drawn outside the console, so it is HOSTED here rather than edited. It keeps
                every one of its own behaviours and its own cue strip; the console adds your touch sounds,
                versions it on the concept, and gives it the studio URL below.
              </p>
              <p className={d.hint}>
                To change it, iterate the drawing where you made it and import again. Each import is a new
                version, so nothing you liked gets overwritten.
              </p>
            </>
          ) : open && open.figures ? (
            <>
              <p className={d.editHint}>
                Say what you want and April draws it. Say what to change and she changes that
                and leaves the rest alone. Build it up a figure at a time.
              </p>

              {figures.length === 0 ? (
                <p className={d.empty}>
                  Nothing drawn yet. Describe the first picture below, in your own words.
                </p>
              ) : (
                figures.map((f, i) => (
                  <div
                    key={f.figure_id}
                    className={`${d.version} ${i === figSel ? d.versionOn : ''}`}
                  >
                    <button
                      type="button"
                      className={d.versionPick}
                      onClick={() => {
                        setFigSel(i);
                        setThread([]);
                        setPreviewV((v) => v + 1);
                      }}
                    >
                      <span className={d.versionName}>
                        {i + 1}. {f.name}
                      </span>
                      <span className={d.versionMeta}>
                        {f.taps} tap{f.taps === 1 ? '' : 's'}
                        {f.interactive ? ' · the screen is this figure' : ''}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`${d.versionOpen} ${f.interactive ? d.rigOnBtn : ''}`}
                      onClick={() => void setOwnsScreen(f, !f.interactive)}
                      disabled={drawing}
                      title={
                        f.interactive
                          ? 'The screen belongs to this figure: only the corner mark advances'
                          : 'Give the screen to this figure, so a touch works it instead of moving on'
                      }
                    >
                      ⇱
                    </button>
                    <button
                      type="button"
                      className={d.versionOpen}
                      onClick={() => void moveFigure(i, -1)}
                      disabled={i === 0 || drawing}
                      title="Earlier"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={d.versionOpen}
                      onClick={() => void moveFigure(i, 1)}
                      disabled={i === figures.length - 1 || drawing}
                      title="Later"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className={d.versionDel}
                      onClick={() => void removeFigure(f)}
                      disabled={drawing}
                      aria-label={`Delete ${f.name}`}
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}

              {thread.length ? (
                <div className={d.thread}>
                  {thread.map((m, i) => (
                    <p
                      key={i}
                      className={m.role === 'april' ? d.threadApril : d.threadMine}
                    >
                      {m.text}
                    </p>
                  ))}
                </div>
              ) : null}

              {/* BUILD WHAT SHE JUST SAID. These sit directly under her reply, need no typing,
                  and are the answer to talking being a dead end. */}
              {lastFromApril ? (
                <div className={d.agreeBox}>
                  <span className={d.agreeLabel}>Build it</span>
                  {offered.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={d.agreeBtn}
                      onClick={() =>
                        void draw(
                          figures.length > 0,
                          `Build option ${n}, exactly as you just described it. Do not add anything else.`
                        )
                      }
                      disabled={drawing}
                    >
                      Option {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={d.agreeBtn}
                    onClick={() =>
                      void draw(
                        figures.length > 0,
                        'Build exactly what you just described. If you offered more than one option, build the one you recommended, and nothing else.'
                      )
                    }
                    disabled={drawing}
                  >
                    {offered.length ? 'Your pick' : 'Draw that'}
                  </button>
                  {figures.length ? (
                    <span className={d.agreeNote}>
                      replaces figure {figSel + 1}
                    </span>
                  ) : null}
                </div>
              ) : null}

              <label className={d.field}>
                <span>
                  {thread.length
                    ? 'Keep talking, or draw what you have agreed'
                    : figures.length
                      ? `Talk about figure ${figSel + 1}, or describe a new one`
                      : 'Say what you are trying to get across, and she will propose the picture'}
                </span>
                <textarea
                  value={ask}
                  onChange={(e) => setAsk(e.target.value)}
                  placeholder={
                    'e.g. a lever. Small coral ball on the long arm is the work, big mint mass on the short arm is AI. One tap and the mass drops, the beam flips, the work is flung out as OUTPUT.'
                  }
                  rows={5}
                  disabled={drawing}
                />
              </label>
              <div className={d.aprilBox}>
                {/* TALK FIRST is the default action, because settling the picture in a sentence
                    is cheaper than drawing the wrong one. Drawing stays one click away for
                    when he already knows what he wants. */}
                <button
                  type="button"
                  className={d.aprilBtn}
                  onClick={() => void talk()}
                  disabled={drawing || !ask.trim()}
                >
                  {drawing ? `Working… ${elapsed}s` : 'Talk it through'}
                </button>
                <button
                  type="button"
                  className={d.addBtn}
                  onClick={() =>
                    void draw(
                      false,
                      ask.trim() ||
                        'Build exactly what you just described, and nothing else.'
                    )
                  }
                  disabled={drawing || (!ask.trim() && !lastFromApril)}
                >
                  {drawing
                    ? `${elapsed}s`
                    : figures.length
                      ? '+ Draw as a new figure'
                      : 'Draw it'}
                </button>
                {figures.length ? (
                  <button
                    type="button"
                    className={d.addBtn}
                    onClick={() =>
                      void draw(
                        true,
                        ask.trim() ||
                          'Build exactly what you just described, and nothing else.'
                      )
                    }
                    disabled={drawing || (!ask.trim() && !lastFromApril)}
                  >
                    {drawing ? `${elapsed}s` : `Change figure ${figSel + 1}`}
                  </button>
                ) : null}
              </div>
              {/* One unmissable indicator for all three actions above. Without it, clicking a
                  draw button greyed it out and changed nothing else on the page. */}
              {drawing ? (
                <div className={d.working}>
                  <p className={d.workingHead}>
                    <img
                      className={d.workingMark}
                      src="/console-assets/mark-loop.png"
                      alt=""
                      width={18}
                      height={18}
                    />
                    <b>{think?.phase === 'writing' ? 'writing it' : 'thinking'}</b>
                    {elapsed}s
                  </p>
                  {/* HER ACTUAL OUTPUT, scrolling. The point is not that it is readable, it is
                      that it is HERS and it is moving: a spinner cannot tell you whether the
                      model is working or wedged, and this can. */}
                  <p className={d.stream} aria-live="off">
                    {think?.text ? (
                      <span>{think.text}</span>
                    ) : (
                      <em>
                        {elapsed < 12
                          ? 'waiting for her first tokens'
                          : 'no output yet. If this stays empty past a minute, the model is wedged and it is worth cancelling.'}
                      </em>
                    )}
                  </p>
                </div>
              ) : (
                <p className={d.hint}>
                  Talking costs a sentence and changes nothing. She will tell you straight if
                  something cannot be drawn well, and offer what reads instead. Whatever you agree
                  goes in when you draw.
                </p>
              )}
            </>
          ) : open && open.scene ? (
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
                  value={open.scene?.concept ?? ''}
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
                  value={open.scene?.close ?? ''}
                  onChange={(e) => patchScene({ close: e.target.value })}
                  onBlur={flush}
                  placeholder={'Build a human\nthen amplify with AI'}
                  rows={2}
                />
              </label>
            </>
          ) : (
            <>
              <p className={d.empty}>
                Nothing open. Build the whole board from the script in one pass and then fix what
                missed, start empty and build it up a figure at a time, or pick a version on the left.
              </p>
              <button
                type="button"
                className={d.primaryBtn}
                onClick={() => void oneShot()}
                disabled={drawing || !script}
                title={
                  script
                    ? 'One figure per beat of the script, built in a single pass'
                    : 'Write the script first: the one-shot builds from it'
                }
              >
                {drawing ? `Building the board… ${elapsed}s` : 'Build the whole board from the script'}
              </button>
              <button
                type="button"
                className={d.aprilBtn}
                onClick={() => void startFigures()}
                disabled={drawing}
              >
                {drawing ? `Starting… ${elapsed}s` : 'Start empty, figure by figure'}
              </button>
              <button
                type="button"
                className={d.aprilBtn}
                onClick={() => setShowImport((v) => !v)}
                disabled={drawing || busy}
                title="Paste a prezie you built elsewhere. It gets your touch sounds and the operator strip."
              >
                {showImport ? 'Cancel import' : 'Import one you built'}
              </button>
            </>
          )}

          {showImport ? (
            <div className={d.buildBox}>
              <textarea
                className={d.importPaste}
                value={importHtml}
                onChange={(e) => setImportHtml(e.target.value)}
                placeholder="Paste the whole HTML file here. It keeps every one of its own behaviours; the console adds your touch sounds, the operator cue strip, the corner mark, versioning and the studio URL."
                rows={8}
                disabled={busy}
              />
              <div className={d.buildRow}>
                <button
                  type="button"
                  className={d.aprilBtn}
                  onClick={() => void importPrezie()}
                  disabled={busy || importHtml.trim().length < 200}
                >
                  {busy ? `Importing… ${elapsed}s` : 'Import it'}
                </button>
                <span className={d.hint}>
                  {importHtml.trim().length
                    ? `${importHtml.trim().length.toLocaleString()} characters`
                    : 'Nothing pasted yet'}
                </span>
              </div>
              <p className={d.hint}>
                An imported prezie runs its own sequencing, so the engine never advances on a touch: your
                taps go to the file and the corner mark is the only thing the engine owns. It is hosted,
                not edited, so keep iterating the drawing wherever you made it and import again.
              </p>
            </div>
          ) : null}

          <div className={d.buildBox}>
            {initial.angle?.trim() ? (
              <details className={d.angleContext}>
                <summary>The angle you gave this piece</summary>
                <p>{initial.angle.trim()}</p>
              </details>
            ) : null}
            <label className={d.field}>
              <span>
                The narrative. The governing image the board is built from. Leave it empty to
                use the angle above
              </span>
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
                {busy ? `Building… ${elapsed}s` : versions.length ? 'Build a new version' : 'Build it'}
              </button>
            </div>
            <p className={d.hint}>
              Building always makes a NEW version. Nothing you already have is replaced.
            </p>
          </div>
          {note ? <p className={d.note}>April: {note}</p> : null}
          {model ? <p className={d.modelTag}>drawn by {model}</p> : null}
          {error ? <p className={d.error}>{error}</p> : null}
        </section>
      </div>

      {open && (nodes.length || figures.length || open.imported) ? (
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

          <div className={d.chips} hidden={Boolean(open.figures)}>
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
            {/* The preview is the real page. On a figure prezie it opens on the figure under
                discussion, complete, so what is reviewed is what the camera will see. */}
            <iframe
              key={`${open.prezie_id}-${open.figures ? figSel : sel}-${previewV}`}
              className={d.preview}
              src={
                open.figures
                  ? `/console/prezie/${concept}/${open.prezie_id}?figure=${figSel}&v=${previewV}`
                  : sel >= 0
                    ? `/console/prezie/${concept}/${open.prezie_id}?node=${sel}&v=${previewV}`
                    : `/console/prezie/${concept}/${open.prezie_id}?v=${previewV}`
              }
              title={open.figures ? `Figure ${figSel + 1}` : sel >= 0 ? `Object ${sel + 1}` : 'The board'}
            />
          </div>
          <p className={d.hint}>
            The live page, not a mock-up, and it opens as the audience first sees it. Tap the
            preview to walk through this figure the way you will on the screen.
          </p>
        </section>
      ) : null}
    </div>
  );
}
