/**
 * Convert a pre-D31 DECK into a SCENE, so work built under the slide model is not
 * stranded when the stage moves to prezies.
 *
 * This exists because Marrs went looking for a finished piece of work and found an empty
 * list: his three-classes board was built as a deck, and the earlier import only handled
 * the short-lived per-piece scene store. Losing sight of finished work is worse than any
 * imperfection in the conversion, so this is deliberately forgiving.
 *
 * How a deck maps onto a scene. A deck's states were "the board" then "one pillar in
 * focus" per class then "the close", which is the same shape a scene expresses directly:
 *
 *  - the FIRST state carries the board: its `.sub` (or `.word`) is the concept headline,
 *    and its `.pillar` elements are the objects, with their colour class as the role.
 *  - for each object, the state where ITS pillar has `.focus` holds that object's detail.
 *    The telemetry elements there (`.corner`, `.hud`, `.meter`, `.num`) become its facts.
 *  - a final state with no pillars is the close: `.word` then `.sub`, which is exactly the
 *    two-line break the close now expects.
 *
 * Anything it cannot read confidently it drops rather than guesses at, because the result
 * lands in an editor where a wrong value costs more to spot than a missing one costs to
 * type. No LLM: this is a shape change, and a deterministic one is reviewable.
 */

import type { Deck } from './deck';
import type { Scene, SceneColour, SceneFact, SceneNode } from './scene';

const COLOURS: readonly SceneColour[] = ['coral', 'amber', 'gold', 'mint'];

/** Tag text with entities decoded and whitespace collapsed. */
function text(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Every `<div class="...">…</div>` whose class list contains `name`. */
function blocks(html: string, name: string): { classes: string; inner: string }[] {
  const out: { classes: string; inner: string }[] = [];
  const re = new RegExp(`<div class="([^"]*\\b${name}\\b[^"]*)"[^>]*>([\\s\\S]*?)</div>`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push({ classes: m[1], inner: m[2] });
  return out;
}

/** The first `.name` block's text, or ''. */
function firstText(html: string, name: string): string {
  const b = blocks(html, name)[0];
  return b ? text(b.inner) : '';
}

function colourOf(classes: string): SceneColour {
  for (const c of COLOURS) if (new RegExp(`\\b${c}\\b`).test(classes)) return c;
  return 'mint';
}

/**
 * Acronyms that must survive title-casing. Without this "AI" comes back as "Ai", which is
 * the kind of small wrongness that is worse than no conversion at all: it looks authored.
 */
const ACRONYMS = ['AI', 'ICP', 'CWU', 'PAM', 'ROI', 'KPI', 'SOP', 'B2B', 'B2C', 'API'];

/** Title Case, since deck copy was written in caps and the scene engine re-uppercases. */
function tidy(s: string): string {
  const t = s.trim().replace(/\s+/g, ' ');
  if (!t) return t;
  if (t !== t.toUpperCase()) return t;
  const cased = t
    .toLowerCase()
    .replace(/(^|\s|\/)([a-z])/g, (_, p, c) => p + c.toUpperCase());
  return ACRONYMS.reduce(
    (acc, a) => acc.replace(new RegExp(`\\b${a[0]}${a.slice(1).toLowerCase()}\\b`, 'g'), a),
    cased
  );
}

/**
 * A telemetry element becomes a fact. "RISK: HIGH" splits cleanly; a bare value gets a
 * label from the element's role, which is the honest reading of what it was doing.
 */
function factFrom(kind: string, raw: string): SceneFact | null {
  const t = raw.trim();
  if (!t) return null;
  const i = t.indexOf(':');
  if (i > 0 && i < t.length - 1) {
    return { label: tidy(t.slice(0, i)), value: tidy(t.slice(i + 1)) };
  }
  const label =
    kind === 'meter' ? 'Risk' : kind === 'num' ? 'Figure' : kind === 'hud' ? 'Status' : 'Note';
  return { label, value: tidy(t) };
}

/** Convert a deck to a scene, or null when its shape is not readable. */
export function deckToScene(deck: Deck): Scene | null {
  const states = deck.states.map((s) => s.html);
  if (states.length === 0) return null;

  const board = states[0];
  const boardPillars = blocks(board, 'pillar');
  if (boardPillars.length === 0) return null;

  const concept = tidy(firstText(board, 'sub') || firstText(board, 'word') || deck.title);

  const nodes: SceneNode[] = boardPillars.slice(0, 4).map((p, i) => {
    const colour = colourOf(p.classes);

    // The state where THIS pillar is focused holds this object's detail. Matched on the
    // pillar's own colour, which is what identified it across the deck's states.
    const detail = states.slice(1).find((st) =>
      blocks(st, 'pillar').some(
        (q) => /\bfocus\b/.test(q.classes) && colourOf(q.classes) === colour
      )
    );

    // The focused state's headline is the object's FULL name ("AI ADDICTS"); the board
    // pillar carried the short form ("ADDICTS") because it had to fit three across.
    const label =
      tidy(detail ? firstText(detail, 'word') : '') || tidy(text(p.inner)) || `Object ${i + 1}`;

    const facts: SceneFact[] = [];
    if (detail) {
      for (const kind of ['corner', 'meter', 'num', 'hud'] as const) {
        for (const b of blocks(detail, kind)) {
          const f = factFrom(kind, text(b.inner));
          // First label wins: decks often stated the same value twice, once as a corner
          // readout and once as a meter.
          if (f && !facts.some((g) => g.label.toLowerCase() === f.label.toLowerCase())) {
            facts.push(f);
          }
          if (facts.length >= 4) break;
        }
        if (facts.length >= 4) break;
      }
    }
    return { label, colour, facts };
  });

  // A trailing state with no pillars was the close. Its word and sub are the two lines.
  const last = states[states.length - 1];
  let close: string | undefined;
  if (states.length > 1 && blocks(last, 'pillar').length === 0) {
    const lines = [tidy(firstText(last, 'word')), tidy(firstText(last, 'sub'))].filter(Boolean);
    if (lines.length) close = lines.join('\n');
  }

  return { title: deck.title, concept, nodes, close };
}
