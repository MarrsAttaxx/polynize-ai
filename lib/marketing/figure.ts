/**
 * FIGURES, the iterative kind (D33). One figure is one picture on the touchscreen, authored
 * by April as a fragment of markup plus its own scoped CSS, and refined by conversation.
 *
 * WHY GENERATED MARKUP, HAVING ARGUED AGAINST IT. The deck model let April emit HTML and it
 * produced layouts that ran off the display and drifted off-brand, so the engine took
 * ownership of rendering and a scene became a fixed data shape. That fixed shape then could
 * not express what Marrs actually wanted: a pulsing question mark, a lever that flings the
 * work, a building that absorbs an AI box. Five figures derived from one of his prompts did
 * not cover his next prompt, and never would: the space of visual metaphors has no end.
 *
 * The diagnosis of the original failure was wrong. It was not the freedom. It was that a deck
 * generated twenty six states BLIND and the problem was discovered with a camera pointed at
 * it. There was no loop. Marrs: "she needs to be able to iterate through the process with me."
 *
 * So markup comes back, with the three things that were missing:
 *   1. ONE FIGURE AT A TIME, so a bad turn costs seconds instead of a shoot.
 *   2. A LIVE PREVIEW beside a chat, so it is seen before it matters.
 *   3. HARD BOUNDS the engine owns: the substrate, the type floor, the colour tokens, the tap
 *      mechanism, and a frame the figure cannot escape.
 *
 * What is generated is therefore constrained but unbounded: she can draw anything, using only
 * the house's own materials, inside a box she cannot break out of.
 */

/** A figure's step contract: the engine adds s1..sN cumulatively as taps accumulate. */
export const FIGURE_STEP_CONTRACT = `TAPS. The figure's root element gets classes added CUMULATIVELY as the presenter taps: after one tap it has "s1", after two it has "s1 s2", and so on. So write the resting state as your normal CSS, and write each tap as a rule that starts from the class for that tap:

  .mything{opacity:0}            /* not there yet */
  .s1 .mything{opacity:1}        /* arrives on the first tap */
  .s2 .mything{transform:...}    /* changes again on the second */

Because the classes accumulate, a rule written against .s1 stays true for every later tap, which is what you want: things stay where they were put. Declare how many taps the figure needs as "taps".`;

export type PrezieFigure = {
  /** Stable id, so a conversation can target one figure without disturbing the others. */
  figure_id: string;
  /** Operator-facing name, e.g. "the hook" or "force multiplier". */
  name: string;
  /** What was asked for, in the operator's own words. Carried so iteration has context. */
  brief: string;
  /** April's scoped CSS. Sanitised on the way in. */
  css: string;
  /** April's markup fragment. Sanitised on the way in. */
  html: string;
  /** How many taps this figure takes to complete. */
  taps: number;
  /**
   * TRUE when the figure has its own interaction and the touches belong to IT: a slider to
   * drag, several things to hit, anything where a stray tap should not move the board on.
   *
   * This exists because tap-anywhere-advances made interactive figures impossible. Marrs drew
   * a slider and could not use it: every touch on it jumped to the next figure. On an
   * interactive figure the engine stops advancing on taps and the explicit NEXT control is the
   * only way forward, which is exactly what he asked for.
   */
  interactive?: boolean;
};

/**
 * Strip anything that could execute or escape.
 *
 * These figures are served from the UNLISTED PREZIE URL, which is unauthenticated by design,
 * so injected script would run for anyone holding the link. The realistic risk here is a
 * model mistake rather than an attacker, but the blast radius is the same either way, and the
 * cost of refusing script is zero: a figure has no legitimate need for any.
 */
export function sanitiseFigureHtml(raw: string): string {
  let s = String(raw ?? '');
  // Whole elements that can execute, navigate or load remote content.
  s = s.replace(/<\s*(script|iframe|object|embed|link|meta|base|form|svg:script)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  s = s.replace(/<\s*(script|iframe|object|embed|link|meta|base)\b[^>]*\/?\s*>/gi, '');
  // Inline handlers and javascript: targets.
  s = s.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '');
  s = s.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
  s = s.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');
  s = s.replace(/javascript\s*:/gi, '');
  return s.trim();
}

/**
 * Strip CSS that would break out of the figure's box or reach off the machine.
 *
 * `position: fixed` is the one that matters: it escapes the frame entirely and would let a
 * figure cover the operator's cue strip or the whole screen. Remote urls are refused because
 * a prezie is performed in a studio and must not depend on the network mid-take.
 */
export function sanitiseFigureCss(raw: string): string {
  let s = String(raw ?? '');
  s = s.replace(/@import[^;]*;?/gi, '');
  s = s.replace(/position\s*:\s*fixed/gi, 'position:absolute');
  s = s.replace(/expression\s*\(/gi, '(');
  s = s.replace(/url\(\s*['"]?\s*(https?:)?\/\//gi, 'url(#blocked-');
  // A figure cannot address anything outside itself: no html/body/:root rules. Looped,
  // because removing one rule deletes the closing brace the next match anchors on, so a
  // single pass leaves every second one behind.
  for (let n = 0; n < 8; n++) {
    const before = s;
    s = s.replace(/(^|\})\s*(html|body|:root)\b[^{]*\{[^}]*\}/gi, '$1');
    if (s === before) break;
  }
  return s.trim();
}

/** Round-trip a figure through both sanitisers, clamping taps to something performable. */
export function sanitiseFigure(f: {
  figure_id: string;
  name: string;
  brief: string;
  css: string;
  html: string;
  taps: number;
  interactive?: boolean;
}): PrezieFigure {
  const taps = Number(f.taps);
  return {
    figure_id: f.figure_id,
    name: f.name.trim().slice(0, 80),
    brief: f.brief.trim().slice(0, 4000),
    css: sanitiseFigureCss(f.css),
    html: sanitiseFigureHtml(f.html),
    // Nobody performs a figure with twelve taps in it, and a negative one breaks the engine.
    taps: Number.isFinite(taps) ? Math.max(0, Math.min(Math.floor(taps), 8)) : 0,
    interactive: f.interactive === true ? true : undefined,
  };
}

/**
 * Render one figure inside the frame the engine owns.
 *
 * The wrapper is the boundary: it clips, it isolates stacking so a figure cannot layer over
 * the operator's cue strip, and it carries the s1..sN classes the tap contract is written
 * against. April's CSS is scoped under the wrapper's id so two figures on one page cannot
 * collide even if they both use `.box`.
 */
export function renderFigureFrame(f: PrezieFigure, index: number): string {
  const id = `fig${index}`;
  // Every selector she wrote is prefixed with this figure's own id. Two figures may both use
  // `.box` and neither will reach the other, and nothing she writes can reach the engine.
  const scoped = scopeCss(f.css, `#${id}`);
  return `<section class="figure" id="${id}" data-taps="${f.taps}"${
    f.interactive ? ' data-interactive="1"' : ''
  }>
<style>${scoped}</style>
${f.html}
</section>`;
}

/**
 * Prefix every selector in a CSS block with `scope`.
 *
 * Deliberately simple and text-based: it walks top level rules, leaves at-rules' preludes
 * alone while scoping their bodies (so @keyframes and @media keep working), and prefixes each
 * comma-separated selector. It is not a CSS parser and does not need to be; the input is one
 * small generated block, and anything it fails to scope is still trapped by the wrapper's
 * clipping. `:root` and friends are already gone by the time this runs.
 */
export function scopeCss(css: string, scope: string): string {
  const out: string[] = [];
  let i = 0;
  const s = css;
  while (i < s.length) {
    const brace = s.indexOf('{', i);
    if (brace === -1) break;
    const prelude = s.slice(i, brace).trim();
    // Find the matching close brace, allowing one level of nesting for at-rules.
    let depth = 1;
    let j = brace + 1;
    while (j < s.length && depth > 0) {
      if (s[j] === '{') depth++;
      else if (s[j] === '}') depth--;
      j++;
    }
    const body = s.slice(brace + 1, j - 1);

    if (prelude.startsWith('@')) {
      // Keyframes are named, not selected: their steps must NOT be scoped.
      if (/^@(keyframes|font-face|property)/i.test(prelude)) {
        out.push(`${prelude}{${body}}`);
      } else {
        // @media and friends: scope what is inside them.
        out.push(`${prelude}{${scopeCss(body, scope)}}`);
      }
    } else {
      const sel = prelude
        .split(',')
        .map((p) => {
          const t = p.trim();
          if (!t) return '';
          // A rule targeting the root itself (the step classes) attaches to the wrapper.
          if (/^\.s\d/.test(t)) return `${scope}${t}`;
          return `${scope} ${t}`;
        })
        .filter(Boolean)
        .join(',');
      if (sel) out.push(`${sel}{${body}}`);
    }
    i = j;
  }
  return out.join('\n');
}
