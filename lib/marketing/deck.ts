/**
 * The DECK ENGINE: the house style AND the interaction language for the touchscreen
 * pages Marrs performs to camera (D29). Replaces the external animator handoff, which
 * lost fidelity every round trip and produced inconsistent work.
 *
 * The design goal is that the viewer reads an INTELLIGENT INTERFACE being operated,
 * not a person clicking through slides. Two things deliver that:
 *
 * 1. LESS IS MORE (Marrs). One state is ONE talking point, for one beat of the script.
 *    The drama belongs in the TRANSITION between beats, not in a stack of little
 *    reveals, so a state is usually one composed picture. data-step exists for the
 *    occasional two-part beat (a claim, then its proof) and is used sparingly.
 * 2. A GESTURE LANGUAGE where each gesture triggers its own FIGURE animation, drawn on
 *    a canvas between beats. The figures are cymatics and Lissajous curves, which is a
 *    motif with meaning here and not just decoration: a Chladni pattern is literally
 *    invisible structure made visible in a vibrating medium, which is the thesis these
 *    pieces argue about work.
 *      TAP         a plain cut, the quiet advance
 *      DOUBLE TAP  a reticle snaps shut: lock on, commit to a conclusion
 *      SWIPE LEFT  a Lissajous curve sweeps the frame: advance
 *      SWIPE RIGHT go back
 *      SWIPE UP/DOWN  the plate resonates, a Chladni pattern reorganises: a structural shift
 *      PINCH       concentric rings pull in: narrow to a detail
 *    The exit motion is also chosen BY the gesture, so the frame moves with the hand.
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
  | 'swipe-down'
  | 'pinch';

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
- <div class="corner tl coral">RISK: HIGH</div>     a persistent readout parked in a corner
                                                    ("tl" top-left, "tr" top-right)

Modifiers (add to any element)
- colour ROLE: "mint" resolution · "coral" problem · "amber" tension · "gold" proof
- "dim" recede. This is a STATE, not a colour: keep the element's colour role and add
  "dim" on top (class="pillar coral dim"), so a receding element still reads as itself.
- "glow" pulsing emphasis · "grain" dithered texture · "big" / "small" scale
- "focus" the engine snaps HUD corner brackets around it

EVERY element that carries meaning takes a colour role. A set of pillars or cards is
coloured by what each one MEANS (the problem coral, the tension amber, the proof gold,
the resolution mint), and an element keeps that same colour every time it appears, so
the deck reads as one system. Leaving them uncoloured produces a monochrome deck that
throws away the fastest signal the format has.

LESS IS MORE. One state is ONE talking point, for one beat of the script. Do not
punctuate every sentence: the drama belongs in the TRANSITION between beats, not in a
stack of little reveals. A state is usually a single composed picture.

Optional second beat within a state: give an element data-step="1" and it stays hidden
until one TAP reveals it. Use this sparingly, at most once in a state, and only when
the spoken line genuinely lands in two parts (a claim, then its proof).

Example
<div class="stack">
  <div class="word coral">AI ADDICTED</div>
  <div class="meter coral" data-step="1" data-level="high">HIGH RISK</div>
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

/* OSCILLOSCOPE GRATICULE: 10 x 8 divisions with subdivisions, the etched screen of a
   bench instrument rather than a blueprint. */
#grat{position:fixed;inset:0;pointer-events:none;z-index:0;
  background-image:
    linear-gradient(rgba(105,252,203,.045) 1px,transparent 1px),
    linear-gradient(90deg,rgba(105,252,203,.045) 1px,transparent 1px),
    linear-gradient(rgba(105,252,203,.10) 1px,transparent 1px),
    linear-gradient(90deg,rgba(105,252,203,.10) 1px,transparent 1px);
  background-size:100% 2.5vh,2vw 100%,100% 12.5vh,10vw 100%;
  animation:breathe 7s ease-in-out infinite}
@keyframes breathe{0%,100%{opacity:.6}50%{opacity:1}}
/* The centre axes, brighter and finely ticked, as on a real graticule. */
#grat::before,#grat::after{content:'';position:absolute;background-repeat:repeat}
#grat::before{left:0;right:0;top:50%;height:1px;background:rgba(105,252,203,.22);
  box-shadow:0 0 0 0 transparent;
  background-image:repeating-linear-gradient(90deg,rgba(105,252,203,.5) 0 1px,transparent 1px 2.5vw)}
#grat::after{top:0;bottom:0;left:50%;width:1px;background:rgba(105,252,203,.22);
  background-image:repeating-linear-gradient(rgba(105,252,203,.5) 0 1px,transparent 1px 3.125vh)}

/* CRT glass: scanlines, bloom-friendly vignette, and a faint mains flicker. */
#crt{position:fixed;inset:0;pointer-events:none;z-index:9;
  background:
    repeating-linear-gradient(rgba(0,0,0,.22) 0 1px,transparent 1px 3px),
    radial-gradient(ellipse at 50% 48%,transparent 42%,rgba(0,0,0,.72) 100%);
  animation:flicker 5.5s steps(60) infinite}
@keyframes flicker{0%,100%{opacity:1}47%{opacity:.97}49%{opacity:1}}

/* Corner readouts: a persistent value (risk, score, count) parked in a corner so it
   reads as instrument telemetry rather than as content competing with the headline. */
.corner{position:fixed;z-index:8;font-family:var(--mono);font-weight:400;
  font-size:clamp(13px,1.6vw,24px);letter-spacing:.16em;text-transform:uppercase;
  padding:.45em .8em;border:1px solid currentColor;border-radius:4px;opacity:.9;
  animation:arrive .34s cubic-bezier(.2,.9,.2,1) both}
.corner.tl{top:5vh;left:4vw}.corner.tr{top:5vh;right:4vw}

/* Instrument chrome: the readouts a scope prints in its corners. */
.chrome{position:fixed;z-index:8;font-family:var(--mono);font-weight:400;font-size:12px;
  letter-spacing:.18em;text-transform:uppercase;color:var(--mint);opacity:.16}
.chrome.tl{top:14px;left:18px}.chrome.tr{top:14px;right:18px}

/* Phosphor scanline sweep: fires on every state change, so the interface reads as
   redrawing itself rather than cutting. */
#sweep{position:fixed;left:0;right:0;top:0;height:34vh;z-index:6;pointer-events:none;opacity:0;
  background:linear-gradient(180deg,transparent,rgba(105,252,203,.05) 60%,rgba(105,252,203,.14));
  border-bottom:1px solid rgba(105,252,203,.4)}
#sweep.run{animation:sweep .5s cubic-bezier(.3,.8,.2,1)}
@keyframes sweep{0%{opacity:1;transform:translateY(-40vh)}100%{opacity:0;transform:translateY(105vh)}}

#stage{position:relative;z-index:3;width:100vw;height:100vh;overflow:hidden;
  display:flex;align-items:center;justify-content:center;padding:8vh 5vw}
.state{display:none;width:100%;max-height:100%;min-height:0;align-items:center;justify-content:center}
.state.on{display:flex}
/* The engine scales a state down if its content would overrun the screen, so a
   generated deck can never spill off the display. */
.state > *{transform-origin:center center}

.stack{display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:2.6vh;width:100%;max-height:100%;min-height:0}
.row{display:flex;align-items:center;justify-content:center;gap:3.5vw;width:100%;
  max-height:100%;min-height:0;flex:0 1 auto}
.stack.left,.row.left{align-items:flex-start;justify-content:flex-start;text-align:left}
.stack.right,.row.right{align-items:flex-end;justify-content:flex-end;text-align:right}

.word{font-size:min(clamp(48px,10.5vw,180px),13vh);line-height:.94;letter-spacing:-.02em;text-transform:uppercase}
.word.small{font-size:min(clamp(34px,6.5vw,110px),9vh)}
.word.big{font-size:min(clamp(62px,13.5vw,230px),17vh)}
.sub{font-size:clamp(17px,2.4vw,38px);letter-spacing:.01em;opacity:.7;font-weight:500}
.num{font-size:min(clamp(56px,14vw,240px),20vh);line-height:.9;color:var(--gold);letter-spacing:-.03em}
.hud{font-family:var(--mono);font-weight:400;font-size:clamp(11px,1.35vw,20px);
  letter-spacing:.2em;text-transform:uppercase;opacity:.62;
  padding:.5em .9em;border:1px solid rgba(244,236,228,.14);border-radius:4px}

.pillar{flex:0 1 auto;min-width:0;min-height:0;height:min(62vh,46vw);max-width:29%;
  aspect-ratio:.54;border-radius:16px;position:relative;overflow:hidden;
  background:linear-gradient(180deg,var(--surface),var(--inset));box-shadow:var(--raised);
  display:flex;align-items:flex-end;justify-content:center;padding:3% 2% 6%;
  animation:idle 5s ease-in-out infinite}
@keyframes idle{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
/* The label always reads in cream: the pillar's TINT carries the semantic colour, so
   a coral label on a coral-washed pillar would be near-invisible on camera. */
.pillar span{color:var(--cream);font-size:clamp(12px,1.75vw,27px);letter-spacing:.07em;
  text-transform:uppercase;text-align:center;line-height:1.15;
  text-shadow:0 2px 10px rgba(0,0,0,.7)}
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

/* The figure field: cymatics and Lissajous curves, drawn between beats. This is where
   the drama lives, so the states themselves can stay calm. */
#fx{position:fixed;inset:0;z-index:5;pointer-events:none;opacity:0}

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
      sweep=document.getElementById('sweep'), stage=document.getElementById('stage'),
      fx=document.getElementById('fx'), ctx=fx.getContext('2d');
  var i=0, step=0, busy=false;
  var EXIT={'swipe-left':'out-left','swipe-right':'out-right','swipe-up':'out-up',
            'swipe-down':'out-down','tap':'out-in','double-tap':'out-in','pinch':'out-in'};
  var LABEL={'tap':'TAP','double-tap':'DOUBLE TAP','swipe-left':'SWIPE LEFT',
             'swipe-right':'SWIPE RIGHT','swipe-up':'SWIPE UP','swipe-down':'SWIPE DOWN','pinch':'PINCH'};
  // Each gesture gets its own figure, so the audience learns to read the motion.
  var FIGURE={'swipe-left':'lissajous','swipe-right':'lissajous','swipe-up':'chladni',
              'swipe-down':'chladni','pinch':'rings','double-tap':'lock','tap':'cut'};

  function size(){ var d=devicePixelRatio||1; fx.width=innerWidth*d; fx.height=innerHeight*d;
    fx.style.width=innerWidth+'px'; fx.style.height=innerHeight+'px'; ctx.setTransform(d,0,0,d,0,0); }
  addEventListener('resize',function(){ size(); fit(); }); size();

  /* Lissajous: x=sin(at+d), y=sin(bt). The curve draws itself on, then off. */
  function lissajous(p,W,H,prev){
    // X-Y mode: the beam sweeps the figure and persistence leaves the tail behind it.
    var cx=W/2, cy=H/2, R=Math.min(W,H)*0.38;
    var a=3, b=2, d=p*Math.PI*0.9, TURNS=3;
    function pt(t){ return [cx+R*1.4*Math.sin(a*t+d), cy+R*Math.sin(b*t)]; }
    var t0=prev*Math.PI*2*TURNS, t1=p*Math.PI*2*TURNS, seg=Math.max(2,Math.ceil((t1-t0)/0.02));
    function sweep(width,alpha){
      ctx.strokeStyle='rgba(105,252,203,'+alpha+')'; ctx.lineWidth=width;
      ctx.lineCap='round'; ctx.beginPath();
      for(var k=0;k<=seg;k++){ var q=pt(t0+(t1-t0)*k/seg); k?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]); }
      ctx.stroke();
    }
    sweep(9,0.05); sweep(4,0.14); sweep(1.6,0.95);   // bloom, halo, hot core
    // The beam spot. Kept small and soft: a big hot head beads along the persistence
    // trail instead of reading as one moving point of light.
    var head=pt(t1);
    var g=ctx.createRadialGradient(head[0],head[1],0,head[0],head[1],9);
    g.addColorStop(0,'rgba(226,255,246,.7)'); g.addColorStop(1,'rgba(105,252,203,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(head[0],head[1],9,0,Math.PI*2); ctx.fill();
  }
  /* Chladni: nodal lines of a vibrating plate. The pattern reorganises as (n,m) shift,
     which is the "structure becoming visible" motif. */
  function chladni(p,W,H){
    // Blend two INTEGER resonances rather than sliding the frequency: integer (n,m)
    // give the symmetric nodal figures cymatics is recognised by, and cross-fading
    // between two of them reads as the plate re-resonating into a new mode.
    var fade=Math.sin(p*Math.PI), w=p;
    var n1=3,m1=5, n2=6,m2=8;
    var step=Math.max(5,Math.round(Math.min(W,H)/150));
    ctx.fillStyle='rgba(105,252,203,'+(0.95*fade)+')';
    function f(n,m,u,v){
      return Math.cos(n*Math.PI*u)*Math.cos(m*Math.PI*v)-Math.cos(m*Math.PI*u)*Math.cos(n*Math.PI*v);
    }
    for(var x=0;x<W;x+=step){ for(var y=0;y<H;y+=step){
      var u=x/W, v=y/H;
      var val=(1-w)*f(n1,m1,u,v)+w*f(n2,m2,u,v);
      if(Math.abs(val)<0.045){ var s=1.4+1.4*fade; ctx.fillRect(x-s/2,y-s/2,s,s); }
    }}
  }
  /* Concentric rings for pinch: the frame pulling in or pushing out. */
  function rings(p,W,H){
    var cx=W/2, cy=H/2, fade=Math.sin(p*Math.PI);
    ctx.strokeStyle='rgba(105,252,203,'+(0.7*fade)+')'; ctx.lineWidth=1.5;
    for(var k=0;k<6;k++){ var r=(((p+k/6)%1))*Math.max(W,H)*0.6;
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke(); }
  }
  /* Lock: a square reticle snapping shut on the centre. */
  function lock(p,W,H){
    var cx=W/2, cy=H/2, fade=Math.sin(p*Math.PI), s=Math.min(W,H)*(0.5-0.28*p);
    ctx.strokeStyle='rgba(105,252,203,'+(0.9*fade)+')'; ctx.lineWidth=2;
    var c=s*0.22;
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(q){
      var x=cx+q[0]*s, y=cy+q[1]*s;
      ctx.beginPath(); ctx.moveTo(x-q[0]*c,y); ctx.lineTo(x,y); ctx.lineTo(x,y-q[1]*c); ctx.stroke();
    });
  }
  var FIGS={lissajous:lissajous,chladni:chladni,rings:rings,lock:lock};

  function play(kind,swapAt,done){
    var fn=FIGS[kind], dur=fn?780:180, t0=performance.now(), swapped=false, prev=0;
    fx.style.opacity=1;
    ctx.clearRect(0,0,innerWidth,innerHeight);
    (function frame(now){
      var p=Math.min(1,(now-t0)/dur), W=innerWidth, H=innerHeight;
      // PHOSPHOR PERSISTENCE: fade the previous frame instead of clearing it, so the
      // beam leaves a decaying trail. This is what makes it read as a CRT.
      ctx.globalCompositeOperation='destination-out';
      ctx.fillStyle='rgba(0,0,0,0.14)'; ctx.fillRect(0,0,W,H);
      ctx.globalCompositeOperation='lighter';
      if(fn) fn(p,W,H,prev);
      ctx.globalCompositeOperation='source-over';
      prev=p;
      if(!swapped && p>=0.42){ swapped=true; swapAt(); }
      if(p<1) requestAnimationFrame(frame);
      else {
        // Let the phosphor decay out rather than snapping off.
        (function decay(){
          ctx.globalCompositeOperation='destination-out';
          ctx.fillStyle='rgba(0,0,0,0.16)'; ctx.fillRect(0,0,W,H);
          ctx.globalCompositeOperation='source-over';
          fx.style.opacity=String(Math.max(0,+fx.style.opacity-0.06));
          if(+fx.style.opacity>0.02) requestAnimationFrame(decay);
          else { ctx.clearRect(0,0,W,H); fx.style.opacity=0; }
        })();
        busy=false; done&&done();
      }
    })(t0);
  }

  function steps(n){ return [].slice.call(states[n].querySelectorAll('[data-step]')); }
  function maxStep(n){ return steps(n).reduce(function(m,e){ return Math.max(m,+e.dataset.step||0); },0); }
  function paint(){
    var m=maxStep(i), ex=meta[i].exit||'tap';
    cue.textContent=(step<m?'TAP TO REVEAL':LABEL[ex]+' TO ADVANCE')+'   '+(i+1)+'/'+states.length;
  }
  function render(){
    steps(i).forEach(function(e){ e.classList.toggle('shown',(+e.dataset.step||0)<=step); });
    paint();
    requestAnimationFrame(fit);
  }
  // Belt and braces on top of the CSS constraints: measure the laid-out state and
  // scale it down if it would still overrun. Deck content is generated, so its size
  // cannot be predicted, and anything spilling off the display ruins a take.
  function fit(){
    var st=states[i];
    // Measure the CONTENT container, never a .corner readout: those are fixed to the
    // screen edges, so scaling one is meaningless and measuring one hides a real
    // overflow behind a tiny box.
    var inner=st && (st.querySelector(':scope > .stack, :scope > .row')
      || [].slice.call(st.children).filter(function(c){ return !/\bcorner\b/.test(c.className); })[0]);
    if(!inner) return;
    inner.style.transform='none';
    /* Measure against the SCREEN, not the layout padding. The padding is a design
       preference the composition may encroach on; shrinking type is a last resort for
       content that would genuinely leave the display. Measuring the padded box instead
       scaled a hero state to 92% purely to protect a margin, which costs presence on
       camera for nothing. A small guard keeps content off the literal bezel. */
    var guardH=stage.clientHeight*0.02, guardW=stage.clientWidth*0.02;
    var availH=stage.clientHeight-guardH*2;
    var availW=stage.clientWidth-guardW*2;
    var h=inner.scrollHeight, w=inner.scrollWidth;
    if(!h||!w) return;
    var k=Math.min(1, availH/h, availW/w);
    if(k<0.999) inner.style.transform='scale('+k.toFixed(3)+')';
  }
  function enter(n){
    states[i].className='state'; i=n; step=0;
    var s=states[i]; s.classList.add('on');
    [].slice.call(s.children).forEach(function(c){ c.style.animation='none'; void c.offsetWidth; c.style.animation=''; });
    sweep.classList.remove('run'); void sweep.offsetWidth; sweep.classList.add('run');
    render();
  }
  function go(n,g){
    if(n<0||n>=states.length||busy) return;
    busy=true;
    var cls=EXIT[g]||'out-in', cur=states[i];
    cur.classList.add(cls);
    play(FIGURE[g]||'cut', function(){ cur.classList.remove(cls); enter(n); });
  }
  function act(g,x,y){
    if(busy) return;
    if(x!=null){ ret.style.left=x+'px'; ret.style.top=y+'px';
      ret.classList.remove('hit'); void ret.offsetWidth; ret.classList.add('hit'); }
    var m=maxStep(i), ex=meta[i].exit||'tap';
    if(g==='tap' && step<m){ step++; render(); return; }
    if(g==='swipe-right'){ go(i-1,'swipe-right'); return; }
    if(g==='swipe-down' && step>0){ step--; render(); return; }
    go(i+1,g);
  }

  // Gestures: tap, double tap, pinch, and the four swipes.
  var sx=0,sy=0,st=0,lastTap=0,pending=null,pinch0=0;
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
    pending=setTimeout(function(){ pending=null; act('tap',x,y); },250);
  }
  function dist(t){ var a=t[0],b=t[1];
    return Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY); }
  addEventListener('touchstart',function(e){
    if(e.touches.length===2){ pinch0=dist(e.touches); clearTimeout(pending); pending=null; return; }
    var t=e.touches[0]; down(t.clientX,t.clientY);
  },{passive:true});
  addEventListener('touchend',function(e){
    if(pinch0 && e.touches.length<2){ pinch0=0; act('pinch',innerWidth/2,innerHeight/2); return; }
    var t=e.changedTouches[0]; up(t.clientX,t.clientY);
  },{passive:true});
  addEventListener('mousedown',function(e){ down(e.clientX,e.clientY); });
  addEventListener('mouseup',function(e){ up(e.clientX,e.clientY); });
  addEventListener('keydown',function(e){
    var k=e.key;
    if(k==='ArrowRight'||k===' '||k==='Enter') act('tap');
    else if(k==='ArrowLeft') act('swipe-right');
    else if(k==='ArrowUp') act('swipe-up');
    else if(k==='ArrowDown') act('swipe-down');
    else if(k==='p') act('pinch');
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
<div id="grat"></div>
<div id="sweep"></div>
<canvas id="fx"></canvas>
<div id="stage">
${states}
</div>
<div id="reticle"></div>
<div class="chrome tl">X-Y  1.00 V/DIV</div>
<div class="chrome tr">TIME  5 MS/DIV</div>
<div id="cue"></div>
<div id="crt"></div>
<script type="application/json" id="meta">${meta}</script>
<script>${ENGINE_JS}</script>
</body></html>`;
}
