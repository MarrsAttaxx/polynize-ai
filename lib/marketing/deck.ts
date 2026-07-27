/**
 * The DECK ENGINE: the house style for the touchscreen pages Marrs performs to
 * camera (D29). Replaces the external animator handoff, which lost fidelity on every
 * round trip and produced inconsistent work.
 *
 * The split is deliberate: this module owns EVERYTHING that makes a deck look like
 * Polynize (the blueprint substrate, tactile depth, type scale, transitions, gesture
 * handling, the operator cue strip), and a piece supplies only its STATES. So
 * elevating the look is a change in one place that lifts every deck, and a generated
 * deck cannot drift off-brand.
 *
 * Output is one self-contained HTML document: no build step, no external assets
 * except the Space Grotesk webfont, so it runs fullscreen from a URL on the studio
 * machine and advances on tap.
 */

export type DeckState = {
  /** Beat label from the script, so the deck and the script stay in lockstep. */
  label: string;
  /** The operator's next-gesture cue, shown faintly at the bottom edge. */
  cue?: string;
  /** The state's content, composed from the house vocabulary below. */
  html: string;
};

export type Deck = {
  title: string;
  states: DeckState[];
};

/**
 * The house vocabulary a deck's states are composed from. Kept small on purpose:
 * a constrained set produces a coherent piece, and every class already carries the
 * brand's depth, colour and motion.
 */
export const DECK_VOCABULARY = `Compose each state from these classes only.

Layout
- <div class="stack">…</div>      vertical stack, centred
- <div class="row">…</div>        horizontal row, centred, evenly spaced
- Add "left" or "right" to a layout to push content off centre: <div class="stack left">

Elements
- <div class="word">STRIP THE AI</div>        the huge headline. One per state.
- <div class="sub">supporting line</div>       smaller line under a word
- <div class="num">2 HOURS</div>               a big number or figure (reads as proof)
- <div class="pillar"><span>AI ADDICTED</span></div>   a standing block, labelled
- <div class="card">…</div>                    a raised tactile card
- <div class="well">…</div>                    content carved into the surface
- <div class="meter" data-level="high">RISK</div>   a risk meter: level low | mid | high

Colour modifiers (add to any element)
- "mint" resolution, where we want people to be
- "coral" the problem
- "amber" tension
- "gold" proof, numbers
- "dim" recede into the background

State modifiers (add to the element)
- "glow" pulsing emphasis, for the state you want remembered
- "grain" adds a dithered, pixelated texture
- "big" / "small" nudge the scale

Example state html:
<div class="row"><div class="pillar coral grain"><span>AI ADDICTED</span></div><div class="pillar amber grain dim"><span>AI ILLITERATE</span></div><div class="pillar mint grain dim"><span>AI AMPLIFIED</span></div></div>`;

const ENGINE_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --ink:#0a0a0f; --bg:#121219; --surface:#1c1c27; --inset:#0f0f17;
  --cream:#f4ece4; --mint:#69fccb; --coral:#ff7a6b; --amber:#f0b86b; --gold:#f0e1b6;
  --edge-light:rgba(255,255,255,.07); --edge-dark:rgba(0,0,0,.55);
  --raised:0 1px 0 var(--edge-light) inset,0 -1px 0 var(--edge-dark) inset,
           0 2px 4px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.45);
}
html,body{height:100%;overflow:hidden;background:var(--ink);cursor:none}
body{
  font-family:'Space Grotesk',system-ui,sans-serif;font-weight:700;color:var(--cream);
  display:flex;align-items:center;justify-content:center;
  -webkit-font-smoothing:antialiased;user-select:none;-webkit-user-select:none;
  -webkit-tap-highlight-color:transparent;
}
/* The blueprint substrate: a fine crosshatch over a deep ink field, with a heavier
   grid every 8 cells and a vignette so the centre lifts. */
body::before{
  content:'';position:fixed;inset:0;pointer-events:none;
  background-image:
    linear-gradient(rgba(105,252,203,.035) 1px,transparent 1px),
    linear-gradient(90deg,rgba(105,252,203,.035) 1px,transparent 1px),
    linear-gradient(rgba(105,252,203,.07) 1px,transparent 1px),
    linear-gradient(90deg,rgba(105,252,203,.07) 1px,transparent 1px);
  background-size:40px 40px,40px 40px,320px 320px,320px 320px;
}
body::after{
  content:'';position:fixed;inset:0;pointer-events:none;
  background:radial-gradient(ellipse at 50% 45%,transparent 40%,rgba(0,0,0,.55) 100%);
}
#stage{position:relative;z-index:2;width:100%;height:100%;
  display:flex;align-items:center;justify-content:center;padding:6vh 5vw}
.state{display:none;width:100%;align-items:center;justify-content:center}
.state.on{display:flex}

.stack{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2.4vh;width:100%}
.row{display:flex;flex-direction:row;align-items:center;justify-content:center;gap:3.5vw;width:100%}
.stack.left,.row.left{align-items:flex-start;justify-content:flex-start;text-align:left}
.stack.right,.row.right{align-items:flex-end;justify-content:flex-end;text-align:right}

.word{font-size:clamp(48px,11vw,190px);line-height:.94;letter-spacing:-.02em;text-transform:uppercase}
.word.small{font-size:clamp(36px,7vw,120px)} .word.big{font-size:clamp(64px,14vw,240px)}
.sub{font-size:clamp(18px,2.6vw,42px);letter-spacing:.02em;opacity:.72;font-weight:500}
.num{font-size:clamp(60px,15vw,260px);line-height:.9;color:var(--gold);letter-spacing:-.03em}

.pillar{
  flex:1;min-width:0;max-width:30%;aspect-ratio:.52;border-radius:18px;
  background:linear-gradient(180deg,var(--surface),var(--inset));
  box-shadow:var(--raised);
  display:flex;align-items:flex-end;justify-content:center;padding:3% 2% 5%;
  position:relative;overflow:hidden;
}
.pillar span{font-size:clamp(13px,1.9vw,30px);letter-spacing:.06em;text-transform:uppercase;text-align:center;line-height:1.15}
.card{background:var(--surface);box-shadow:var(--raised);border-radius:20px;padding:4vh 4vw}
.well{background:var(--inset);border-radius:20px;padding:4vh 4vw;
  box-shadow:0 2px 3px var(--edge-light),0 -1px 2px var(--edge-dark) inset,0 12px 28px rgba(0,0,0,.5) inset}

/* Texture: a dithered pixel wash, which is what reads as "not a slide". */
.grain::after{
  content:'';position:absolute;inset:0;pointer-events:none;opacity:.5;
  background-image:radial-gradient(rgba(255,255,255,.14) 1px,transparent 1px);
  background-size:6px 6px;mix-blend-mode:overlay;
}
.mint{color:var(--mint)} .coral{color:var(--coral)} .amber{color:var(--amber)} .gold{color:var(--gold)}
.pillar.mint{background:linear-gradient(180deg,rgba(105,252,203,.22),rgba(105,252,203,.05));border:1px solid rgba(105,252,203,.35)}
.pillar.coral{background:linear-gradient(180deg,rgba(255,122,107,.22),rgba(255,122,107,.05));border:1px solid rgba(255,122,107,.35)}
.pillar.amber{background:linear-gradient(180deg,rgba(240,184,107,.22),rgba(240,184,107,.05));border:1px solid rgba(240,184,107,.35)}
.dim{opacity:.3;filter:saturate(.4)}
.glow{animation:glow 2.2s ease-in-out infinite}
@keyframes glow{0%,100%{filter:drop-shadow(0 0 0 rgba(105,252,203,0))}50%{filter:drop-shadow(0 0 28px rgba(105,252,203,.55))}}

/* Risk meter: a carved track with a filled bar, colour keyed to the level. */
.meter{position:relative;display:flex;flex-direction:column;gap:1.2vh;align-items:center;
  font-size:clamp(12px,1.5vw,22px);letter-spacing:.14em;opacity:.85}
.meter::after{content:'';display:block;width:clamp(120px,22vw,340px);height:14px;border-radius:99px;
  background:var(--inset);box-shadow:0 -1px 2px var(--edge-dark) inset,0 1px 0 var(--edge-light)}
.meter::before{content:'';position:absolute;bottom:0;left:50%;transform:translateX(-50%);
  height:14px;border-radius:99px;z-index:2;transition:width .5s cubic-bezier(.2,.9,.2,1)}
.meter[data-level="high"]::before{width:clamp(110px,20vw,310px);background:var(--coral);box-shadow:0 0 18px rgba(255,122,107,.6)}
.meter[data-level="mid"]::before{width:clamp(70px,12vw,190px);background:var(--amber);box-shadow:0 0 18px rgba(240,184,107,.5)}
.meter[data-level="low"]::before{width:clamp(28px,5vw,80px);background:var(--mint);box-shadow:0 0 18px rgba(105,252,203,.6)}

/* Decisive entrance. No crossfades: things arrive. */
.state.on > *{animation:arrive .34s cubic-bezier(.2,.9,.2,1) both}
.state.on .row > *{animation:arrive .34s cubic-bezier(.2,.9,.2,1) both}
.state.on .row > *:nth-child(2){animation-delay:.06s}
.state.on .row > *:nth-child(3){animation-delay:.12s}
@keyframes arrive{from{opacity:0;transform:translateY(26px) scale(.97)}to{opacity:1;transform:none}}

/* The operator strip: legible standing over the screen, invisible on camera. */
#cue{position:fixed;left:0;right:0;bottom:14px;z-index:5;text-align:center;
  font-size:14px;letter-spacing:.22em;text-transform:uppercase;
  color:var(--cream);opacity:.07;font-weight:500}
`;

const ENGINE_JS = `
(function(){
  var states=[].slice.call(document.querySelectorAll('.state'));
  var cues=JSON.parse(document.getElementById('cues').textContent);
  var i=0, cue=document.getElementById('cue');
  function show(n){
    if(n<0||n>=states.length) return;
    states[i].classList.remove('on'); i=n;
    // Re-trigger the entrance animation on the incoming state.
    var s=states[i]; s.classList.add('on');
    [].slice.call(s.children).forEach(function(c){ c.style.animation='none'; void c.offsetWidth; c.style.animation=''; });
    cue.textContent=(cues[i]||'')+'   '+(i+1)+'/'+states.length;
  }
  function next(){ show(Math.min(i+1,states.length-1)); }
  function prev(){ show(Math.max(i-1,0)); }
  document.addEventListener('click',function(e){ (e.clientX < window.innerWidth*0.15) ? prev() : next(); });
  document.addEventListener('keydown',function(e){
    if(e.key==='ArrowRight'||e.key===' '||e.key==='Enter') next();
    if(e.key==='ArrowLeft') prev();
    if(e.key==='Home') show(0);
  });
  show(0);
})();
`;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Render a deck to one self-contained HTML document. */
export function renderDeck(deck: Deck): string {
  const states = deck.states
    .map((st, i) => `<section class="state${i === 0 ? ' on' : ''}">${st.html}</section>`)
    .join('\n');
  const cues = JSON.stringify(deck.states.map((s) => s.cue ?? ''));
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(deck.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<style>${ENGINE_CSS}</style>
</head><body>
<div id="stage">
${states}
</div>
<div id="cue"></div>
<script type="application/json" id="cues">${cues}</script>
<script>${ENGINE_JS}</script>
</body></html>`;
}
