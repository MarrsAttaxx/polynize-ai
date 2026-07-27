/**
 * The DECK ENGINE: the house style AND the interaction language for the touchscreen
 * pages Marrs performs to camera (D29). Replaces the external animator handoff, which
 * lost fidelity every round trip and produced inconsistent work.
 *
 * The design goal is that the viewer reads an INTELLIGENT INTERFACE being operated,
 * not a person clicking through slides. Two things deliver that:
 *
 * 1. STEPS WITHIN A STATE. Elements carry data-step and are revealed one gesture at a
 *    time, so a touch always causes a specific, motivated reveal. Only when a state's
 *    steps are spent does the next gesture move to the next state. This is what makes
 *    the touching purposeful rather than decorative.
 * 2. A GESTURE LANGUAGE with fixed meanings, so the audience learns to read it:
 *      TAP         reveal the next thing / commit
 *      DOUBLE TAP  lock on, drill in (brackets close, telemetry prints)
 *      SWIPE LEFT  advance, push the current frame out
 *      SWIPE RIGHT go back
 *      SWIPE UP    elevate, raise detail from below
 *      SWIPE DOWN  collapse, dismiss detail
 *    The exit animation is chosen BY the gesture, so the motion always matches the
 *    hand: a swipe left pushes left, a swipe up lifts.
 *
 * Everything that makes a deck look like Polynize lives here (blueprint substrate,
 * tactile depth, HUD chrome, type scale, motion, the operator cue strip) and a piece
 * supplies only its STATES. So elevating the look is a one-place change that lifts
 * every deck, and a generated deck cannot drift off-brand.
 *
 * renderDeck() emits one self-contained HTML document: no build step, runs fullscreen
 * from a URL on the studio machine.
 */

export type DeckGesture =
  | 'tap'
  | 'double-tap'
  | 'swipe-left'
  | 'swipe-right'
  | 'swipe-up'
  | 'swipe-down';

export type DeckState = {
  /** Beat label from the script, so the deck and the script stay in lockstep. */
  label: string;
  /** The operator's next-gesture cue, shown faintly at the bottom edge. */
  cue?: string;
  /** The gesture that exits this state. Its direction drives the exit motion. */
  exit?: DeckGesture;
  /** The state's content, composed from the house vocabulary. */
  html: string;
};

export type Deck = {
  title: string;
  states: DeckState[];
};

/** The house vocabulary a deck's states are composed from. */
export const DECK_VOCABULARY = `Compose each state from these classes only. A constrained
set is what makes the piece read as one designed system.

Layout
- <div class="stack">…</div>   vertical, centred      - <div class="row">…</div>   horizontal, centred
- add "left" or "right" to push the group off centre

Elements
- <div class="word">STRIP THE AI</div>              the huge headline, one per state
- <div class="sub">supporting line</div>            smaller line beneath
- <div class="num">2 HOURS</div>                    a figure, reads as proof
- <div class="pillar"><span>AI ADDICTED</span></div>  a standing block, labelled
- <div class="card">…</div>   raised card            - <div class="well">…</div>   carved into the surface
- <div class="meter" data-level="high">RISK</div>    risk meter, level low | mid | high
- <div class="hud">SCAN: COMPLETE</div>             a small monospace telemetry readout

Modifiers (add to any element)
- colour: "mint" resolution · "coral" problem · "amber" tension · "gold" proof · "dim" recede
- "glow" pulsing emphasis · "grain" dithered texture · "big" / "small" scale
- "focus" the engine snaps HUD corner brackets around it

REVEALS (this is what makes the touching purposeful)
Give elements data-step="1", data-step="2" … and they stay hidden until the operator
reaches that step. Anything without data-step is present from the start. Each TAP
advances one step, so build each state as a sequence of motivated reveals rather than
one finished picture.

Example
<div class="stack">
  <div class="word coral">AI ADDICTED</div>
  <div class="meter coral" data-step="1" data-level="high">HIGH RISK</div>
  <div class="hud" data-step="2">ONE UPSIDE: THEY KNOW THE TOOLS</div>
</div>`;

const ENGINE_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --ink:#0a0a0f;--surface:#1c1c27;--inset:#0f0f17;
  --cream:#f4ece4;--mint:#69fccb;--coral:#ff7a6b;--amber:#f0b86b;--gold:#f0e1b6;
  --edge-light:rgba(255,255,255,.07);--edge-dark:rgba(0,0,0,.55);
  --raised:0 1px 0 var(--edge-light) inset,0 -1px 0 var(--edge-dark) inset,
           0 2px 4px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.45);
  --mono:ui-monospace,'SF Mono',Menlo,monospace;
}
html,body{height:100%;overflow:hidden;background:var(--ink);cursor:none;touch-action:none}
body{font-family:'Space Grotesk',system-ui,sans-serif;font-weight:700;color:var(--cream);
  -webkit-font-smoothing:antialiased;user-select:none;-webkit-user-select:none;
  -webkit-tap-highlight-color:transparent;overscroll-behavior:none}

/* Blueprint substrate: fine crosshatch on deep ink, heavier grid every 8 cells,
   breathing slowly so the surface is never dead. */
body::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:0;
  background-image:
    linear-gradient(rgba(105,252,203,.04) 1px,transparent 1px),
    linear-gradient(90deg,rgba(105,252,203,.04) 1px,transparent 1px),
    linear-gradient(rgba(105,252,203,.075) 1px,transparent 1px),
    linear-gradient(90deg,rgba(105,252,203,.075) 1px,transparent 1px);
  background-size:40px 40px,40px 40px,320px 320px,320px 320px;
  animation:breathe 7s ease-in-out infinite}
@keyframes breathe{0%,100%{opacity:.55}50%{opacity:1}}
body::after{content:'';position:fixed;inset:0;pointer-events:none;z-index:1;
  background:radial-gradient(ellipse at 50% 45%,transparent 38%,rgba(0,0,0,.6) 100%)}

/* Phosphor scanline sweep: fires on every state change, so the interface reads as
   redrawing itself rather than cutting. */
#sweep{position:fixed;left:0;right:0;top:0;height:34vh;z-index:6;pointer-events:none;opacity:0;
  background:linear-gradient(180deg,transparent,rgba(105,252,203,.05) 60%,rgba(105,252,203,.14));
  border-bottom:1px solid rgba(105,252,203,.4)}
#sweep.run{animation:sweep .5s cubic-bezier(.3,.8,.2,1)}
@keyframes sweep{0%{opacity:1;transform:translateY(-40vh)}100%{opacity:0;transform:translateY(105vh)}}

#stage{position:relative;z-index:3;width:100vw;height:100vh;
  display:flex;align-items:center;justify-content:center;padding:8vh 5vw}
.state{display:none;width:100%;align-items:center;justify-content:center}
.state.on{display:flex}

.stack{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2.6vh;width:100%}
.row{display:flex;align-items:center;justify-content:center;gap:3.5vw;width:100%}
.stack.left,.row.left{align-items:flex-start;justify-content:flex-start;text-align:left}
.stack.right,.row.right{align-items:flex-end;justify-content:flex-end;text-align:right}

.word{font-size:clamp(48px,10.5vw,180px);line-height:.94;letter-spacing:-.02em;text-transform:uppercase}
.word.small{font-size:clamp(34px,6.5vw,110px)}.word.big{font-size:clamp(62px,13.5vw,230px)}
.sub{font-size:clamp(17px,2.4vw,38px);letter-spacing:.01em;opacity:.7;font-weight:500}
.num{font-size:clamp(56px,14vw,240px);line-height:.9;color:var(--gold);letter-spacing:-.03em}
.hud{font-family:var(--mono);font-weight:400;font-size:clamp(11px,1.35vw,20px);
  letter-spacing:.2em;text-transform:uppercase;opacity:.62;
  padding:.5em .9em;border:1px solid rgba(244,236,228,.14);border-radius:4px}

.pillar{flex:1;min-width:0;max-width:29%;aspect-ratio:.54;border-radius:16px;position:relative;overflow:hidden;
  background:linear-gradient(180deg,var(--surface),var(--inset));box-shadow:var(--raised);
  display:flex;align-items:flex-end;justify-content:center;padding:3% 2% 6%;
  animation:idle 5s ease-in-out infinite}
@keyframes idle{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.pillar span{font-size:clamp(12px,1.75vw,27px);letter-spacing:.07em;text-transform:uppercase;text-align:center;line-height:1.15}
.card{background:var(--surface);box-shadow:var(--raised);border-radius:18px;padding:4vh 4vw}
.well{background:var(--inset);border-radius:18px;padding:4vh 4vw;
  box-shadow:0 2px 3px var(--edge-light),0 -1px 2px var(--edge-dark) inset,0 12px 28px rgba(0,0,0,.5) inset}

.grain::after{content:'';position:absolute;inset:0;pointer-events:none;opacity:.45;
  background-image:radial-gradient(rgba(255,255,255,.13) 1px,transparent 1px);
  background-size:6px 6px;mix-blend-mode:overlay}
.mint{color:var(--mint)}.coral{color:var(--coral)}.amber{color:var(--amber)}.gold{color:var(--gold)}
.pillar.mint{background:linear-gradient(180deg,rgba(105,252,203,.2),rgba(105,252,203,.04));border:1px solid rgba(105,252,203,.32)}
.pillar.coral{background:linear-gradient(180deg,rgba(255,122,107,.2),rgba(255,122,107,.04));border:1px solid rgba(255,122,107,.32)}
.pillar.amber{background:linear-gradient(180deg,rgba(240,184,107,.2),rgba(240,184,107,.04));border:1px solid rgba(240,184,107,.32)}
.dim{opacity:.26;filter:saturate(.35)}
.glow{animation:glow 2.2s ease-in-out infinite}
@keyframes glow{0%,100%{filter:drop-shadow(0 0 0 rgba(105,252,203,0))}50%{filter:drop-shadow(0 0 30px rgba(105,252,203,.6))}}

/* HUD corner brackets: the interface locking onto a thing. */
.focus{position:relative}
.focus::before,.focus::after{content:'';position:absolute;width:26px;height:26px;pointer-events:none;
  border:2px solid var(--mint);opacity:.85;animation:lock .3s cubic-bezier(.2,.9,.2,1) both}
.focus::before{top:-12px;left:-12px;border-right:none;border-bottom:none}
.focus::after{bottom:-12px;right:-12px;border-left:none;border-top:none}
@keyframes lock{from{opacity:0;transform:scale(1.7)}to{opacity:.85;transform:scale(1)}}

.meter{position:relative;display:flex;flex-direction:column;gap:1.2vh;align-items:center;
  font-family:var(--mono);font-weight:400;font-size:clamp(11px,1.4vw,20px);letter-spacing:.18em;opacity:.9}
.meter::after{content:'';display:block;width:clamp(120px,22vw,330px);height:12px;border-radius:99px;
  background:var(--inset);box-shadow:0 -1px 2px var(--edge-dark) inset,0 1px 0 var(--edge-light)}
.meter::before{content:'';position:absolute;bottom:0;left:50%;transform:translateX(-50%);height:12px;border-radius:99px;z-index:2;
  animation:fill .6s cubic-bezier(.2,.9,.2,1) both}
.meter[data-level="high"]::before{width:clamp(108px,20vw,300px);background:var(--coral);box-shadow:0 0 18px rgba(255,122,107,.65)}
.meter[data-level="mid"]::before{width:clamp(68px,12vw,180px);background:var(--amber);box-shadow:0 0 18px rgba(240,184,107,.55)}
.meter[data-level="low"]::before{width:clamp(26px,4.5vw,74px);background:var(--mint);box-shadow:0 0 18px rgba(105,252,203,.65)}
@keyframes fill{from{width:0}}

/* Reveals: a step arrives, it never fades in. */
[data-step]{display:none}
[data-step].shown{display:block;animation:arrive .32s cubic-bezier(.2,.9,.2,1) both}
.row > [data-step].shown{display:flex}
.state.on > *{animation:arrive .34s cubic-bezier(.2,.9,.2,1) both}
.state.on .row > *:not([data-step]){animation:arrive .34s cubic-bezier(.2,.9,.2,1) both}
.state.on .row > *:nth-child(2){animation-delay:.06s}
.state.on .row > *:nth-child(3){animation-delay:.12s}
@keyframes arrive{from{opacity:0;transform:translateY(24px) scale(.97)}to{opacity:1;transform:none}}

/* Exit motion is chosen by the gesture, so the frame moves with the hand. */
.state.out-left{animation:outLeft .3s cubic-bezier(.5,0,.75,0) both;display:flex}
.state.out-right{animation:outRight .3s cubic-bezier(.5,0,.75,0) both;display:flex}
.state.out-up{animation:outUp .3s cubic-bezier(.5,0,.75,0) both;display:flex}
.state.out-down{animation:outDown .3s cubic-bezier(.5,0,.75,0) both;display:flex}
.state.out-in{animation:outIn .28s cubic-bezier(.5,0,.75,0) both;display:flex}
@keyframes outLeft{to{opacity:0;transform:translateX(-14vw) scale(.96)}}
@keyframes outRight{to{opacity:0;transform:translateX(14vw) scale(.96)}}
@keyframes outUp{to{opacity:0;transform:translateY(-12vh) scale(.96)}}
@keyframes outDown{to{opacity:0;transform:translateY(12vh) scale(.96)}}
@keyframes outIn{to{opacity:0;transform:scale(1.12)}}

/* Targeting reticle: follows the touch so the audience sees the interface respond. */
#reticle{position:fixed;z-index:7;width:76px;height:76px;margin:-38px 0 0 -38px;pointer-events:none;opacity:0;
  border:1px solid rgba(105,252,203,.6);border-radius:50%}
#reticle::after{content:'';position:absolute;inset:26px;border:1px solid rgba(105,252,203,.9);border-radius:50%}
#reticle.hit{animation:ping .45s cubic-bezier(.2,.9,.2,1)}
@keyframes ping{0%{opacity:1;transform:scale(.5)}100%{opacity:0;transform:scale(1.5)}}

/* Operator strip: legible standing over the screen, invisible on camera. */
#cue{position:fixed;left:0;right:0;bottom:13px;z-index:8;text-align:center;font-family:var(--mono);
  font-size:13px;letter-spacing:.24em;text-transform:uppercase;color:var(--cream);opacity:.07;font-weight:400}
/* Boot: the interface comes up rather than just existing. */
#stage.boot{animation:boot .5s steps(3) both}
@keyframes boot{0%{opacity:0}40%{opacity:.5}60%{opacity:.2}100%{opacity:1}}
`;

const ENGINE_JS = `
(function(){
  var states=[].slice.call(document.querySelectorAll('.state'));
  var meta=JSON.parse(document.getElementById('meta').textContent);
  var cue=document.getElementById('cue'), ret=document.getElementById('reticle'),
      sweep=document.getElementById('sweep'), stage=document.getElementById('stage');
  var i=0, step=0;
  var EXIT={'swipe-left':'out-left','swipe-right':'out-right','swipe-up':'out-up',
            'swipe-down':'out-down','tap':'out-in','double-tap':'out-in'};
  var LABEL={'tap':'TAP','double-tap':'DOUBLE TAP','swipe-left':'SWIPE LEFT',
             'swipe-right':'SWIPE RIGHT','swipe-up':'SWIPE UP','swipe-down':'SWIPE DOWN'};

  function steps(n){ return [].slice.call(states[n].querySelectorAll('[data-step]')); }
  function maxStep(n){ return steps(n).reduce(function(m,e){ return Math.max(m,+e.dataset.step||0); },0); }
  function paint(){
    var m=maxStep(i), ex=meta[i].exit||'tap';
    var txt = step<m ? LABEL['tap']+' TO REVEAL' : LABEL[ex]+' TO ADVANCE';
    cue.textContent=txt+'   '+(i+1)+'/'+states.length;
  }
  function render(){
    steps(i).forEach(function(e){ e.classList.toggle('shown',(+e.dataset.step||0)<=step); });
    paint();
  }
  function enter(n){
    states[i].className='state'; i=n; step=0;
    var s=states[i]; s.classList.add('on');
    [].slice.call(s.children).forEach(function(c){ c.style.animation='none'; void c.offsetWidth; c.style.animation=''; });
    sweep.classList.remove('run'); void sweep.offsetWidth; sweep.classList.add('run');
    render();
  }
  function go(n,g){
    if(n<0||n>=states.length) return;
    var cls=EXIT[g]||'out-in', cur=states[i];
    cur.classList.add(cls);
    setTimeout(function(){ cur.classList.remove(cls); enter(n); },230);
  }
  function act(g,x,y){
    if(x!=null){ ret.style.left=x+'px'; ret.style.top=y+'px';
      ret.classList.remove('hit'); void ret.offsetWidth; ret.classList.add('hit'); }
    var m=maxStep(i), ex=meta[i].exit||'tap';
    // A tap reveals the next step first; the state only advances once they are spent.
    if(g==='tap' && step<m){ step++; render(); return; }
    if(g==='swipe-right'){ go(i-1,'swipe-right'); return; }
    if(g===ex || g==='tap' || g==='swipe-left'){ go(i+1,g); return; }
    if(g==='swipe-down' && step>0){ step--; render(); return; }
  }

  // Gesture recogniser: tap, double tap, and the four swipes, from touch or mouse.
  var sx=0,sy=0,st=0,lastTap=0,pending=null;
  function down(x,y){ sx=x; sy=y; st=Date.now(); }
  function up(x,y){
    var dx=x-sx, dy=y-sy, dt=Date.now()-st, ax=Math.abs(dx), ay=Math.abs(dy);
    if(Math.max(ax,ay)>60 && dt<800){
      clearTimeout(pending); pending=null;
      act(ax>ay ? (dx<0?'swipe-left':'swipe-right') : (dy<0?'swipe-up':'swipe-down'), x, y);
      return;
    }
    var now=Date.now();
    if(now-lastTap<280){ clearTimeout(pending); pending=null; lastTap=0; act('double-tap',x,y); return; }
    lastTap=now;
    // Hold a single tap briefly so a second one can promote it to a double tap.
    pending=setTimeout(function(){ pending=null; act('tap',x,y); },250);
  }
  window.addEventListener('touchstart',function(e){ var t=e.touches[0]; down(t.clientX,t.clientY); },{passive:true});
  window.addEventListener('touchend',function(e){ var t=e.changedTouches[0]; up(t.clientX,t.clientY); },{passive:true});
  window.addEventListener('mousedown',function(e){ down(e.clientX,e.clientY); });
  window.addEventListener('mouseup',function(e){ up(e.clientX,e.clientY); });
  window.addEventListener('keydown',function(e){
    var k=e.key;
    if(k==='ArrowRight'||k===' '||k==='Enter') act('tap');
    else if(k==='ArrowLeft') act('swipe-right');
    else if(k==='ArrowUp') act('swipe-up');
    else if(k==='ArrowDown') act('swipe-down');
    else if(k==='Home') enter(0);
  });
  stage.classList.add('boot');
  enter(0);
})();
`;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Render a deck to one self-contained HTML document. */
export function renderDeck(deck: Deck): string {
  const states = deck.states
    .map((st) => `<section class="state">${st.html}</section>`)
    .join('\n');
  const meta = JSON.stringify(
    deck.states.map((s) => ({ cue: s.cue ?? '', exit: s.exit ?? 'tap' }))
  );
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<title>${esc(deck.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<style>${ENGINE_CSS}</style>
</head><body>
<div id="sweep"></div>
<div id="stage">
${states}
</div>
<div id="reticle"></div>
<div id="cue"></div>
<script type="application/json" id="meta">${meta}</script>
<script>${ENGINE_JS}</script>
</body></html>`;
}
