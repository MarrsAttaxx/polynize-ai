'use client';

/**
 * GATES 2 TO 5 (D40). One gate on screen at a time, one mint decision bar, back goes
 * back. The server page loads the narrative and everything the current gate needs; this
 * component owns the interactions and the gate transitions.
 *
 * Design decisions carried from the approved mockup, verbatim:
 * - Gate 2 is the article full screen with April docked beside it. The old interview
 *   is dead: the article is drafted the moment the narrative arrives here, and every
 *   refinement is either a direct edit or one instruction to April.
 * - Gate 3 is the kit, per platform, defaults on. The count is pieces of content,
 *   never "placements": that word meant nothing to the operator.
 * - Gate 4 lists the master pieces and opens the existing editors. The one-card
 *   flow is the next build; tonight the gate is honest about being a checklist.
 * - Gate 5 queues the wave as DRAFTS on the calendar first (his call: draft-first),
 *   and the button flips the whole wave live through Metricool.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Narrative } from '@/lib/marketing/narrative-store';
import {
  kitRows,
  tickCount,
  resolveTicks,
  defaultTicks,
  KIT_NETWORK_ORDER,
  type KitRow,
} from '@/lib/marketing/kit';
import { PlatformIcon } from '@/app/console/marketing/_components/PlatformIcon';
import { channelLabel } from '@/lib/marketing/channels';
import { HERO_BATCH } from '@/lib/marketing/hero';
import { IMAGE_MODELS, DEFAULT_IMAGE_MODEL } from '@/lib/marketing/higgsfield-models';
import g from '../gates.module.css';

type PieceRow = {
  id: string;
  label: string;
  master: string;
  kind: string;
  href: string;
  /** Whether this card could ship (D47). Advisory: it never blocks the gate. */
  state: 'empty' | 'drafted' | 'ready';
  stateLabel: string;
  /** Which networks this card's posts land on (D49), as marks rather than words (D54). */
  networks: string[];
  /** How many posts it becomes. Only printed when it is more than one. */
  posts: number;
  /** How the thing is made. The name says what it IS; this says how. */
  detail: string;
};
type WaveCell = {
  day: string;
  network: string;
  label: string;
  video: boolean;
  /** True when this one is his to post by hand rather than Metricool's to schedule. */
  manual: boolean;
  /** 'HH:mm'. The grid had no time-of-day dimension at all before typed slots (D46). */
  at: string;
  /** What the slot it landed in is for. */
  prefers: 'video' | 'still' | 'any';
  /** A still post in the video slot, or the reverse. Shown, never hidden. */
  fallback: boolean;
};
export type WaveData = {
  planned: boolean;
  cells: WaveCell[];
  days: string[];
  networks: string[];
  count: number;
  /** Entries actually scheduled or published, as opposed to still sitting as drafts. */
  live: number;
  /** Split of the wave: what Metricool schedules vs what he posts himself (D41). */
  auto: number;
  manual: number;
  /** Manual entries already sent to him. */
  handed: number;
  /** Posts sitting in a slot that prefers the other kind (D46). */
  fallback: number;
  metricoolReady: boolean;
};

const NET_LABEL: Record<string, string> = {
  linkedin: 'LI',
  instagram: 'IG',
  tiktok: 'TT',
  youtube: 'YT',
};

export function NarrativeGates({
  initial,
  pieces,
  wave,
}: {
  initial: Narrative;
  pieces: PieceRow[];
  wave: WaveData;
}) {
  const router = useRouter();
  const [narrative, setNarrative] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // A narrative can legitimately sit at gate 1 (create's second write failed after the
  // first committed, or a garbled gate normalized back to 1). This screen has no
  // gate-1 branch, so treat it as gate 2: rendering the article gate IS the recovery.
  const gate = narrative.gate === 1 ? 2 : narrative.gate;

  const base = `/console/marketing/narrative/${narrative.id}`;

  /** One write path for gate moves and field saves; the server owns validation. */
  const put = useCallback(
    async (patch: Record<string, unknown>) => {
      const res = await fetch(`${base}/state`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? 'save failed');
      }
      return (await res.json()) as { narrative: Narrative };
    },
    [base]
  );

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestArticle = useRef(initial.article);

  /**
   * Flush the pending autosave NOW. Confirmed in review: the debounced PUT could
   * interleave with the Approve PUT or with April's server-side save, and whichever
   * wrote last silently dropped the other's text. Every action that reads or moves
   * the article flushes first, so the server always holds what the screen shows.
   */
  const flushArticle = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      await put({ article: latestArticle.current });
    }
  }, [put]);

  const moveGate = async (to: Narrative['gate'], refresh = false) => {
    if (busy) return;
    setBusy('gate');
    setErr(null);
    try {
      await flushArticle();
      const { narrative: next } = await put({ gate: to });
      setNarrative(next);
      if (refresh) router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'save failed');
    } finally {
      setBusy(null);
    }
  };

  /* ---------------- Gate 2: the article and April ---------------- */

  const [article, setArticle] = useState(initial.article);
  const [drafting, setDrafting] = useState(false);
  const [chat, setChat] = useState<{ who: 'you' | 'april'; text: string }[]>([]);
  const [chatIn, setChatIn] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const draftFired = useRef(false);
  const [draftErr, setDraftErr] = useState(false);

  // The article drafts itself the first time the gate is seen empty. The old flow
  // wrote a whole script before the operator said anything; this drafts the ONE
  // artifact he asked to start with, and only that.
  useEffect(() => {
    if (gate !== 2 || article.trim() || draftFired.current) return;
    draftFired.current = true;
    setDrafting(true);
    (async () => {
      try {
        const res = await fetch(`${base}/draft`, { method: 'POST' });
        const b = (await res.json().catch(() => null)) as
          | { article?: string; error?: string }
          | null;
        if (res.ok && b?.article) {
          setArticle(b.article);
          latestArticle.current = b.article;
          setNarrative((s) => ({ ...s, article: b.article as string }));
        } else {
          setErr(b?.error ?? 'The draft came back empty.');
          setDraftErr(true);
        }
      } catch {
        setErr('Network error while drafting.');
        setDraftErr(true);
      } finally {
        setDrafting(false);
      }
    })();
  }, [gate, article, base]);

  const scheduleArticleSave = (next: string) => {
    setArticle(next);
    latestArticle.current = next;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      put({ article: next }).catch(() => setErr('Autosave failed. Copy your text.'));
    }, 1000);
  };

  // The retry the failure copy points at. Also the deliberate redraft: force tells
  // the route to overwrite a non-empty article, which it otherwise refuses to do.
  const redraft = async () => {
    if (drafting) return;
    setDrafting(true);
    setErr(null);
    setDraftErr(false);
    try {
      const res = await fetch(`${base}/draft`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ force: article.trim() !== '' }),
      });
      const b = (await res.json().catch(() => null)) as
        | { article?: string; error?: string }
        | null;
      if (res.ok && b?.article) {
        setArticle(b.article);
        latestArticle.current = b.article;
        setNarrative((s) => ({ ...s, article: b.article as string }));
      } else {
        setErr(b?.error ?? 'The draft came back empty.');
        setDraftErr(true);
      }
    } catch {
      setErr('Network error while drafting.');
      setDraftErr(true);
    } finally {
      setDrafting(false);
    }
  };

  const askApril = async () => {
    const instruction = chatIn.trim();
    if (!instruction || chatBusy) return;
    setChatBusy(true);
    setChat((c) => [...c, { who: 'you', text: instruction }]);
    setChatIn('');
    try {
      // She edits the article the SCREEN shows, so the pending autosave is flushed
      // before she reads. The textarea is locked below while she works: two writers
      // on one document was how edits vanished.
      await flushArticle();
      const res = await fetch(`${base}/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ instruction }),
      });
      const b = (await res.json().catch(() => null)) as
        | { article?: string; error?: string }
        | null;
      if (res.ok && b?.article) {
        setArticle(b.article);
        latestArticle.current = b.article;
        setNarrative((s) => ({ ...s, article: b.article as string }));
        setChat((c) => [...c, { who: 'april', text: 'Done. The article is updated.' }]);
      } else {
        setChat((c) => [
          ...c,
          { who: 'april', text: b?.error ?? 'That did not work. Try again.' },
        ]);
      }
    } catch {
      setChat((c) => [...c, { who: 'april', text: 'Network error. Try again.' }]);
    } finally {
      setChatBusy(false);
    }
  };

  /* ---------------- Gate 3: the kit ---------------- */

  const rows: KitRow[] = kitRows(narrative.lane);
  /**
   * A saved kit is RESOLVED before it becomes tick state, so a narrative saved under the v1
   * catalogue opens with its retired ids already expanded into the typed ones. Without that,
   * every box would render unticked, the count would read 0, and the confirm button would be
   * disabled with nothing on screen saying why.
   *
   * A kit that resolves to nothing falls back to the lane's defaults for the same reason.
   */
  const [ticks, setTicks] = useState<string[]>(() => {
    const saved = resolveTicks(initial.kit ?? [], narrative.lane);
    return saved.length > 0 ? saved : defaultTicks(narrative.lane);
  });
  /** A row owns one id or a whole series, and a series is one decision. */
  const toggleRow = (row: KitRow) =>
    setTicks((t) => {
      const on = row.ids.some((id) => t.includes(id));
      return on ? t.filter((x) => !row.ids.includes(x)) : [...t, ...row.ids];
    });
  const count = tickCount(ticks, narrative.lane);

  const buildKit = async () => {
    if (busy) return;
    setBusy('build');
    setErr(null);
    try {
      const res = await fetch(`${base}/build`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ticks }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        setErr(b?.error ?? 'Could not build the kit.');
        return;
      }
      router.refresh();
      const { narrative: next } = await put({ gate: 4 });
      setNarrative(next);
    } catch {
      setErr('Network error. Try again.');
    } finally {
      setBusy(null);
    }
  };

  /* ---------------- Gate 4: the look ---------------- */

  /**
   * THE HERO IMAGE (D51). One image for the whole narrative, made first, that every later image
   * is generated against.
   *
   * It sits above the cards because it is upstream of all of them: settling the look on ONE
   * generation before spending ten on a carousel is the entire economy. Optional by design, and
   * the panel says so: a narrative with no hero still works exactly as it did, the slide screen
   * just falls back to inferring a reference from the first approved slide.
   */
  const [heroPrompt, setHeroPrompt] = useState(narrative.hero_prompt ?? '');
  /**
   * FOUR CANDIDATES, NOT ONE (D56). Marrs: "I would like the prompt to generate four images, and
   * then you choose the one you want."
   *
   * They are already hosted by the time they arrive, so what is on screen is what gets used and
   * a candidate is a real file rather than a preview. None of them is on the narrative until one
   * is blessed, which is why this is component state and not a save.
   */
  const [heroOptions, setHeroOptions] = useState<string[]>([]);
  const [heroBusy, setHeroBusy] = useState<'make' | 'save' | null>(null);
  /**
   * WHICH ONE IS OPEN BIG. Marrs: "it comes up very small. I can't see the image or click on
   * it... I need the images to come up clearly, and if I click, it enlarges them so I can see
   * them properly, and then I select one."
   *
   * A url rather than an index, so the live hero can open in the same viewer as a candidate.
   */
  /**
   * WHICH MODEL MAKES IT (D62). Marrs: "What image model is being used for the images in the gate
   * for the look section? It's very inconsistent, especially in the text. I'd rather use Nano
   * Banana Pro."
   *
   * Soul cannot render text at all, which is why every prompt here forbids it and why brand type
   * is composited in code. A Gemini image model can, so the choice belongs on the screen rather
   * than in a constant.
   */
  const [heroModel, setHeroModel] = useState<string>(DEFAULT_IMAGE_MODEL);
  const [heroZoom, setHeroZoom] = useState<string | null>(null);
  const heroLive = narrative.hero_url ?? null;
  const zoomCloseRef = useRef<HTMLButtonElement>(null);

  // Escape closes the viewer, and Close takes focus on open, matching the console's other
  // modals. Bound only while something is open so it cannot swallow a key on the gate itself.
  useEffect(() => {
    if (!heroZoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHeroZoom(null);
    };
    document.addEventListener('keydown', onKey);
    zoomCloseRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [heroZoom]);

  const makeHero = async () => {
    if (heroBusy || heroPrompt.trim().length < 3) return;
    setHeroBusy('make');
    setErr(null);
    try {
      const res = await fetch(`${base}/hero`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: heroPrompt.trim(), model: heroModel }),
      });
      const b = (await res.json().catch(() => null)) as { urls?: string[]; error?: string } | null;
      if (!res.ok || !b?.urls?.length) {
        setErr(b?.error ?? 'Could not make the look.');
        return;
      }
      setHeroOptions(b.urls);
      setHeroZoom(null);
    } catch {
      setErr('Network error while making the look.');
    } finally {
      setHeroBusy(null);
    }
  };

  /**
   * Blessing it is what registers it. Same two steps as approving a slide: into the stream
   * library for a real media id, then onto the narrative. Until then it is a preview and
   * nothing downstream can see it, which is why a rejected hero leaves no litter behind.
   */
  const keepHero = async (chosen: string) => {
    if (heroBusy || !chosen) return;
    setHeroBusy('save');
    setErr(null);
    try {
      const path = window.location.pathname.replace(/\/+$/, '');
      const at = path.indexOf('/marketing/narrative/');
      const consoleBase = at === -1 ? '' : path.slice(0, at);
      const add = `${consoleBase}/marketing/stream/${narrative.lane}/media/add`;
      const reg = await fetch(add, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url: chosen,
          kind: 'image',
          // Named off the idea so the asset is findable in the library later, and so the
          // narrative-scoped pool (todo 3c) has something to match on before it has a real ref.
          label: `${narrative.idea.trim().slice(0, 60) || 'Narrative'} hero`.slice(0, 90),
          // Stamped so the picker on this narrative's posts shows it first (D52).
          narrative_ref: narrative.id,
        }),
      });
      const rb = (await reg.json().catch(() => null)) as
        | { asset?: { media_id: string }; error?: string }
        | null;
      if (!reg.ok || !rb?.asset) {
        setErr(rb?.error ?? 'Could not save the hero to the library.');
        return;
      }
      const { narrative: next } = await put({
        hero_url: chosen,
        hero_media_id: rb.asset.media_id,
        hero_prompt: heroPrompt.trim(),
      });
      setNarrative(next);
      // The other three stop existing as far as the screen is concerned. They are unregistered
      // bytes in the bucket that nothing points at, which is the whole reason a reject is free.
      setHeroOptions([]);
      setHeroZoom(null);
    } catch {
      setErr('Network error saving the look.');
    } finally {
      setHeroBusy(null);
    }
  };

  /* ---------------- Gate 5: the wave ---------------- */

  const [shipping, setShipping] = useState(false);
  const planFired = useRef(false);

  // Draft-first, his call: entering the gate queues the wave as calendar DRAFTS at
  // each channel's next open slots. The plan ALWAYS runs on mount: it is idempotent
  // and near-free when nothing is missing, and gating it on "some entries exist"
  // (the first version) made a partly failed plan permanent and silently ignored
  // placements added by re-ticking the kit. planFired only stops the same mount
  // firing twice.
  useEffect(() => {
    if (gate !== 5 || planFired.current) return;
    planFired.current = true;
    (async () => {
      try {
        const res = await fetch(`${base}/wave`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'plan' }),
        });
        const b = (await res.json().catch(() => null)) as {
          error?: string;
          unplaced?: string[];
        } | null;
        if (res.ok) {
          /**
           * A post the 60-day walk could not place. It is no longer saved without a time, which
           * used to manufacture a post that could never ship and never errored, so the only place
           * it can be reported is here. The next plan run retries it.
           */
          if (b?.unplaced?.length) {
            setErr(
              `No open slot for ${b.unplaced.join(', ')}. That channel is booked out: free a slot or add one, then reload.`
            );
          }
          router.refresh();
        } else {
          setErr(b?.error ?? 'Could not lay out the week.');
        }
      } catch {
        setErr('Network error while laying out the week.');
      }
    })();
  }, [gate, wave.planned, base, router]);

  const ship = async () => {
    if (shipping) return;
    setShipping(true);
    setErr(null);
    try {
      const res = await fetch(`${base}/wave`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'ship' }),
      });
      const b = (await res.json().catch(() => null)) as
        | { shipped?: number; failed?: number; handed?: number; error?: string }
        | null;
      if (!res.ok) {
        setErr(b?.error ?? 'The ship failed.');
        return;
      }
      if (b?.handed) {
        setErr(
          `${b.handed} sent to your email to post by hand${b.shipped ? `, ${b.shipped} scheduled` : ''}. They stay as drafts on the calendar until you post them.`
        );
      }
      if (b?.failed) {
        // A partial ship is NOT shipped. The first version flipped the gate anyway,
        // which unmounted this error and told the operator everything went out.
        setErr(
          `${b.shipped ?? 0} scheduled, ${b.failed} failed. The failures are still drafts: fix and press ship again, which skips everything already live.`
        );
        router.refresh();
        return;
      }
      const { narrative: next } = await put({ gate: 'shipped' });
      setNarrative(next);
      router.refresh();
    } catch {
      setErr('Network error. Try again.');
    } finally {
      setShipping(false);
    }
  };

  /* ---------------- Render ---------------- */

  const gates: (2 | 3 | 4 | 5 | 'shipped')[] = [2, 3, 4, 5, 'shipped'];
  const names: Record<string, string> = {
    '2': 'Gate 2 · Article',
    '3': 'Gate 3 · Kit',
    '4': 'Gate 4 · Create',
    '5': 'Gate 5 · Ship',
    shipped: 'Shipped',
  };
  const gateIx = gates.indexOf(gate as 2 | 3 | 4 | 5 | 'shipped');

  return (
    <div className={`${g.app} ${gate === 2 ? g.appWide : ''}`}>
      <div className={g.top}>
        {gate !== 'shipped' ? (
          <button
            type="button"
            className={g.back}
            aria-label="Back"
            onClick={() => {
              if (gate === 2) router.push('/console/marketing');
              else moveGate((gates[gateIx - 1] ?? 2) as Narrative['gate'], true);
            }}
          >
            ‹
          </button>
        ) : null}
        <span className={g.where}>{names[String(gate)]}</span>
        <span className={g.dots}>
          {[1, ...gates].map((x, i) => (
            <span
              key={i}
              className={`${g.dot} ${i - 1 === gateIx ? g.dotOn : i - 1 < gateIx ? g.dotPast : ''}`}
            />
          ))}
        </span>
      </div>

      {gate === 2 ? (
        <>
          <div className={g.duo}>
            <div>
              <div className={g.card}>
                <textarea
                  className={g.article}
                  value={drafting ? 'April is writing…' : article}
                  onChange={(e) => scheduleArticleSave(e.target.value)}
                  disabled={drafting || chatBusy}
                  spellCheck={false}
                />
              </div>
              <p className={g.hint}>
                {chatBusy ? 'April has the document' : 'edit the text yourself, or tell April'}
              </p>
              {draftErr && !drafting ? (
                <p className={g.hint}>
                  <button
                    type="button"
                    onClick={redraft}
                    style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}
                  >
                    try the draft again
                  </button>
                </p>
              ) : null}
            </div>
            <div className={`${g.card} ${g.chat}`}>
              <span className={g.chatHead}>April</span>
              {chat.map((m, i) => (
                <div key={i} className={`${g.msg} ${m.who === 'you' ? g.msgYou : g.msgApril}`}>
                  <span className={g.who}>{m.who}</span>
                  {m.text}
                </div>
              ))}
              <div className={g.chatrow}>
                <input
                  value={chatIn}
                  onChange={(e) => setChatIn(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') askApril();
                  }}
                  placeholder="Tell April what to change"
                  disabled={chatBusy || drafting}
                />
                <button type="button" onClick={askApril} disabled={chatBusy || drafting}>
                  {chatBusy ? '…' : '→'}
                </button>
              </div>
            </div>
          </div>
          {err ? <p className={g.err}>{err}</p> : null}
          <div className={g.bar}>
            <button
              type="button"
              className={g.go}
              onClick={() => moveGate(3)}
              disabled={busy !== null || drafting || !article.trim()}
            >
              {drafting ? 'April is writing…' : 'Approve the article →'}
            </button>
          </div>
        </>
      ) : null}

      {gate === 3 ? (
        <>
          {KIT_NETWORK_ORDER.map((net) => {
            const items = rows.filter((k) => k.network === net);
            if (items.length === 0) return null;
            const cls =
              net === 'linkedin'
                ? g.logoLi
                : net === 'instagram'
                  ? g.logoIg
                  : net === 'tiktok'
                    ? g.logoTt
                    : g.logoYt;
            const mark =
              net === 'linkedin' ? 'in' : net === 'instagram' ? '◎' : net === 'tiktok' ? '♪' : '▶';
            return (
              <div key={net} className={g.plat}>
                <div className={g.plathead}>
                  <span className={`${g.logo} ${cls}`}>{mark}</span>
                  <span className={g.platname}>{net}</span>
                </div>
                <div className={g.kitCard}>
                  {items.map((k) => (
                    <div key={k.key} className={g.row}>
                      {/*
                        WHAT IT IS AND WHY, on hover (D50). Both lines already existed on the
                        output and neither reached a screen. Shown on :hover for a mouse and on
                        :focus-within for touch and keyboard, since tapping the row focuses its
                        checkbox: one mechanism, three input methods, no extra control on a
                        screen whose whole point is that it holds one decision.
                      */}
                      <span className={g.tip} role="note">
                        <b>{k.label}</b>
                        <span>{k.what}</span>
                        {k.why ? <span className={g.tipWhy}>{k.why}</span> : null}
                        <span className={g.tipMakes}>Makes: {k.makes}</span>
                      </span>
                      <input
                        type="checkbox"
                        id={k.key}
                        checked={k.ids.some((id) => ticks.includes(id))}
                        onChange={() => toggleRow(k)}
                      />
                      <label htmlFor={k.key}>
                        {k.label}
                        <small>{k.sub}</small>
                      </label>
                      {/* The pill is a SERIES SIZE, and it appears only where there is one.
                          A column of "1"s down the screen is noise, and the label already
                          says the row is one post. */}
                      {k.pill ? <span className={g.n}>{k.pill}</span> : null}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {err ? <p className={g.err}>{err}</p> : null}
          <div className={g.bar}>
            <button
              type="button"
              className={g.go}
              onClick={buildKit}
              disabled={busy !== null || count === 0}
            >
              {busy === 'build' ? 'Building…' : `Confirm · ${count} posts →`}
            </button>
          </div>
        </>
      ) : null}

      {gate === 4 ? (
        <>
          {/* THE LOOK, above the cards because it is upstream of every image below it (D51). */}
          <div className={g.card}>
            <h3 className={g.lookHead}>The look</h3>
            <p className={g.lookWhy}>
              One image for this whole narrative. Every picture made below is generated against
              it, so the set holds together. Optional: skip it and each image finds its own way.
            </p>
            {/* THE ONE THAT IS SET. Shown at a size you can actually read, and it opens big
                like a candidate does, because "is this still the right look" is a question you
                answer by looking at it rather than at a thumbnail. */}
            {heroLive && heroOptions.length === 0 ? (
              <div className={g.lookSet}>
                <button
                  type="button"
                  className={g.lookShotBtn}
                  onClick={() => setHeroZoom(heroLive)}
                  aria-label="See the look full size"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={heroLive} alt="" className={g.lookShot} />
                </button>
                <span className={g.lookState}>✓ set. Every image below follows this.</span>
              </div>
            ) : null}

            {/* THE FOUR. Two across, each at 4:3 and big enough to judge, and clicking one
                opens it full size rather than doing anything irreversible. */}
            {heroOptions.length > 0 ? (
              <>
                <p className={g.lookPick}>
                  {heroOptions.length === 1
                    ? 'One came back. Click it to see it big.'
                    : `${heroOptions.length} to choose from. Click one to see it big, then use it.`}
                </p>
                <div className={g.lookGrid}>
                  {heroOptions.map((u, i) => (
                    <div key={u} className={g.lookTile}>
                      <button
                        type="button"
                        className={g.lookShotBtn}
                        onClick={() => setHeroZoom(u)}
                        aria-label={`See option ${i + 1} full size`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="" className={g.lookShot} />
                        <span className={g.lookExpand} aria-hidden>
                          ⤢
                        </span>
                      </button>
                      <button
                        type="button"
                        className={g.lookUse}
                        onClick={() => void keepHero(u)}
                        disabled={heroBusy !== null}
                      >
                        {heroBusy === 'save' ? 'Saving…' : 'Use this one'}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            <textarea
              className={g.lookBox}
              rows={2}
              placeholder="What does this narrative look like? A scene, the light, the mood."
              value={heroPrompt}
              onChange={(e) => setHeroPrompt(e.target.value)}
              disabled={heroBusy !== null}
            />
            {/* THE MODEL (D62). Only worth a control now that there is more than one, and the
                blurb is the reason to switch: Soul cannot spell, the Gemini models can. */}
            <label className={g.lookModel}>
              <span className={g.lookModelLabel}>Made by</span>
              <select
                value={heroModel}
                onChange={(e) => setHeroModel(e.target.value)}
                disabled={heroBusy !== null}
              >
                {IMAGE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <p className={g.lookModelWhy}>
              {IMAGE_MODELS.find((m) => m.id === heroModel)?.blurb ?? ''}
            </p>
            <div className={g.lookBtns}>
              <button
                type="button"
                className={g.lookGo}
                onClick={makeHero}
                disabled={heroBusy !== null || heroPrompt.trim().length < 3}
              >
                {heroBusy === 'make'
                  ? `Making ${HERO_BATCH}…`
                  : heroLive || heroOptions.length > 0
                    ? `Try ${HERO_BATCH} more`
                    : `Make ${HERO_BATCH} to choose from`}
              </button>
            </div>

            {/* FULL SIZE, and the place the choice is actually made. Same shape as the console's
                other modals: Escape closes, the backdrop closes, the close button takes focus. */}
            {heroZoom ? (
              <div
                className={g.lookZoom}
                role="dialog"
                aria-modal="true"
                aria-label="The look, full size"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setHeroZoom(null);
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={heroZoom} alt="" className={g.lookZoomImg} />
                <div className={g.lookZoomBar}>
                  {heroOptions.includes(heroZoom) ? (
                    <button
                      type="button"
                      className={g.lookKeep}
                      onClick={() => void keepHero(heroZoom)}
                      disabled={heroBusy !== null}
                    >
                      {heroBusy === 'save' ? 'Saving…' : 'Use this one'}
                    </button>
                  ) : null}
                  <button
                    ref={zoomCloseRef}
                    type="button"
                    className={g.lookGo}
                    onClick={() => setHeroZoom(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {pieces.length === 0 ? (
            <p className={g.meta}>
              {(narrative.piece_ids?.length ?? 0) > 0
                ? 'Loading the masters…'
                : 'No masters yet. Go back a gate and confirm the kit.'}
            </p>
          ) : (
            pieces.map((p) => (
              <div key={p.id} className={g.card}>
                <Link href={p.href} className={g.makeRow}>
                  <div className={g.makeBody}>
                    <h3>{p.label}</h3>
                    <span
                      className={`${g.badge} ${p.state === 'ready' ? g.badgeReady : p.kind === 'video' ? g.badgeGold : g.badgeDim}`}
                    >
                      {p.state === 'ready' ? '✓ ready' : p.stateLabel}
                    </span>
                    {p.detail ? <span className={g.where2}>{p.detail}</span> : null}
                  </div>
                  {/*
                    THE PLATFORM MARKS (D54). Marrs: "the sectioning and branding that is linked
                    to Instagram should be carried across to Gate 4 as well, but not necessarily
                    hierarchical... just make that a little more pronounced so the LinkedIn logo
                    is sitting in there so I can see what's Instagram and what's LinkedIn."
                    Not hierarchical: the cards stay in production order (video first, the long
                    pole) and the marks say where each one goes. Same PlatformIcon the calendar
                    uses, so one glyph set across the console.
                  */}
                  <span className={g.marks}>
                    {p.networks.map((nw) => (
                      <PlatformIcon key={nw} channel={nw} size={15} title={channelLabel(nw)} />
                    ))}
                    {p.posts > 1 ? <span className={g.marksN}>{p.posts}</span> : null}
                  </span>
                  <span className={g.open}>open →</span>
                </Link>
              </div>
            ))
          )}
          {pieces.some((p) => p.state !== 'ready') ? (
            <p className={g.hint}>
              {pieces.filter((p) => p.state === 'ready').length} of {pieces.length} ready. You can
              lay out the week now and keep working: images attached later are picked up the next
              time this narrative loads Gate 5.
            </p>
          ) : (
            <p className={g.hint}>All {pieces.length} ready.</p>
          )}
          {err ? <p className={g.err}>{err}</p> : null}
          <div className={g.bar}>
            <button
              type="button"
              className={g.go}
              onClick={() => moveGate(5, true)}
              disabled={busy !== null || pieces.length === 0}
            >
              Lay out the week →
            </button>
          </div>
        </>
      ) : null}

      {gate === 5 ? (
        <>
          <div className={g.card}>
            {wave.cells.length === 0 ? (
              <p className={g.meta}>Laying out the week…</p>
            ) : (
              <div className={g.weekwrap}>
                <table className={g.week}>
                  <thead>
                    <tr>
                      <th></th>
                      {wave.days.map((d) => (
                        <th key={d}>{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {wave.networks.map((n) => (
                      <tr key={n}>
                        <th>{NET_LABEL[n] ?? n}</th>
                        {wave.days.map((d) => (
                          <td key={d}>
                            {wave.cells
                              .filter((c) => c.day === d && c.network === n)
                              .sort((a, b) => a.at.localeCompare(b.at))
                              .map((c, i) => (
                                <span
                                  key={i}
                                  className={`${g.chip} ${c.video ? g.chipV : ''} ${c.manual ? g.chipHand : ''} ${c.fallback ? g.chipOff : ''}`}
                                  title={
                                    [
                                      c.prefers === 'any'
                                        ? null
                                        : `${c.at} is the ${c.prefers === 'video' ? 'video' : 'text and images'} slot`,
                                      c.fallback ? 'nothing of that kind was waiting' : null,
                                      c.manual ? 'yours to post by hand' : null,
                                    ]
                                      .filter(Boolean)
                                      .join('. ') || undefined
                                  }
                                >
                                  <b>{c.at}</b> {c.label}
                                  {c.fallback ? '*' : ''}
                                  {c.manual ? ' ✋' : ''}
                                </span>
                              ))}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {wave.fallback > 0 ? (
              <p className={g.honesty}>
                {wave.fallback} {wave.fallback === 1 ? 'post is' : 'posts are'} in the wrong kind of
                slot (marked *), because there was nothing of that kind waiting. LinkedIn mornings
                are the video slot and afternoons are text and images.
              </p>
            ) : null}
            {wave.manual > 0 ? (
              <p className={g.honesty}>
                {wave.manual} of these are yours to post by hand (marked ✋), because
                scheduled posting costs reach on your own LinkedIn. Shipping emails them to
                you and schedules the rest.
              </p>
            ) : null}
            {!wave.metricoolReady && wave.auto > 0 ? (
              <p className={g.honesty}>
                Metricool is not connected on this environment, so the {wave.auto} scheduled
                {wave.auto === 1 ? ' post' : ' posts'} cannot go out from here.
              </p>
            ) : null}
          </div>
          <p className={g.hint}>
            queued as drafts on the calendar. Shipping schedules what Metricool handles and
            emails you the rest.
          </p>
          {err ? <p className={g.err}>{err}</p> : null}
          <div className={g.bar}>
            <button
              type="button"
              className={g.go}
              onClick={ship}
              disabled={
                shipping ||
                wave.count === 0 ||
                // A wave that is entirely hand-posted needs no Metricool at all, so an
                // unconfigured environment must not block it. That is the Marrs LinkedIn
                // case exactly.
                (!wave.metricoolReady && wave.auto > 0)
              }
            >
              {shipping
                ? 'Shipping…'
                : wave.manual > 0 && wave.auto > 0
                  ? `Ship · schedule ${wave.auto}, send me ${wave.manual}`
                  : wave.manual > 0
                    ? `Send me ${wave.manual} to post`
                    : `Ship the wave · ${wave.auto} pieces`}
            </button>
          </div>
        </>
      ) : null}

      {gate === 'shipped' ? (
        <>
          <div className={g.big}>✓</div>
          <p className={g.shipline}>
            {wave.live} pieces scheduled
            {wave.live < wave.count ? `, ${wave.count - wave.live} still drafts on the calendar` : ''}
          </p>
          <p className={g.loop}>
            numbers flow back from Metricool as they land
            <br />
            winners feed the next kit and April's examples
          </p>
          <div className={g.bar}>
            <Link href="/console/marketing" className={g.go} style={{ display: 'block', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}>
              Back to the board
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
