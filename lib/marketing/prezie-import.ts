/**
 * IMPORTING A PREZIE SOMEBODY ELSE DREW.
 *
 * Marrs spent a week trying to get April to draw one figure and could not, then one-shot a whole prezie
 * in a chat in an afternoon and liked it. The honest conclusion is that the console should stop trying to
 * be the author and go back to what it is good at: storing, versioning, performing and publishing. He
 * draws it wherever it works; this hosts it.
 *
 * WHY IT IS NOT WRAPPED IN THE ENGINE, having first been built that way and tested. Putting his document
 * in the engine's iframe broke his taps: served directly the file advances 01/12 to 02/12 on a click, and
 * inside the wrapper the same click did nothing. His file also has its OWN operator cue strip, better than
 * the engine's because it names the beat, and the engine stacked a second one on top of it reading "END".
 *
 * So the file is served AS THE PAGE, untouched, and the console adds exactly one thing: the touch sounds
 * it owns, injected as a small script. Everything else his file already does better than a wrapper could.
 *
 * SECURITY WITHOUT THE IFRAME. The prezie URL is unauthenticated by design (D31), and a document written
 * by an LLM must not be able to call `/console/...` with Marrs's session attached. The route serves this
 * under `Content-Security-Policy: sandbox allow-scripts`, which gives the TOP-LEVEL document an opaque
 * origin: no cookies, no storage, no same-origin requests, and no top-level navigation or forms, because
 * those tokens are deliberately not granted. Same protection the figure iframes get, no iframe needed.
 */

/**
 * The touch sounds, injected into his document.
 *
 * Web Audio rather than an <audio> element because an element cannot overlap itself, and a fast double
 * tap on the touchscreen would swallow its own second blip. The two samples alternate so repeated touches
 * do not read as a loop. Decoded on the first touch, which is itself the gesture that unlocks audio.
 *
 * The samples are fetched CORS, because the sandbox makes this document's origin opaque and its own
 * server is therefore cross-origin to it. `/pam/sfx/*` sends the header for exactly this reason.
 */
const SOUND = `
<script>
/* Added by the Polynize console. This is the ONLY thing injected: the prezie's own behaviour,
   sequencing and cue strip are untouched. */
(function(){
  var origin = ${JSON.stringify('SFX_ORIGIN')};
  var SFX=[origin+'/pam/sfx/touch-01.wav', origin+'/pam/sfx/touch-02.wav'];
  var actx=null, bufs=[null,null], turn=0;
  function load(i){
    if(bufs[i]!==null) return; bufs[i]=undefined;
    fetch(SFX[i],{mode:'cors'}).then(function(r){return r.arrayBuffer();})
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
  /* Capture phase and passive, so this can never interfere with his own handlers or swallow a tap. */
  addEventListener('pointerup', blip, {capture:true, passive:true});
  addEventListener('touchend', function(e){ if(!window.PointerEvent) blip(); }, {capture:true, passive:true});
})();
<\/script>`;

/**
 * Clean an imported document.
 *
 * Short, because the CSP sandbox is doing the security work. What is left is the one thing that would
 * break the PERFORMANCE rather than the console: `<base>`, which silently repoints every relative url in
 * the document.
 *
 * Remote assets are deliberately NOT stripped. A one-shot from a chat will reference Google Fonts, and
 * refusing that would break the typography of every file he imports. Loading the page before the camera
 * rolls is a studio habit, not something to enforce with a regex.
 */
export function sanitiseImportedPrezie(raw: string): string {
  return String(raw ?? '')
    .replace(/<\s*base\b[^>]*>/gi, '')
    .trim();
}

/**
 * His document, plus the touch sounds. Nothing else changes.
 *
 * `origin` is where the samples are served from, which has to be absolute: under the sandbox this document
 * has an opaque origin, so a relative path would resolve against nothing.
 */
export function withTouchSounds(html: string, origin: string): string {
  const doc = sanitiseImportedPrezie(html);
  const shim = SOUND.replace(JSON.stringify('SFX_ORIGIN'), JSON.stringify(origin));
  // As late as possible, so his own script has already set up.
  const at = doc.toLowerCase().lastIndexOf('</body>');
  if (at === -1) return `${doc}\n${shim}`;
  return `${doc.slice(0, at)}${shim}\n${doc.slice(at)}`;
}

/** A quick read of what arrived, so the console can say something true about it in the list. */
export function describeImported(html: string): {
  title?: string;
  bytes: number;
  looks_like_document: boolean;
  has_script: boolean;
} {
  const s = String(html ?? '');
  return {
    title: s.match(/<title>([^<]{1,120})<\/title>/i)?.[1]?.trim(),
    bytes: s.length,
    looks_like_document: /<html[\s>]|<!doctype/i.test(s),
    has_script: /<script[\s>]/i.test(s),
  };
}
