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
/* Arriving: the figure cuts in and settles, rather than fading. */
.figure.on{animation:figIn .3s cubic-bezier(.22,.9,.24,1) both}
@keyframes figIn{from{opacity:0;transform:scale(.99)}to{opacity:1;transform:none}}
`;

const ENGINE_JS = `
(function(){
  var figs=[].slice.call(document.querySelectorAll('.figure')),
      cue=document.getElementById('cue'),
      ret=document.getElementById('ret'),
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

  function paint(){
    figs.forEach(function(f,i){ f.classList.toggle('on', i===at); });
    var f=figs[at];
    /* The step classes are CUMULATIVE: after two taps the figure carries s1 AND s2, so a rule
       written for the first tap stays true for the rest of the figure. That is what lets
       things stay where the presenter put them. */
    for(var k=1;k<=8;k++) f.classList.toggle('s'+k, k<=step);
    sweep.classList.remove('run'); void sweep.offsetWidth; sweep.classList.add('run');
    var left=taps(at)-step;
    cue.textContent = left>0
      ? 'TAP   '+left+' MORE'
      : (at<figs.length-1 ? 'TAP FOR THE NEXT' : 'END   SWIPE BACK TO REPLAY');
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

  var sx=0,sy=0,t0=0;
  function down(x,y){ sx=x; sy=y; t0=Date.now(); }
  function up(x,y){
    var dx=x-sx, dy=y-sy;
    if(Math.max(Math.abs(dx),Math.abs(dy))>60 && Date.now()-t0<800){
      blip();
      if(Math.abs(dx)>Math.abs(dy)) { if(dx<0) advance(); else back(); }
      else if(dy>0) back(); else advance();
      return;
    }
    blip(); hit(x,y); advance();
  }
  addEventListener('touchstart',function(e){var t=e.touches[0];down(t.clientX,t.clientY);},{passive:true});
  addEventListener('touchend',function(e){var t=e.changedTouches[0];up(t.clientX,t.clientY);},{passive:true});
  addEventListener('mousedown',function(e){down(e.clientX,e.clientY);});
  addEventListener('mouseup',function(e){up(e.clientX,e.clientY);});
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
<div id="ret"></div>
<div id="cue"></div>
<div id="crt"></div>
<script>${ENGINE_JS}</script>
</body></html>`;
}
