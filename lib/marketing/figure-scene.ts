/**
 * The FIGURE PREZIE renderer (D33): a sequence of authored figures, performed by tapping.
 *
 * This sits beside `renderScene` rather than inside it, because the interaction is genuinely
 * different. A node board is one set of objects you open and close, with no order. A figure
 * prezie is a walkthrough: each figure completes over a few taps, then you move to the next.
 * Marrs's own description is sequential ("once I tap the question mark, we go into the second
 * object"), and folding two interaction models into one script would make both harder to
 * reason about. Prezies built on the old model keep rendering through the old path.
 *
 * The engine owns the frame absolutely. It supplies the substrate, the cue strip, the touch
 * sound, the tap counting and the bounds; a figure supplies only what is inside its own box,
 * already sanitised and scoped by `figure.ts`. That division is what makes generated markup
 * safe here when it was not safe in the deck.
 */

import { SCENE_ENGINE_CSS } from './scene';
import { renderFigureFrame, type PrezieFigure } from './figure';

export type FigureScene = {
  title: string;
  figures: PrezieFigure[];
};

const esc = (s: string) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const FRAME_CSS = `
/* Each figure fills the screen; one is live at a time. The containment and the clip are
   the wall a generated figure cannot get over. */
.figure{position:fixed;inset:0;z-index:3;display:none;overflow:hidden;isolation:isolate;
  contain:layout paint}
.figure.on{display:block}
.figure > *{position:absolute;inset:0}
/* THE NEXT CONTROL. Bottom right, and DELIBERATELY ALMOST INVISIBLE.
   It began mint and pulsing, which defeated its own purpose: the audience could see it and it
   read as a next button on a presentation (Marrs). It belongs to the same family as the
   operator cue strip, which is legible to him standing over the screen and effectively gone on
   camera, so it is cream at a tenth opacity with no glow and no animation. Nothing that moves,
   because movement is what the eye finds.

   The HIT AREA is large and the MARK is small: he has to hit it reliably mid-take without
   looking, and neither of those requirements is about how visible it is. */
#next{position:fixed;right:0;bottom:0;z-index:8;
  width:min(16vh,13vw);height:min(16vh,13vw);
  display:grid;place-items:center;cursor:none;
  background:transparent;border:none;padding:0}
/* The mark: a small chevron, off in the corner, at the cue strip's opacity. */
#next::after{content:'';width:1.6vh;height:1.6vh;margin:0 2.2vh 2.2vh 0;
  border-top:2px solid var(--cream);border-right:2px solid var(--cream);
  transform:rotate(45deg);opacity:.1}
/* At the end there is nowhere to go, so the mark goes entirely. */
#next.done::after{opacity:0}

/* Arriving: the figure cuts in and settles, rather than fading. */
.figure.on{animation:figIn .3s cubic-bezier(.22,.9,.24,1) both}
@keyframes figIn{from{opacity:0;transform:scale(.99)}to{opacity:1;transform:none}}
`;

const ENGINE_JS = `
(function(){
  var figs=[].slice.call(document.querySelectorAll('.figure')),
      cue=document.getElementById('cue'),
      ret=document.getElementById('ret'),
      nextBtn=document.getElementById('next'),
      sweep=document.getElementById('sweep');
  if(!figs.length) return;
  var at=0, step=0;

  /* Marrs's own samples, alternated so repeated touches do not read as a loop. Web Audio
     because an <audio> element cannot overlap itself and a fast double tap would swallow its
     own second blip. Decoded on the first touch, which is itself the gesture that unlocks
     audio in a browser. */
  var actx=null, bufs=[null,null], turn=0;
  var SFX=['/pam/sfx/touch-01.wav','/pam/sfx/touch-02.wav'];
  function load(i){
    if(bufs[i]!==null) return; bufs[i]=undefined;
    fetch(SFX[i]).then(function(r){return r.arrayBuffer();})
      .then(function(b){return actx.decodeAudioData(b);})
      .then(function(b){bufs[i]=b;}).catch(function(){bufs[i]=null;});
  }
  function blip(){
    try{
      if(!actx){ var AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
        actx=new AC(); load(0); load(1); }
      if(actx.state==='suspended') actx.resume();
      var i=turn++%2, b=bufs[i]||bufs[(i+1)%2]; if(!b) return;
      var src=actx.createBufferSource(), g=actx.createGain();
      src.buffer=b; g.gain.value=.85; src.connect(g); g.connect(actx.destination); src.start();
    }catch(e){}
  }

  function taps(i){ return parseInt(figs[i].getAttribute('data-taps')||'0',10)||0; }
  /* An interactive figure owns its touches: a slider to drag, several things to hit. On one of
     those the board never advances on a bare tap, only on the NEXT control. */
  function owns(i){ return figs[i].getAttribute('data-interactive')==='1'; }

  function paint(){
    figs.forEach(function(f,i){ f.classList.toggle('on', i===at); });
    var f=figs[at];
    /* The step classes are CUMULATIVE: after two taps the figure carries s1 AND s2, so a rule
       written for the first tap stays true for the rest of the figure. That is what lets
       things stay where the presenter put them. */
    for(var k=1;k<=8;k++) f.classList.toggle('s'+k, k<=step);
    sweep.classList.remove('run'); void sweep.offsetWidth; sweep.classList.add('run');
    nextBtn.classList.toggle('done', at>=figs.length-1);
    var left=taps(at)-step;
    if(owns(at)){
      cue.textContent = left>0
        ? 'THE SCREEN IS THE FIGURE   '+left+' MORE'
        : (at<figs.length-1 ? 'BOTTOM RIGHT FOR THE NEXT' : 'END');
    } else {
      cue.textContent = left>0
        ? 'TAP   '+left+' MORE'
        : (at<figs.length-1 ? 'TAP, OR BOTTOM RIGHT' : 'END   SWIPE BACK TO REPLAY');
    }
  }

  function advance(){
    if(step<taps(at)) step++;
    else if(at<figs.length-1){ at++; step=0; }
    else return;
    paint();
  }
  function back(){
    if(step>0) step--;
    else if(at>0){ at--; step=taps(at); }
    else return;
    paint();
  }

  function hit(x,y){
    ret.style.left=x+'px'; ret.style.top=y+'px';
    ret.classList.remove('hit'); void ret.offsetWidth; ret.classList.add('hit');
  }

  /* The NEXT control is a real hit target and is checked before anything else, so it works even
     while the figure underneath is claiming every other touch. */
  function onNext(t){ return t && t.closest && t.closest('#next'); }

  var sx=0,sy=0,t0=0;
  function down(x,y){ sx=x; sy=y; t0=Date.now(); }
  function up(x,y,target){
    if(onNext(target)){ blip(); hit(x,y); advance(); return; }
    var dx=x-sx, dy=y-sy;
    /* A swipe still works everywhere: it is unambiguous, and on an interactive figure a drag on
       the figure's own control is handled by the figure and never reaches here as a swipe. */
    if(Math.max(Math.abs(dx),Math.abs(dy))>60 && Date.now()-t0<800){
      blip();
      if(Math.abs(dx)>Math.abs(dy)) { if(dx<0) advance(); else back(); }
      else if(dy>0) back(); else advance();
      return;
    }
    /* A bare tap advances ONLY when the figure is not claiming the screen. */
    if(owns(at)){
      if(step<taps(at)){ blip(); hit(x,y); step++; paint(); }
      return;
    }
    blip(); hit(x,y); advance();
  }
  addEventListener('touchstart',function(e){var t=e.touches[0];down(t.clientX,t.clientY);},{passive:true});
  addEventListener('touchend',function(e){var t=e.changedTouches[0];
    up(t.clientX,t.clientY,document.elementFromPoint(t.clientX,t.clientY));},{passive:true});
  addEventListener('mousedown',function(e){down(e.clientX,e.clientY);});
  addEventListener('mouseup',function(e){up(e.clientX,e.clientY,e.target);});
  addEventListener('keydown',function(e){
    var k=e.key;
    if(k==='ArrowRight'||k===' '||k==='Enter') advance();
    else if(k==='ArrowLeft'||k==='ArrowDown') back();
    else if(k==='Home'){ at=0; step=0; paint(); }
  });

  /* ?figure=N opens on one figure AT ITS RESTING STATE, step zero.
     It used to open it complete, with every tap already applied, which made the console
     preview lie: a figure whose first state is a question mark and whose tap reveals a matrix
     previewed as the matrix, so it read as though the instruction had been ignored. The point
     of a preview is to show what the audience sees first, and the taps are then available by
     tapping the preview itself. */
  var q=parseInt((location.search.match(/[?&]figure=(\\d+)/)||[])[1],10);
  if(!isNaN(q) && figs[q]){ at=Math.max(0,Math.min(figs.length-1,q)); step=0; }
  paint();
})();
`;

/** Render a figure prezie to one self-contained interactive page. */
export function renderFigureScene(scene: FigureScene): string {
  const figures = scene.figures.map((f, i) => renderFigureFrame(f, i)).join('\n');
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<title>${esc(scene.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<style>${SCENE_ENGINE_CSS}${FRAME_CSS}</style>
</head><body>
<div id="grat"></div>
<div id="sweep"></div>
<div class="chrome tl">X-Y 1.00 V/DIV</div>
<div class="chrome tr">TIME 5 MS/DIV</div>
${figures}
<div id="next"></div>
<div id="ret"></div>
<div id="cue"></div>
<div id="crt"></div>
<script>${ENGINE_JS}</script>
</body></html>`;
}
