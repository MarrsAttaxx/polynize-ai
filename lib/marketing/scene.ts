/**
 * THE SCENE ENGINE (D31). The touchscreen surface the presenter operates on camera.
 *
 * This REPLACES the deck engine's slide model, on Marrs's call after performing the
 * first real one: "it's supposed to be interactive HTML, it's about navigating around
 * it, not going through a series of slides. It doesn't present right."
 *
 * He is right, and the reason is object identity. A slide deck DESTROYS and RECREATES:
 * state 2 is a different picture that happens to also contain a pillar. An interface
 * TRANSFORMS: the same pillar moves, grows and opens. An audience reads the difference
 * instantly, because only one of them looks like a thing being operated. No amount of
 * transition polish buys it, since what is missing is the continuity of the object.
 *
 * So a scene is not a list of states with an index. It is:
 *   - ONE set of objects that exist for the whole piece and are never rebuilt, and
 *   - a VIEW STATE saying which one is open and what has been revealed on it.
 *
 * Every visual change is that same DOM element moving, animated with FLIP (measure
 * First, change class to Last, Invert with a transform, Play back to identity). The
 * presenter can open any node, reveal its facts in any order, close it and open
 * another. There is no next and no previous, which is the point.
 *
 * What stays from the deck engine is the house style: the oscilloscope graticule, the
 * phosphor sweep, the CRT glass, and the operator cue strip that is legible standing
 * over the screen and invisible on camera.
 *
 * The engine owns ALL of the behaviour and layout. April supplies only DATA (the nodes,
 * their colours, their facts), which is what makes a generated scene predictable: there
 * is no generated HTML that can lay itself out wrongly or run off the display.
 */

export type SceneColour = 'coral' | 'amber' | 'mint' | 'gold';

/** One tappable detail on an open node. The value stays hidden until it is touched. */
export type SceneFact = {
  /** What it is, e.g. "RISK PROFILE". Always visible on the open node. */
  label: string;
  /** What it says, e.g. "HIGH". Revealed on touch. */
  value: string;
};

export type SceneNode = {
  /** The name on the object, e.g. "AI ADDICTS". */
  label: string;
  colour: SceneColour;
  /**
   * Up to four facts, revealed one touch at a time.
   *
   * There is deliberately NO prose on an open node. The sentence that used to sit here
   * is what the presenter SAYS, so putting it on screen made the audience read what
   * they were being told, and it was the only variable-length thing on the panel, which
   * is what crowded the facts (Marrs: "we don't need it, that's what's on the script").
   * With it gone the panel holds only fixed-size elements, so it fits by construction
   * and the facts can be much bigger.
   */
  facts: SceneFact[];
};

export type Scene = {
  title: string;
  /** The headline over the whole board, e.g. "THREE DIVERGENT CLASSES". */
  concept: string;
  /** Two to four objects. More than four stops reading at a glance. */
  nodes: SceneNode[];
  /** The line worth remembering, raised over the board with a swipe up. */
  close?: string;
};

/**
 * What April is told she is filling in. Deliberately DATA ONLY: no classes, no layout,
 * no markup. The engine decides how all of it looks and behaves.
 */
export const SCENE_VOCABULARY = `A SCENE is not a slide deck and has no slides, no pages and no order. It is one interactive board the presenter touches on camera, and it holds:

- CONCEPT: the headline over the whole board. A few words, uppercase, the idea itself.
- NODES: two to four objects sitting on the board, side by side. Each node has
  - a LABEL, the name on the object (two or three words, uppercase)
  - a COLOUR ROLE: "coral" the problem, "amber" the tension, "gold" the proof, "mint" the resolution
  - FACTS: up to four, each a LABEL (what it is, e.g. "RISK PROFILE") and a VALUE (what
    it says, e.g. "HIGH"). The presenter touches a fact to reveal its value on camera.
    A label is at most three words and a value at most two: they are read at a glance
    from across a room, not sentences.

NEVER put a sentence on a node. Whatever explains it is what the presenter SAYS, and it
lives in the script. The screen carries only the name and the numbers.
- CLOSE: the single line worth remembering, raised over the board at the end.

The presenter opens any node by touching it, reveals its facts in any order, closes it
and opens another. Write the content so it works in ANY order: no node may depend on
another having been opened first, and no fact may read as "and then". There is no
first and no last, apart from the concept the board opens on and the close.`;

const ENGINE_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --ink:#0a0a0f;--surface:#1c1c27;--inset:#0f0f17;
  --cream:#f4ece4;--mint:#69fccb;--coral:#ff7a6b;--amber:#f0b86b;--gold:#f0e1b6;
  --edge-light:rgba(255,255,255,.07);--edge-dark:rgba(0,0,0,.55);
  --mono:ui-monospace,'SF Mono',Menlo,monospace;
  --ease:cubic-bezier(.22,.9,.24,1);

  /* THE TYPE SCALE. Marrs set the floor by eye against the real cut: the fact VALUES
     ("HIGH", "DECLINING") are the smallest anything may ever be on this screen, because
     in a 9:16 split-screen the board occupies half a phone screen. Nothing below
     --t-floor, ever. Everything else is a deliberate multiple of it, so the hierarchy
     survives at any viewport instead of collapsing into one middling size. */
  --t-floor:   min(clamp(15px,2.5vw,42px),4.6vh);
  --t-fact:    min(clamp(17px,2.9vw,48px),5.4vh);   /* the waiting label, above the floor */
  --t-value:   min(clamp(25px,4.3vw,74px),8vh);     /* the payoff, the biggest thing here */
  --t-name:    min(clamp(19px,3.1vw,52px),5.8vh);   /* an object's name on the board */
  --t-title:   min(clamp(24px,4vw,68px),7.4vh);     /* the open panel's title */
  --t-concept: min(clamp(40px,8.2vw,150px),13.5vh); /* the board headline, exaggerated */
}
html,body{height:100%;overflow:hidden;background:var(--ink);cursor:none;touch-action:none}
body{font-family:'Space Grotesk',system-ui,sans-serif;font-weight:700;color:var(--cream);
  -webkit-font-smoothing:antialiased;user-select:none;-webkit-user-select:none;
  -webkit-tap-highlight-color:transparent;overscroll-behavior:none}

/* OSCILLOSCOPE GRATICULE: the etched screen of a bench instrument. */
#grat{position:fixed;inset:0;pointer-events:none;z-index:0;
  background-image:
    linear-gradient(rgba(105,252,203,.045) 1px,transparent 1px),
    linear-gradient(90deg,rgba(105,252,203,.045) 1px,transparent 1px),
    linear-gradient(rgba(105,252,203,.10) 1px,transparent 1px),
    linear-gradient(90deg,rgba(105,252,203,.10) 1px,transparent 1px);
  background-size:100% 2.5vh,2vw 100%,100% 12.5vh,10vw 100%;
  animation:breathe 7s ease-in-out infinite}
@keyframes breathe{0%,100%{opacity:.6}50%{opacity:1}}
#grat::before,#grat::after{content:'';position:absolute}
#grat::before{left:0;right:0;top:50%;height:1px;background:rgba(105,252,203,.22);
  background-image:repeating-linear-gradient(90deg,rgba(105,252,203,.5) 0 1px,transparent 1px 2.5vw)}
#grat::after{top:0;bottom:0;left:50%;width:1px;background:rgba(105,252,203,.22);
  background-image:repeating-linear-gradient(rgba(105,252,203,.5) 0 1px,transparent 1px 3.125vh)}

/* CRT glass. */
#crt{position:fixed;inset:0;pointer-events:none;z-index:9;
  background:
    repeating-linear-gradient(rgba(0,0,0,.22) 0 1px,transparent 1px 3px),
    radial-gradient(ellipse at 50% 48%,transparent 42%,rgba(0,0,0,.72) 100%);
  animation:flicker 5.5s steps(60) infinite}
@keyframes flicker{0%,100%{opacity:1}47%{opacity:.97}49%{opacity:1}}

.chrome{position:fixed;z-index:8;font-family:var(--mono);font-weight:400;font-size:12px;
  letter-spacing:.18em;text-transform:uppercase;color:var(--mint);opacity:.16}
.chrome.tl{top:14px;left:18px}.chrome.tr{top:14px;right:18px}

/* Phosphor sweep: fires when the board reorganises, so it reads as redrawing itself. */
#sweep{position:fixed;left:0;right:0;top:0;height:34vh;z-index:6;pointer-events:none;opacity:0;
  background:linear-gradient(180deg,transparent,rgba(105,252,203,.05) 60%,rgba(105,252,203,.14));
  border-bottom:1px solid rgba(105,252,203,.4)}
#sweep.run{animation:sweep .5s cubic-bezier(.3,.8,.2,1)}
@keyframes sweep{0%{opacity:1;transform:translateY(-40vh)}100%{opacity:0;transform:translateY(105vh)}}

#scene{position:fixed;inset:0;z-index:3;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:3vh;padding:7vh 4vw}

/* THE CONCEPT: the board's headline. It recedes rather than disappearing when a node
   opens, because the board is still there behind the thing you opened. */
#concept{font-size:var(--t-concept);line-height:.94;letter-spacing:-.02em;
  text-transform:uppercase;text-align:center;flex:0 0 auto;
  transition:font-size .5s var(--ease),opacity .5s var(--ease)}
/* Receded, but never below the floor: it is still on camera. */
#scene.open #concept{font-size:var(--t-floor);opacity:.5}

/* THE OBJECTS. One row, always the same elements, never rebuilt. */
#nodes{flex:1 1 auto;min-height:0;width:100%;display:flex;align-items:center;
  justify-content:center;gap:2.2vw}
.node{position:relative;flex:0 0 auto;border-radius:16px;overflow:hidden;cursor:none;
  height:min(58vh,44vw);aspect-ratio:.56;
  display:flex;flex-direction:column;align-items:center;justify-content:flex-end;
  padding:4% 5% 6%;
  box-shadow:0 1px 0 var(--edge-light) inset,0 -1px 0 var(--edge-dark) inset,
             0 10px 30px rgba(0,0,0,.5);
  /* The FLIP transform is written here by the engine; the transition is what makes the
     same object appear to MOVE rather than a new one appear somewhere else. */
  transition:transform .52s var(--ease),height .52s var(--ease),
             width .52s var(--ease),opacity .3s linear,filter .3s linear}
.node::after{content:'';position:absolute;inset:0;pointer-events:none;
  background-image:radial-gradient(currentColor .5px,transparent .5px);
  background-size:6px 6px;opacity:.14;mix-blend-mode:overlay}
.node.coral{color:var(--coral);background:linear-gradient(180deg,rgba(255,122,107,.22),rgba(255,122,107,.04));border:1px solid rgba(255,122,107,.34)}
.node.amber{color:var(--amber);background:linear-gradient(180deg,rgba(240,184,107,.22),rgba(240,184,107,.04));border:1px solid rgba(240,184,107,.34)}
.node.mint {color:var(--mint); background:linear-gradient(180deg,rgba(105,252,203,.22),rgba(105,252,203,.04));border:1px solid rgba(105,252,203,.34)}
.node.gold {color:var(--gold); background:linear-gradient(180deg,rgba(240,225,182,.22),rgba(240,225,182,.04));border:1px solid rgba(240,225,182,.34)}

/* The name on the object, always cream so it reads against its own tint. */
.name{color:var(--cream);font-size:var(--t-name);letter-spacing:.07em;
  text-transform:uppercase;text-align:center;line-height:1.15;
  text-shadow:0 2px 10px rgba(0,0,0,.7);transition:font-size .5s var(--ease)}

/* OPEN: this object grows into a panel. The others stay on the board, shrunk and
   quiet, still touchable, so switching between them is one move and the set is never
   lost. A receded object drops its name and becomes a shape. */
#scene.open .node{height:min(26vh,19vw);opacity:.3;filter:saturate(.4)}
#scene.open .node .name{font-size:min(clamp(9px,1vw,14px),1.6vh);opacity:0}
#scene.open .node.on{height:min(80vh,58vw);aspect-ratio:1.32;opacity:1;filter:none;
  justify-content:flex-start;padding:3% 3.5%}
/* Shut, the name is the only thing on the object and sits at its foot. Open, it is the
   panel's title, so it moves to the top: same element, reordered, never a second copy. */
#scene.open .node.on .name{font-size:var(--t-title);opacity:1;
  align-self:flex-start;text-align:left;order:-1;color:currentColor;
  letter-spacing:.1em;text-shadow:none}

/* HUD brackets, inset because the object clips its own fill. */
.node.on::before{content:'';position:absolute;top:10px;left:10px;width:26px;height:26px;
  border:2px solid currentColor;border-right:none;border-bottom:none;opacity:.85;
  animation:lock .3s var(--ease) both}
@keyframes lock{from{opacity:0;transform:scale(1.7)}to{opacity:.85;transform:scale(1)}}

/* The open object's contents. Hidden entirely when shut: an object that is not open
   has no readable detail, which is what keeps the board quiet. */
.body{display:none;flex:1 1 auto;min-height:0;width:100%;
  flex-direction:column;justify-content:center;gap:2.2vh;padding:1vh 1% 0}
#scene.open .node.on .body{display:flex}
/* FACTS. A label sits there waiting; the value arrives on touch as a hard wipe, never
   a fade, per the standing no-fades rule. */
.facts{display:flex;flex-direction:column;gap:1.6vh;width:100%}
.fact{display:flex;align-items:baseline;justify-content:space-between;gap:2vw;
  border-top:1px solid rgba(244,236,228,.14);padding-top:1.5vh}
/* The label and the value are both fully legible; the hierarchy between them comes
   from weight, colour and size, not from shrinking the label to nothing. */
.fact .k{font-family:var(--mono);font-weight:400;color:var(--cream);opacity:.72;
  font-size:var(--t-fact);letter-spacing:.1em;text-transform:uppercase}
.fact .v{color:currentColor;font-size:var(--t-value);
  text-transform:uppercase;letter-spacing:-.01em;text-align:right;
  clip-path:inset(0 100% 0 0)}
.fact.shown .v{clip-path:inset(0 0 0 0);transition:clip-path .26s steps(9)}
/* Waiting to be touched: a fine underscore where the value will land. */
.fact:not(.shown) .v::after{content:'';position:absolute;margin-left:-2.2em;width:2em;
  border-bottom:2px solid currentColor;opacity:.32;transform:translateY(-.28em)}

/* THE CLOSE: raised over the board rather than replacing it. */
#close{position:fixed;inset:0;z-index:7;display:none;align-items:center;justify-content:center;
  padding:8vh 6vw;background:rgba(10,10,15,.86)}
#close.on{display:flex}
#close p{color:var(--mint);font-size:min(clamp(30px,7vw,140px),16vh);line-height:.96;
  letter-spacing:-.02em;text-transform:uppercase;text-align:center;
  animation:arrive .34s var(--ease) both}
@keyframes arrive{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}

/* THE CLINCHER. A swipe is invisible, so the last move of the piece had no affordance
   on screen and nothing for the presenter's hand to go to on camera. This is a real
   glowing control parked bottom right: it sits there through the whole piece, and
   pressing it lands the closing line. Unlabelled on purpose, so it cannot spoil the
   line it is about to deliver. */
#clinch{position:fixed;right:3.4vw;bottom:4.5vh;z-index:8;
  width:min(11vh,9vw);height:min(11vh,9vw);border-radius:50%;
  border:2px solid var(--mint);color:var(--mint);background:rgba(105,252,203,.09);
  display:none;align-items:center;justify-content:center;cursor:none;
  animation:pulse 2.4s ease-in-out infinite}
/* Only on the board: while an object is open, the hand belongs on the object. */
#clinch.on{display:flex}
#clinch::after{content:'';width:26%;height:26%;border-top:3px solid currentColor;
  border-right:3px solid currentColor;transform:rotate(-45deg) translate(-8%,8%)}
@keyframes pulse{
  0%,100%{box-shadow:0 0 0 0 rgba(105,252,203,.42),0 0 26px rgba(105,252,203,.28)}
  50%{box-shadow:0 0 0 14px rgba(105,252,203,0),0 0 40px rgba(105,252,203,.5)}}

/* Targeting reticle: the interface answering the hand. */
#ret{position:fixed;width:54px;height:54px;margin:-27px 0 0 -27px;z-index:8;
  pointer-events:none;opacity:0;border:1px solid var(--mint);border-radius:50%}
#ret.hit{animation:ping .45s var(--ease)}
@keyframes ping{0%{opacity:.9;transform:scale(.35)}100%{opacity:0;transform:scale(1.5)}}

/* OPERATOR STRIP: legible standing over the screen, invisible on camera. */
#cue{position:fixed;left:0;right:0;bottom:1.4vh;z-index:8;text-align:center;
  font-family:var(--mono);font-weight:400;font-size:14px;letter-spacing:.22em;
  text-transform:uppercase;color:var(--cream);opacity:.07;pointer-events:none}

/* Resolves --t-floor to pixels so the fit routine knows where it must stop. */
#floor{position:fixed;visibility:hidden;pointer-events:none;font-size:var(--t-floor)}

/* Boot: the instrument comes up rather than just existing. */
#scene.boot{animation:boot .5s var(--ease) both}
@keyframes boot{from{opacity:0;transform:scale(.985)}to{opacity:1;transform:none}}
`;

const ENGINE_JS = `
(function(){
  var scene=document.getElementById('scene'),
      nodes=[].slice.call(document.querySelectorAll('.node')),
      closeEl=document.getElementById('close'),
      cue=document.getElementById('cue'),
      ret=document.getElementById('ret'),
      sweep=document.getElementById('sweep'),
      clinch=document.getElementById('clinch');
  var open=-1;
  var hasClose=closeEl.dataset.has==='1';

  /* The clincher waits on the board and gets out of the way while an object is open. */
  function showClinch(){
    clinch.classList.toggle('on', hasClose && open<0 && !closeEl.classList.contains('on'));
  }

  /* FLIP. This is the whole trick, and the reason a scene reads as an interface: the
     objects are never rebuilt, so when the layout changes we measure where each one
     WAS, let it go to where it now IS, then invert the difference and release it. The
     eye follows one continuous object instead of seeing a cut to a new picture. */
  function flip(change){
    var first=nodes.map(function(n){ return n.getBoundingClientRect(); });
    change();
    nodes.forEach(function(n,i){
      var a=first[i], b=n.getBoundingClientRect();
      if(!a.width||!b.width) return;
      var dx=a.left-b.left, dy=a.top-b.top, sx=a.width/b.width, sy=a.height/b.height;
      if(Math.abs(dx)<1&&Math.abs(dy)<1&&Math.abs(sx-1)<.01&&Math.abs(sy-1)<.01) return;
      n.style.transition='none';
      n.style.transform='translate('+dx+'px,'+dy+'px) scale('+sx+','+sy+')';
      void n.offsetWidth;
      n.style.transition='';
      n.style.transform='';
    });
    sweep.classList.remove('run'); void sweep.offsetWidth; sweep.classList.add('run');
  }

  function setCue(){
    showClinch();
    if(closeEl.classList.contains('on')) cue.textContent='TOUCH ANYWHERE TO GO BACK';
    else if(open<0) cue.textContent='TOUCH ONE'+(hasClose?'   \\u00b7   GREEN BUTTON TO LAND IT':'');
    else {
      var left=nodes[open].querySelectorAll('.fact:not(.shown)').length;
      cue.textContent = left ? 'TOUCH TO REVEAL   '+left+' LEFT' : 'TOUCH ANOTHER, OR SWIPE DOWN';
    }
  }

  /* With the prose gone the panel is all fixed-size elements and fits by construction,
     so this is a backstop rather than a layout mechanism: it only earns its keep when a
     node carries four facts whose labels are long enough to wrap. It spends the LABELS'
     headroom (they sit above the floor) and stops at the floor, which Marrs set as the
     smallest anything may ever be. Values and titles are never touched. If it hits the
     floor and still does not fit, the copy is too long, not the layout. */
  var floorEl=document.getElementById('floor');
  function fitPanel(n){
    var facts=n.querySelectorAll('.fact');
    if(!facts.length) return;
    var keys=n.querySelectorAll('.fact .k');
    [].forEach.call(keys,function(k){ k.style.fontSize=''; });
    var last=facts[facts.length-1];
    var limit=n.getBoundingClientRect().bottom-parseFloat(getComputedStyle(n).paddingBottom);
    var floorPx=parseFloat(getComputedStyle(floorEl).fontSize)||14;
    var size=parseFloat(getComputedStyle(keys[0]).fontSize);
    var guard=0;
    while(last.getBoundingClientRect().bottom>limit && size>floorPx+0.5 && guard++<24){
      size=Math.max(floorPx, size*0.94);
      [].forEach.call(keys,function(k){ k.style.fontSize=size+'px'; });
    }
  }
  /* Measured after the panel has finished growing, or the limit would be the box it is
     animating FROM. The timeout covers the instant path, where nothing transitions. */
  function fitSoon(n){
    setTimeout(function(){ fitPanel(n); },0);
    n.addEventListener('transitionend',function h(e){
      if(e.propertyName!=='height') return;
      n.removeEventListener('transitionend',h); fitPanel(n);
    });
  }

  function openNode(i){
    if(i===open) return;
    flip(function(){
      nodes.forEach(function(n,k){ n.classList.toggle('on', k===i); });
      scene.classList.add('open');
    });
    open=i;
    fitSoon(nodes[i]);
    setCue();
  }
  function shut(){
    if(open<0) return;
    flip(function(){
      nodes.forEach(function(n){ n.classList.remove('on'); });
      scene.classList.remove('open');
    });
    open=-1;
    setCue();
  }

  /* A touch on the board. Everything is a real hit target, so the presenter is
     operating objects rather than firing a global next. */
  function touch(x,y,target){
    ret.style.left=x+'px'; ret.style.top=y+'px';
    ret.classList.remove('hit'); void ret.offsetWidth; ret.classList.add('hit');

    if(closeEl.classList.contains('on')){ closeEl.classList.remove('on'); setCue(); return; }

    if(target.closest && target.closest('#clinch')){ closeEl.classList.add('on'); setCue(); return; }

    var fact=target.closest ? target.closest('.fact') : null;
    if(fact && fact.closest('.node.on')){ fact.classList.add('shown'); setCue(); return; }

    var node=target.closest ? target.closest('.node') : null;
    if(node){
      var i=nodes.indexOf(node);
      if(i===open) shut(); else openNode(i);
      return;
    }
    shut();
  }

  /* Swipes are for the two board-level moves only: raise the close line, or step back
     out. Everything else is a direct touch on the thing itself. */
  var sx=0,sy=0,st=0;
  function down(x,y){ sx=x; sy=y; st=Date.now(); }
  function up(x,y,target){
    var dx=x-sx, dy=y-sy, dt=Date.now()-st;
    if(Math.max(Math.abs(dx),Math.abs(dy))>60 && dt<800){
      if(dy<0 && Math.abs(dy)>Math.abs(dx)){
        if(open<0 && hasClose){ closeEl.classList.add('on'); setCue(); }
        return;
      }
      if(dy>0 && Math.abs(dy)>Math.abs(dx)){
        if(closeEl.classList.contains('on')) closeEl.classList.remove('on'); else shut();
        setCue(); return;
      }
      return;
    }
    touch(x,y,target);
  }
  addEventListener('touchstart',function(e){ var t=e.touches[0]; down(t.clientX,t.clientY); },{passive:true});
  addEventListener('touchend',function(e){ var t=e.changedTouches[0];
    up(t.clientX,t.clientY,document.elementFromPoint(t.clientX,t.clientY)||document.body); },{passive:true});
  addEventListener('mousedown',function(e){ down(e.clientX,e.clientY); });
  addEventListener('mouseup',function(e){ up(e.clientX,e.clientY,e.target); });

  /* Keyboard, for reviewing the scene in the console without a touchscreen. */
  addEventListener('keydown',function(e){
    var k=e.key;
    if(k>='1'&&k<='9'){ var i=+k-1; if(nodes[i]) openNode(i); return; }
    if(k==='Escape'||k==='ArrowDown'){ if(closeEl.classList.contains('on')) closeEl.classList.remove('on'); else shut(); setCue(); return; }
    if(k==='ArrowUp'){ if(open<0&&hasClose){ closeEl.classList.add('on'); setCue(); } return; }
    if(k===' '||k==='Enter'){
      if(open<0) return;
      var next=nodes[open].querySelector('.fact:not(.shown)');
      if(next){ next.classList.add('shown'); setCue(); }
      return;
    }
  });

  /* ?node=N opens one object on load, so the console can preview a single view. */
  /* ?node=N opens one object on load, so the console can preview a single view. It
     opens INSTANTLY, with no FLIP: there is nothing for the object to move from on a
     cold load, and animating it would mean the preview is wrong for half a second. */
  var q=parseInt((location.search.match(/[?&]node=(\\d+)/)||[])[1],10);
  scene.classList.add('boot');
  if(!isNaN(q) && nodes[q]){
    nodes.forEach(function(n,k){ n.classList.toggle('on', k===q); });
    scene.classList.add('open');
    open=q;
    fitSoon(nodes[q]);
  }
  setCue();
  addEventListener('resize',function(){ if(open>=0) fitPanel(nodes[open]); });
})();
`;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const COLOURS: ReadonlySet<string> = new Set(['coral', 'amber', 'mint', 'gold']);

/** Render a scene to one self-contained interactive page. */
export function renderScene(scene: Scene): string {
  // Two to four objects: more than four stops reading at a glance on camera, and the
  // rail they shrink into stops being touchable at arm's length.
  const nodes = scene.nodes.slice(0, 4);
  const nodesHtml = nodes
    .map((n) => {
      const colour = COLOURS.has(n.colour) ? n.colour : 'mint';
      const facts = n.facts
        .slice(0, 4)
        .map(
          (f) =>
            `<div class="fact"><span class="k">${esc(f.label)}</span><span class="v">${esc(f.value)}</span></div>`
        )
        .join('');
      return `<div class="node ${colour}">
  <div class="body">
    ${facts ? `<div class="facts">${facts}</div>` : ''}
  </div>
  <div class="name">${esc(n.label)}</div>
</div>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<title>${esc(scene.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<style>${ENGINE_CSS}</style>
</head><body>
<div id="grat"></div>
<div id="sweep"></div>
<div class="chrome tl">X-Y 1.00 V/DIV</div>
<div class="chrome tr">TIME 5 MS/DIV</div>
<div id="scene">
  <div id="concept">${esc(scene.concept)}</div>
  <div id="nodes">
${nodesHtml}
  </div>
</div>
<div id="close" data-has="${scene.close ? '1' : '0'}"><p>${esc(scene.close ?? '')}</p></div>
<div id="clinch"></div>
<div id="floor">M</div>
<div id="ret"></div>
<div id="cue"></div>
<div id="crt"></div>
<script>${ENGINE_JS}</script>
</body></html>`;
}
