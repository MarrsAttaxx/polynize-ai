/**
 * FIGURES: the diagram vocabulary a prezie is composed from (D33).
 *
 * WHY THIS EXISTS. A scene could previously express exactly one thing: a row of coloured
 * pillars, each with label/value fact rows. Marrs then asked, in plain English, for a circle
 * with a question mark, a funnel showing work amplified into output, a building that an "AI"
 * box attaches to and then dissolves inside, and a three-column capability matrix filling in
 * a column at a time. He got four pillars with fact rows, because that is the only sentence
 * the model could form. The fault was the VOCABULARY, not the prompt: April was translating
 * his idea into the one shape available to her.
 *
 * The fix is NOT free-form HTML. That was the deck model, and it produced layouts that ran
 * off the display and drifted off-brand, which is why the engine took ownership of rendering
 * in the first place. The fix is a LARGER vocabulary of engine-owned figures, each with its
 * own data shape. The engine still draws every pixel, so a generated prezie still cannot be
 * broken or off-brand. There are simply now several things it can say.
 *
 * Each figure exists because his prompt needed it, and each is reusable:
 *   statement  a big line, optionally behind a glyph      (his "?" opener, his sign-off)
 *   funnel     in -> through -> out                        (work amplified into output)
 *   container  a thing, with items outside or inside it    (AI bolted on vs living inside)
 *   matrix     row labels x named columns, cells filling    (human / hybrid / agentic)
 *   pillars    a comparison set                            (the original board)
 *
 * STEPS. Most of what he described was "tap and the next thing appears", so every part of a
 * figure carries an optional `step`: absent or 0 means visible immediately, and each tap
 * reveals the next one. One mechanism for all figures, and it is what lets a figure be
 * performed rather than merely displayed.
 *
 * On D31's "no next and no previous": that still holds WITHIN a figure, where objects persist
 * and transform (the building stays the same building while the AI box attaches and then
 * flows inside it). Moving between figures is a real transition, because they are genuinely
 * different pictures, and his own description is sequential: "once I tap the question mark,
 * we go into the second object".
 */

export type FigureColour = 'coral' | 'amber' | 'gold' | 'mint';

/**
 * Anything revealed on a tap. `step` absent or 0 means it is there from the start.
 *
 * `until` is what lets an object CHANGE rather than merely accumulate: Marrs asked for an
 * "AI" box that attaches to the outside of a building and then, on the next tap, stops being
 * a box outside and becomes a field flowing inside it. That is one thing in two states, so
 * the outside version lives from its step UNTIL the inside version arrives.
 */
type Stepped = { step?: number; until?: number };

/** A short label with its own reveal, used for the parts of a figure. */
export type Part = Stepped & { label: string; colour?: FigureColour };

export type Figure =
  /** One or two big lines, optionally behind a huge glyph. The opener and the sign-off. */
  | (Stepped & { kind: 'statement'; glyph?: string; lines: string[]; colour?: FigureColour })
  /** IN, through a TRANSFORM, out to OUT. The force-multiplier picture. */
  | (Stepped & { kind: 'funnel'; in: Part; through: Part; out: Part })
  /**
   * A thing with items that start OUTSIDE and can move INSIDE. "Bolted on" versus "living in
   * the organisation" is the argument itself, so it is a state rather than two figures.
   */
  | (Stepped & { kind: 'container'; label: string; items: (Part & { inside?: boolean })[] })
  /** Rows down the left, named columns across, cells filling as columns arrive. */
  | (Stepped & { kind: 'matrix'; rows: Part[]; columns: (Part & { cells?: string[] })[] })
  /** The original comparison board: a set of objects, each with facts. */
  | (Stepped & {
      kind: 'pillars';
      nodes: { label: string; colour: FigureColour; facts: { label: string; value: string }[] }[];
    });

const COLOURS: ReadonlySet<string> = new Set(['coral', 'amber', 'gold', 'mint']);
const col = (c?: string) => (c && COLOURS.has(c) ? c : '');
const esc = (s: string) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** `data-step` is what the engine's tap handler reads; 0 is omitted to keep markup quiet. */
const st = (x: Stepped) => {
  const from = x.step && x.step > 0 ? ' data-step="' + Math.floor(x.step) + '"' : '';
  const to = x.until && x.until > 0 ? ' data-until="' + Math.floor(x.until) + '"' : '';
  // An element with only `until` still needs data-step so the engine tracks it at all.
  return from || to ? (from || ' data-step="0"') + to : '';
};

/** The highest step any part declares: how many taps it takes to complete this figure. */
export function figureSteps(f: Figure): number {
  const all: Stepped[] = [f];
  if (f.kind === 'funnel') all.push(f.in, f.through, f.out);
  if (f.kind === 'container') all.push(...(f.items ?? []));
  if (f.kind === 'matrix') all.push(...(f.rows ?? []), ...(f.columns ?? []));
  if (f.kind === 'statement') return Math.max(0, (f.lines ?? []).length - 1);
  return all.reduce(
    (m, x) => Math.max(m, Math.floor(x.step ?? 0), Math.floor(x.until ?? 0)),
    0
  );
}

/** Render one figure. The engine owns every class; nothing here is author-supplied markup. */
export function renderFigure(f: Figure): string {
  switch (f.kind) {
    case 'statement': {
      // Later lines arrive on their own taps, which is how a sign-off lands after a beat.
      const lines = (f.lines ?? [])
        .filter(Boolean)
        .map(
          (l, i) =>
            '<span class="fg-line"' + (i > 0 ? ' data-step="' + i + '"' : '') + '>' + esc(l) + '</span>'
        );
      return (
        '<div class="fg fg-statement ' + col(f.colour) + '">' +
        (f.glyph ? '<span class="fg-glyph" aria-hidden>' + esc(f.glyph) + '</span>' : '') +
        '<div class="fg-lines">' + lines.join('') + '</div></div>'
      );
    }

    case 'funnel': {
      // The shape carries the claim, so the stages are deliberately not equal boxes.
      const stage = (p: Part, cls: string) =>
        '<div class="fg-stage ' + cls + ' ' + col(p.colour) + '"' + st(p) + '><span>' +
        esc(p.label) + '</span></div>';
      return (
        '<div class="fg fg-funnel">' +
        stage(f.in, 'fg-in') +
        '<span class="fg-arrow" aria-hidden' + st(f.through) + '></span>' +
        stage(f.through, 'fg-through') +
        '<span class="fg-arrow" aria-hidden' + st(f.out) + '></span>' +
        stage(f.out, 'fg-out') +
        '</div>'
      );
    }

    case 'container': {
      // Outside sits in a rail beside the container; inside is drawn within it and flows,
      // which is the visible difference between bolted on and living there.
      const items = f.items ?? [];
      const chip = (p: Part & { inside?: boolean }) =>
        '<span class="fg-item ' + col(p.colour) + '"' + st(p) + '>' + esc(p.label) + '</span>';
      const inside = items.filter((i) => i.inside);
      const outside = items.filter((i) => !i.inside);
      return (
        '<div class="fg fg-container"><div class="fg-box">' +
        '<span class="fg-boxLabel">' + esc(f.label) + '</span>' +
        (inside.length ? '<div class="fg-inside">' + inside.map(chip).join('') + '</div>' : '') +
        '</div>' +
        (outside.length ? '<div class="fg-outside">' + outside.map(chip).join('') + '</div>' : '') +
        '</div>'
      );
    }

    case 'matrix': {
      const cols = f.columns ?? [];
      const rows = f.rows ?? [];
      const head = cols
        .map((c) => '<span class="fg-col ' + col(c.colour) + '"' + st(c) + '>' + esc(c.label) + '</span>')
        .join('');
      const body = rows
        .map((r, ri) => {
          const cells = cols
            .map((c) => {
              // A cell fills when its column claims this row, by label or by 1-based index.
              // The column's own step governs it, so a column and its cells arrive together.
              const claimed = c.cells ?? [];
              const on = claimed.includes(r.label) || claimed.includes(String(ri + 1));
              return '<span class="fg-cell ' + (on ? 'on ' : '') + col(c.colour) + '"' + st(c) + '></span>';
            })
            .join('');
          return (
            '<div class="fg-row"' + st(r) + '><span class="fg-rowLabel">' + esc(r.label) +
            '</span><div class="fg-cells">' + cells + '</div></div>'
          );
        })
        .join('');
      return (
        '<div class="fg fg-matrix"><div class="fg-cols">' +
        '<span class="fg-rowLabel fg-spacer"></span><div class="fg-cells">' + head + '</div></div>' +
        body + '</div>'
      );
    }

    case 'pillars': {
      const nodes = (f.nodes ?? []).slice(0, 4).map((n) => {
        const facts = (n.facts ?? [])
          .slice(0, 4)
          .map(
            (ft) =>
              '<div class="fact"><span class="k">' + esc(ft.label) + '</span><span class="v">' +
              esc(ft.value) + '</span></div>'
          )
          .join('');
        return (
          '<div class="node ' + (col(n.colour) || 'mint') + '"><div class="body">' +
          (facts ? '<div class="facts">' + facts + '</div>' : '') +
          '</div><div class="name">' + esc(n.label) + '</div></div>'
        );
      });
      return '<div class="fg fg-pillars"><div class="fg-row-of-nodes">' + nodes.join('') + '</div></div>';
    }
  }
}

/**
 * Figure styling. Sized against the same viewport-height caps as the rest of the engine, so
 * a figure can no more produce unreadable or off-screen text than a board could.
 */
export const FIGURE_CSS = `
.fg{display:flex;align-items:center;justify-content:center;width:100%;height:100%;
  min-height:0;gap:3vw}
/* Anything waiting on a tap is ABSENT, not faded: a reveal arrives, per the hard-cut rule.
   The gone class is the same mechanism in reverse, for an object that changed state. */
.fg [data-step],.fg[data-step]{visibility:hidden}
.fg [data-step].shown,.fg[data-step].shown{visibility:visible;
  animation:fgIn .26s cubic-bezier(.22,.9,.24,1) both}
.fg [data-step].gone,.fg[data-step].gone{visibility:hidden}
@keyframes fgIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}

/* STATEMENT: the glyph is the picture and the words sit over it. */
.fg-statement{flex-direction:column;position:relative}
.fg-glyph{position:absolute;font-size:min(62vh,52vw);line-height:1;opacity:.14;
  color:currentColor;pointer-events:none;user-select:none}
.fg-lines{position:relative;display:flex;flex-direction:column;align-items:center;gap:1.5vh;
  text-align:center;max-width:88%}
.fg-line{font-size:min(clamp(30px,6.2vw,120px),12vh);line-height:1.02;letter-spacing:-.02em;
  text-transform:uppercase}

/* FUNNEL: much in, concentrated, multiplied out. The sizes are the argument. */
.fg-funnel{flex-direction:row;align-items:center}
.fg-stage{display:grid;place-items:center;text-align:center;padding:2% 2.5%;
  border:1px solid currentColor;color:var(--cream);
  font-size:min(clamp(16px,2.5vw,44px),5.2vh);text-transform:uppercase;letter-spacing:.04em}
.fg-in{width:26%;height:min(44vh,32vw);border-radius:14px;
  background:linear-gradient(180deg,rgba(255,122,107,.18),rgba(255,122,107,.04));
  border-color:rgba(255,122,107,.4)}
.fg-through{width:20%;height:min(28vh,21vw);border-radius:50%;
  background:linear-gradient(180deg,rgba(240,184,107,.22),rgba(240,184,107,.05));
  border-color:rgba(240,184,107,.5)}
.fg-out{width:30%;height:min(54vh,40vw);border-radius:14px;
  background:linear-gradient(180deg,rgba(105,252,203,.2),rgba(105,252,203,.04));
  border-color:rgba(105,252,203,.42)}
.fg-arrow{flex:0 0 auto;width:5%;height:2px;background:var(--mint);opacity:.5;position:relative}
.fg-arrow::after{content:'';position:absolute;right:-1px;top:-5px;
  border-left:10px solid var(--mint);border-top:6px solid transparent;
  border-bottom:6px solid transparent;opacity:.7}

/* CONTAINER: outside is a rail beside it; inside becomes a field within it. */
.fg-container{flex-direction:row;align-items:center;justify-content:center}
.fg-box{position:relative;width:min(50vw,56vh);height:min(52vh,46vw);border-radius:16px;
  border:1px solid rgba(244,236,228,.3);
  background:linear-gradient(180deg,rgba(244,236,228,.07),transparent);
  display:flex;flex-direction:column;align-items:center;justify-content:flex-end;
  padding:4% 4% 5%;overflow:hidden}
.fg-boxLabel{position:relative;z-index:2;color:var(--cream);
  font-size:min(clamp(18px,2.9vw,50px),5.6vh);text-transform:uppercase;letter-spacing:.06em;
  text-align:center}
.fg-inside{position:absolute;inset:6%;display:flex;align-items:center;justify-content:center;
  gap:3%;flex-wrap:wrap;border-radius:12px;
  background:radial-gradient(circle at 30% 30%,rgba(105,252,203,.24),transparent 60%),
             radial-gradient(circle at 70% 65%,rgba(105,252,203,.17),transparent 55%);
  animation:fgFlow 7s ease-in-out infinite}
@keyframes fgFlow{0%,100%{transform:scale(1) rotate(0deg)}50%{transform:scale(1.04) rotate(1.5deg)}}
.fg-inside .fg-item{border-color:rgba(105,252,203,.55);color:var(--mint)}
.fg-outside{display:flex;flex-direction:column;gap:2vh}
.fg-item{display:inline-grid;place-items:center;padding:.5em .9em;border-radius:10px;
  border:1px solid currentColor;color:var(--cream);
  font-size:min(clamp(16px,2.5vw,44px),5.2vh);text-transform:uppercase;letter-spacing:.06em}

/* MATRIX: rows down the left, columns across. The capability map itself. */
.fg-matrix{flex-direction:column;align-items:stretch;justify-content:center;gap:1.3vh;
  padding:0 2vw}
.fg-cols{display:flex;align-items:flex-end;gap:2vw}
.fg-row{display:flex;align-items:center;gap:2vw}
.fg-rowLabel{flex:0 0 34%;min-width:0;color:var(--cream);opacity:.82;
  font-family:var(--mono);font-weight:400;
  font-size:min(clamp(13px,1.8vw,30px),3.2vh);letter-spacing:.06em;text-transform:uppercase;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fg-spacer{opacity:0}
.fg-cells{flex:1 1 auto;display:flex;gap:2%}
.fg-col{flex:1 1 0;text-align:center;color:currentColor;
  font-size:min(clamp(14px,2.1vw,36px),3.8vh);text-transform:uppercase;letter-spacing:.06em;
  padding-bottom:.6vh;border-bottom:1px solid currentColor}
.fg-cell{flex:1 1 0;height:min(4.2vh,3.2vw);border-radius:6px;
  border:1px solid rgba(244,236,228,.14);background:rgba(244,236,228,.03)}
.fg-cell.on{border-color:currentColor;background:currentColor;opacity:.72}

/* PILLARS keeps the original board layout inside the figure frame. */
.fg-pillars .fg-row-of-nodes{display:flex;align-items:center;justify-content:center;
  gap:2.2vw;width:100%;height:100%;min-height:0}
`;
