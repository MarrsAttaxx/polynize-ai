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
export const FIGURE_STEP_CONTRACT = `TAPS. The document's root element (<html>) gets classes added CUMULATIVELY as the presenter taps: after one tap it has "s1", after two it has "s1 s2", and so on. So write the resting state as your normal CSS, and write each tap as a rule that starts from the class for that tap:

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
 * WHAT USED TO BE HERE, and why it is gone.
 *
 * `sanitiseFigureHtml` and `sanitiseFigureCss` stripped script, event handlers, `position: fixed`,
 * remote urls and any rule touching `html`, `body` or `:root`. They existed because figures served from
 * the console's own origin, where injected script could `fetch('/console/...')` and have the browser
 * attach Marrs's session for it. That threat was real. The mitigation was not the right one.
 *
 * Figures now render inside `sandbox="allow-scripts"` WITHOUT `allow-same-origin`, which gives each one
 * an opaque origin: no cookies, no storage, no parent DOM, no same-origin request. The security is
 * structural, so the stripping is redundant, and every one of those rules was also costing capability:
 *
 *   - no script meant no dragging, no real slider, no physics, no canvas. Marrs spent a week working
 *     around that ceiling. It was the single biggest limit on the whole stage and it was self-inflicted.
 *   - `position: fixed` is now bounded by the iframe, so it cannot reach the operator's cue strip.
 *   - `html`, `body` and `:root` are her own document's now, so styling them is legitimate.
 *   - "loads nothing from the network" is no longer enforceable by a regex once script is allowed, so it
 *     has moved into the prompt as a rule rather than pretending to be a guarantee.
 *
 * `sanitiseFigureForSandbox` below is what remains, and it is three lines.
 */

/** Round-trip a figure, clamping taps to something performable. */
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
    // CSS passes through untouched. It styles a document of its own now.
    css: String(f.css ?? '').trim(),
    html: sanitiseFigureForSandbox(f.html),
    // Nobody performs a figure with twelve taps in it, and a negative one breaks the engine.
    taps: Number.isFinite(taps) ? Math.max(0, Math.min(Math.floor(taps), 8)) : 0,
    interactive: f.interactive === true ? true : undefined,
  };
}

/**
 * SANITISING FOR THE SANDBOX, which is a much shorter list.
 *
 * A figure now runs inside an iframe with `sandbox="allow-scripts"` and NOT `allow-same-origin`, so it
 * has an opaque origin: it cannot read `document.cookie`, cannot reach `localStorage`, cannot touch the
 * parent DOM, and cannot make a same-origin request. That last one is the whole point. The real risk was
 * never cookie theft (the session cookie is httpOnly); it was that script on the console's own origin
 * can `fetch('/console/...')` and the browser attaches the session for it. An opaque origin removes
 * that, so the reason for banning script is gone.
 *
 * WHY THAT MATTERS MORE THAN THE SECURITY. Stripping script bought safety by taking capability off the
 * operator: no dragging, no real slider, no physics, no canvas. Marrs spent a week working around a
 * ceiling that isolation removes at no cost. The ban was the cheap mitigation, not the right one.
 *
 * What is still stripped, and why each one is here rather than being tidiness:
 *   - `<base>`, which would silently repoint every relative url in the document.
 *   - `<meta http-equiv>`, which can set a refresh or a CSP the engine did not choose.
 *   - top-level navigation attempts, since `allow-top-navigation` is deliberately not granted and a
 *     `target="_top"` link would just fail confusingly.
 *
 * What is NO LONGER enforceable here and has moved into the prompt: "a figure loads nothing from the
 * network". Once script is allowed it can `fetch` regardless, so pretending a regex still guarantees it
 * would be worse than saying plainly that it is now a rule April is asked to follow.
 */
export function sanitiseFigureForSandbox(raw: string): string {
  let s = String(raw ?? '');
  s = s.replace(/<\s*base\b[^>]*>/gi, '');
  s = s.replace(/<\s*meta\b[^>]*http-equiv[^>]*>/gi, '');
  s = s.replace(/\starget\s*=\s*("|')?_(top|parent)\1?/gi, ' ');
  return s.trim();
}

/**
 * Render one figure as an ISOLATED DOCUMENT inside a sandboxed iframe.
 *
 * Three things get simpler by being separate documents rather than sections of one:
 *
 * 1. CSS IS NOT SCOPED, and must not be. `scopeCss` prefixed every selector with the wrapper's id,
 *    which does not exist inside the iframe, so scoping here would break every rule. Two figures cannot
 *    collide when they are two documents, so the whole mechanism becomes unnecessary rather than
 *    merely unused.
 * 2. `position: fixed` cannot escape. It is bounded by the iframe, so the wall is structural instead of
 *    a regex the engine hopes it got right.
 * 3. Ids cannot collide, so a gradient called `grad` in two figures is finally fine.
 *
 * The step state crosses the boundary by `postMessage`, because the parent cannot touch this document's
 * DOM (that is the point) and pointer events do not cross an iframe either. So the shim below applies
 * the `s1..sN` classes it is told about, and forwards taps up so a tap-anywhere figure still advances
 * the board.
 */
export function renderFigureIframe(f: PrezieFigure, index: number): string {
  const html = sanitiseFigureForSandbox(f.html);
  const doc = `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=JetBrains+Mono&display=swap" rel="stylesheet">
<style>
/* Transparent, so the engine's substrate shows through from the parent page. */
html,body{margin:0;height:100%;background:transparent;overflow:hidden;
  font-family:'Space Grotesk',system-ui,sans-serif;font-weight:700;color:#f4ece4;
  -webkit-font-smoothing:antialiased}
body>*{position:absolute;inset:0}
:root{--ink:#0a0a0f;--cream:#f4ece4;--coral:#ff7a6b;--amber:#f0b86b;--gold:#f0e1b6;--mint:#69fccb;
  --mono:'JetBrains Mono',ui-monospace,monospace}
${f.css}
</style></head><body>
${html}
<script>
(function(){
  /* THE SHIM. The only thing the engine needs from inside here. */
  var root=document.documentElement;
  addEventListener('message',function(e){
    var d=e.data; if(!d||d.t!=='step') return;
    /* Cumulative, exactly as before: after two taps the root carries s1 AND s2, so a rule written
       for the first tap stays true for the rest of the figure. */
    for(var k=1;k<=8;k++) root.classList.toggle('s'+k, k<=d.step);
  });
  /* Pointer coordinates are forwarded RAW, and the engine does all the gesture work. The board's
     tap counting, its swipe-back and its rule about interactive figures already live there, and
     duplicating any of that inside every figure would be two places to get it wrong. */
  function send(t,x,y){ try{ parent.postMessage({t:t,i:${index},x:x,y:y},'*'); }catch(err){} }
  addEventListener('touchstart',function(e){var t=e.touches[0];send('down',t.clientX,t.clientY);},{passive:true});
  addEventListener('touchend',function(e){var t=e.changedTouches[0];send('up',t.clientX,t.clientY);},{passive:true});
  addEventListener('mousedown',function(e){send('down',e.clientX,e.clientY);});
  addEventListener('mouseup',function(e){send('up',e.clientX,e.clientY);});
  parent.postMessage({t:'ready',i:${index}},'*');
})();
<\/script>
</body></html>`;

  // srcdoc is an ATTRIBUTE, so ampersands and quotes in the whole document have to be escaped or the
  // markup terminates early. This is the one place where getting escaping wrong breaks every figure.
  const srcdoc = doc.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

  return `<iframe class="figure" id="fig${index}" data-taps="${f.taps}"${
    f.interactive ? ' data-interactive="1"' : ''
  } sandbox="allow-scripts" referrerpolicy="no-referrer" title="Figure ${index + 1}" srcdoc="${srcdoc}"></iframe>`;
}
