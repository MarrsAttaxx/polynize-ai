/**
 * "Strip the AI Out First" script + capture sheet (biz/00) — the provided
 * single-file teleprompter HTML, verbatim in look, with persistence baked in
 * the same way as the other content sheets:
 *   - data-key on the editable script slab + data-check on the capture checks
 *   - a "Saved / Saving" indicator in the header controls
 *   - autosave (debounced 1s + flush on blur) to ./state, load-on-open
 *   - prompter mode + print-to-PDF preserved unchanged
 *
 * The UI/CSS is unchanged from the source. Only persistence was added.
 */

export const biz00Html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Strip the AI Out First — Script + Capture Sheet</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
  :root{
    --bg:#161620; --bg-deep:#0f0f17; --surface:#1d1d29; --surface-2:#232331;
    --mint:#4de8a0; --coral:#e87a4d; --blue:#a5c1ec; --amber:#e8c44d;
    --text:#f4ece4; --text-2:#c7b9ac; --text-3:#8a7d72;
    --hair:rgba(244,236,228,.10);
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;line-height:1.5;margin:0;}
  header{position:sticky;top:0;z-index:50;background:rgba(15,15,23,.94);border-bottom:1px solid var(--hair);
    padding:14px 22px;display:flex;align-items:center;justify-content:space-between;backdrop-filter:blur(8px);}
  header .ttl{font-family:'Space Grotesk';font-weight:600;font-size:16px;}
  header .ep{font-family:'JetBrains Mono';font-size:11px;color:var(--mint);margin-top:2px;}
  .controls{display:flex;gap:8px;align-items:center;}
  .controls button{font-family:'JetBrains Mono';font-size:11px;background:var(--surface);color:var(--text-2);
    border:1px solid var(--hair);border-radius:7px;padding:7px 11px;cursor:pointer;}
  .controls button:hover{border-color:var(--mint);color:var(--mint);}
  .saveind{font-family:'JetBrains Mono';font-size:11px;color:var(--text-3);transition:color .2s;white-space:nowrap;margin-right:4px;}
  .saveind.saving{color:var(--amber);}
  .saveind.ok{color:var(--mint);}
  .saveind.err{color:var(--coral);}
  .container{max-width:820px;margin:0 auto;padding:0 22px;}

  .sec-label{font-family:'JetBrains Mono';font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--amber);
    margin:30px 0 12px;padding-top:20px;border-top:1px solid var(--hair);}
  .sec-label:first-of-type{border-top:none;padding-top:0;}

  /* camera / setup card */
  .card{background:var(--surface);border:1px solid var(--hair);border-radius:14px;padding:16px 18px;margin-bottom:14px;}
  .card .row{display:flex;gap:10px;align-items:flex-start;font-size:13.5px;color:var(--text-2);margin:8px 0;}
  .card .row .k{color:var(--mint);flex-shrink:0;font-family:'JetBrains Mono';font-size:12px;min-width:64px;}
  .card .row b{color:var(--text);}

  .legend{display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:var(--text-3);margin:6px 0 14px;}
  .legend .sw{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:middle;}

  /* the script slab */
  .script{padding:40px 48px;background:var(--surface);border:1px solid var(--hair);border-radius:18px;outline:none;
    font-family:'Space Grotesk';font-weight:400;font-size:25px;line-height:1.85;text-align:center;color:var(--text);}
  .script:focus{border-color:rgba(77,232,160,.4);}
  .script p{margin:0 0 1.1em;}
  .slate{font-family:'JetBrains Mono';font-size:14px;color:var(--mint);letter-spacing:.05em;font-weight:500;}
  .cue{font-family:'JetBrains Mono';font-size:13px;letter-spacing:.04em;color:var(--text-3);text-transform:uppercase;
    display:block;margin:1.6em 0 .5em;}
  .sf{color:var(--coral);}
  .lf{color:var(--blue);}
  .end{font-family:'JetBrains Mono';font-size:13px;color:var(--text-3);}
  hr{border:none;border-top:1px solid var(--hair);margin:1.8em auto;width:40%;}

  /* lists */
  .item{display:flex;gap:11px;align-items:flex-start;padding:12px 14px;margin-top:8px;background:var(--bg-deep);border:1px solid var(--hair);border-radius:9px;}
  .item .n{font-family:'JetBrains Mono';font-size:11px;color:var(--amber);background:rgba(232,196,77,.12);border:1px solid rgba(232,196,77,.3);border-radius:6px;padding:3px 7px;flex-shrink:0;}
  .item .d{font-size:13.5px;color:var(--text-2);}
  .item .d small{display:block;color:var(--text-3);font-size:12px;margin-top:2px;font-family:'JetBrains Mono';}
  .check{display:flex;align-items:center;gap:11px;padding:11px 14px;margin-top:8px;background:var(--bg-deep);border:1px solid var(--hair);border-radius:9px;cursor:pointer;}
  .check .box{width:22px;height:22px;flex-shrink:0;border-radius:6px;border:2px solid var(--text-3);display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--bg);}
  .check.done .box{background:var(--mint);border-color:var(--mint);}
  .check.done .box::after{content:'\\2713';font-weight:700;}
  .check .lbl{flex:1;font-size:13.5px;color:var(--text-2);}
  .check.done .lbl{color:var(--text-3);}
  .footpad{height:120px;}

  /* prompter mode: hide everything except the script slab */
  body.prompter header,body.prompter .sec-label,body.prompter .card,body.prompter .legend,
  body.prompter .item,body.prompter .check,body.prompter .footpad{display:none!important;}
  body.prompter{background:#000;}
  body.prompter .container{max-width:100%;padding:0;}
  body.prompter .script{max-width:100%;margin:0;border:none;border-radius:0;background:#000;font-size:46px;line-height:2;padding:60vh 8vw;color:#fff;}
  body.prompter .cue{color:#888;font-size:22px;}
  body.prompter .slate{color:#7CFFB2;font-size:24px;}
  body.prompter .sf{color:#ff9d7a;}
  body.prompter .lf{color:#bcd2f5;}

  @media print{header,.controls{display:none;}.script{border:none;font-size:15px;text-align:left;}body{background:#fff;color:#000;}.card,.item,.check{border-color:#ccc;}}
</style>
</head>
<body>
<header>
  <div><div class="ttl">Strip the AI Out First</div><div class="ep">CAPABILITY MAPPING · ONE TAKE · 4K 16:9</div></div>
  <div class="controls">
    <span class="saveind" id="saveState"></span>
    <button onclick="document.body.classList.toggle('prompter')">prompter mode</button>
    <button onclick="window.print()">pdf</button>
  </div>
</header>

<div class="container">

  <!-- CAMERA / SETUP -->
  <div class="sec-label">① Lock before you roll</div>
  <div class="card">
    <div class="row"><span class="k">CAMERA</span><div><b>4K · 16:9 · framed wide.</b> Standing, head top-third-centre, looking down the barrel. Wide enough that vertical crops (9:16) have pixels to spare and you can punch in for zoom dynamics.</div></div>
    <div class="row"><span class="k">AUDIO</span><div><b>DJI mics on, both channels.</b> Check levels on the first take.</div></div>
    <div class="row"><span class="k">FILE</span><div><b>One master file, one take.</b> e.g. <span style="font-family:'JetBrains Mono';color:var(--mint)">strip-ai-out_master_take1.mp4</span> → the spoken slates inside let the engine chop it. If you redo a section, just say "take 2" and keep rolling.</div></div>
    <div class="row"><span class="k">PROMPTER</span><div>Hit <b>prompter mode</b> (top right) → the script goes full-screen white-on-black. Edit any line first by clicking into it.</div></div>
  </div>

  <!-- THE SCRIPT -->
  <div class="sec-label">② The script — one take, read straight down</div>
  <div class="legend">
    <span><span class="sw" style="background:var(--coral)"></span>coral = short-form (hit clean, hard stop)</span>
    <span><span class="sw" style="background:var(--blue)"></span>blue = extended (long-form only, flow on)</span>
    <span><span class="sw" style="background:var(--mint)"></span>mint = spoken slate</span>
  </div>
  <div class="script" contenteditable="true" spellcheck="false" data-key="script.body">

    <p class="cue" style="color:var(--amber)">⚡ 6 hook options — shoot them all, cut to 3 in the edit</p>

    <p class="slate">- shot 1, take 1 - (diagnosis + open loop)</p>
    <p class="sf">The reason most AI agents fail isn't the technology. It's that companies are focusing too much on the AI. Here's why that's wrong.</p>
    <p class="end">- end take -</p>

    <hr>

    <p class="slate">- shot 2, take 1 - (personal + shock)</p>
    <p class="sf">We were having trouble building a functional AI agent, until we stripped the AI out completely. What happened totally shocked us and our clients.</p>
    <p class="end">- end take -</p>

    <hr>

    <p class="slate">- shot 3, take 1 - (stat + one thing)</p>
    <p class="sf">92% of AI agents fail. Not because the tech is bad, but because nobody did this one thing first.</p>
    <p class="end">- end take -</p>

    <hr>

    <p class="slate">- shot 4, take 1 - (contrarian instruction)</p>
    <p class="sf">If you're trying to fix your business with an AI agent, stop. You're starting in the exact place that guarantees it fails.</p>
    <p class="end">- end take -</p>

    <hr>

    <p class="slate">- shot 5, take 1 - (curiosity / "what we did")</p>
    <p class="sf">We just handed most of a real company over to AI agents. But the first thing we did was delete every mention of AI. Here's why.</p>
    <p class="end">- end take -</p>

    <hr>

    <p class="slate">- shot 6, take 1 - (callout + reframe)</p>
    <p class="sf">Everyone's asking which AI agent to buy. That's the wrong question, and it's why their projects keep dying six months in.</p>
    <p class="end">- end take -</p>

    <hr>

    <p class="slate">- shot 4, take 1 - the long-form -</p>

    <span class="cue">open</span>
    <p>Right now there are thousands of business owners reaching for an AI tool to fix the thing that's slowing them down. And almost all of them are about to waste months on it.</p>
    <p>I've spent the last few years building AI agent teams inside real businesses, and I've watched this same mistake play out over and over. So in this video I'm going to show you the exact move that separates the companies that get value from AI from the 95% that don't.</p>
    <p>It's not a tool. It's not a model. It's a way of seeing your own business that, once you see it, you cannot unsee.</p>

    <span class="cue">section 1 - the trap - <span class="sf">short-form</span></span>
    <p class="sf">Every business owner with a bottleneck is reaching for an AI tool to fix it. That feels like progress. It's actually the mistake.</p>
    <span class="cue"><span class="lf">extended</span></span>
    <p class="lf">Here's why. The tool you're looking at was built to be sold to thousands of businesses, which means it was built to be generic. But your bottleneck isn't generic. Your version of marketing, or operations, or client onboarding, is a specific chain of steps that only exists in your business. So you bolt on a generic agent, it does a mediocre job of work it doesn't understand, and your team quietly stops using it. You didn't have a tool problem. You had a problem you never actually defined.</p>

    <span class="cue">section 2 - the cost - <span class="sf">short-form</span></span>
    <p class="sf">95% of the first wave of AI projects failed. Not because the tools were bad. Because nobody mapped the work first.</p>
    <span class="cue"><span class="lf">extended</span></span>
    <p class="lf">And when a generic agent is only 80% right, something predictable happens. Your team doesn't trust it. They go back to doing it manually, because 80% on the work that matters isn't good enough. It's actually worse than nothing, because now there's cleanup. This is the part nobody warns you about. The failure isn't dramatic, it's quiet. The agent just slowly gets abandoned, and everyone concludes AI doesn't work for us. When the truth is, it was never pointed at the right thing.</p>

    <span class="cue">section 3 - the move - <span class="sf">short-form</span></span>
    <p class="sf">So strip the AI out completely. Forget it exists. Look at the bare work, and break your bottleneck into its capabilities.</p>
    <span class="cue"><span class="lf">extended</span></span>
    <p class="lf">A capability is just an atomic unit of work, one thing that has to happen for the job to get done. Take any bottleneck and break it down, and you'll find it's made of maybe eight or ten of them. Now here's the part that does the work. You go through each capability and you ask: does this stay with a human, is this a true hybrid where a person and an agent work together, or can an agent own this entirely? You're not deciding with AI in your head anymore. You're looking at the bare work first, and only then deciding where the AI fits. Map the work. Find the human. Then add the agents. In that order.</p>

    <span class="cue">section 4 - the unlock - <span class="sf">short-form</span></span>
    <p class="sf">Here's the thing nobody tells you. "What does good look like?" is impossible to answer for your business, but obvious for one capability.</p>
    <span class="cue"><span class="lf">extended</span></span>
    <p class="lf">Ask a CEO what good marketing looks like and you'll get a vague answer, because the question's too big. But ask what good looks like for triaging inbound email, and suddenly it's crystal clear. Every email sorted and routed in under five minutes, nothing important missed. The granularity is what unlocks the answer. We had a client who kept saying 75% of their inbound was noise, and they were stuck. The moment we broke it down to that one capability, they could see exactly what good looked like, and exactly what to build. The decomposition didn't just organise the work. It made the problem solvable for the first time.</p>

    <span class="cue">section 5 - the close - <span class="sf">short-form</span></span>
    <p class="sf">Everyone agrees with this the second they see it. The problem is nobody's ever shown them the move exists.</p>
    <span class="cue"><span class="lf">extended</span></span>
    <p class="lf">It's genuinely original. There's no tool that does this, which is exactly why almost nobody does it. But you don't need permission to start. Take the one bottleneck that's costing you the most right now, and before you look at a single AI tool, break it into its capabilities and ask what good looks like for each one. That's the whole move. Strip the AI out first. Map the work. Find the human. Then build.</p>

    <span class="cue">cta - <span class="sf">short-form (comment)</span></span>
    <p class="sf">If you want to see your own business mapped this way, comment "MAP" and I'll send you the link. Once you see it, you can't unsee it.</p>

    <span class="cue">cta - <span class="lf">long-form (website)</span></span>
    <p class="lf">If you want to map your own bottleneck, head to polynize.ai and start with the free capability map. In about five minutes you'll see what stays human, what's hybrid, and what an agent can run. That's the first step we take with every client. I'll see you in the next one.</p>

    <p class="end">- end take -</p>

  </div>

  <!-- FACE BANK -->
  <div class="sec-label">③ Face bank photos — 16:9, framed wide</div>
  <div class="card" style="margin-bottom:10px;">
    <div class="row"><span class="k">HOW</span><div>Shot 16:9, framed slightly wide so a vertical crop has room. Good light. Naming: <b>marrs_{expression}_{angle}_{n}.jpg</b></div></div>
  </div>
  <div class="item"><span class="n">P-01</span><div class="d">Focused / at screen, front + slight 3/4 <small>marrs_focused_front_01.jpg</small></div></div>
  <div class="item"><span class="n">P-02</span><div class="d">Thinking / chin up, looking off-camera <small>marrs_thinking_45deg_01.jpg</small></div></div>
  <div class="item"><span class="n">P-03</span><div class="d">Direct / confident, straight to camera (authority thumbnail) <small>marrs_direct_front_01.jpg</small></div></div>
  <div class="item"><span class="n">P-04</span><div class="d">Eyebrows up / reaction (scroll-stop thumbnail) <small>marrs_reaction_front_01.jpg</small></div></div>
  <div class="item"><span class="n">P-05</span><div class="d">2-3 candid "caught working", natural <small>marrs_candid_desk_0N.jpg</small></div></div>
  <div class="check" data-check="chk.facebank" onclick="toggleCheck(this)"><div class="box"></div><div class="lbl">All face-bank photos shot → _inputs/face-bank/</div></div>

  <!-- B-ROLL -->
  <div class="sec-label">④ B-roll — 16:9 wide, silent, ~8-10s each</div>
  <div class="card" style="margin-bottom:10px;">
    <div class="row"><span class="k">HOW</span><div>Silent, 16:9 wide, get extra length. Slate each aloud. Naming: <b>shot{NN}_take{N}_broll_{descriptor}.mp4</b></div></div>
  </div>
  <div class="item"><span class="n">B-01</span><div class="d">Capability map on screen, slow scroll/pan <small>broll_capmap-screen.mp4</small></div></div>
  <div class="item"><span class="n">B-02</span><div class="d">Three columns visible: human / hybrid / agent <small>broll_columns.mp4</small></div></div>
  <div class="item"><span class="n">B-03</span><div class="d">Hands on keyboard / working, close up <small>broll_keyboard.mp4</small></div></div>
  <div class="item"><span class="n">B-04</span><div class="d">At desk, over-shoulder / rear <small>broll_desk-rear.mp4</small></div></div>
  <div class="item"><span class="n">B-05</span><div class="d">Screen-recording: the map interface, slow scroll <small>screen_rec_capmap_01.mp4</small></div></div>
  <div class="check" data-check="chk.broll" onclick="toggleCheck(this)"><div class="box"></div><div class="lbl">All B-roll shot → _inputs/video-bank/</div></div>

  <!-- AFTER -->
  <div class="sec-label">⑤ After the shoot — 10 min while fresh</div>
  <div class="check" data-check="chk.uploaded" onclick="toggleCheck(this)"><div class="box"></div><div class="lbl">Master take + B-roll → _inputs/video-bank/ · photos → _inputs/face-bank/</div></div>
  <div class="check" data-check="chk.unscripted" onclick="toggleCheck(this)"><div class="box"></div><div class="lbl">Noted any great unscripted lines (often beat the script)</div></div>
  <div class="check" data-check="chk.pdf" onclick="toggleCheck(this)"><div class="box"></div><div class="lbl">Print to PDF as the shoot record</div></div>

  <div class="footpad"></div>
</div>
<script>
(function(){
  var clean = location.pathname.replace(/\\/+$/,'');
  var parts = clean.split('/');
  var EPISODE = parts[parts.length-1] || '00';
  var SHOW = parts[parts.length-2] || 'biz';
  var STATE_URL = clean + '/state';
  var TOKEN = new URLSearchParams(location.search).get('k') || '';

  // ---------- save indicator ----------
  var ind=document.getElementById('saveState');
  function setInd(text, cls){ if(!ind) return; ind.textContent=text; ind.className='saveind'+(cls?' '+cls:''); }

  // ---------- collect / apply (the migratable shape) ----------
  function scriptEl(){ return document.querySelector('.script[data-key="script.body"]'); }
  function collect(){
    var sc=scriptEl();
    var checks={};
    document.querySelectorAll('.check[data-check]').forEach(function(c){ checks[c.getAttribute('data-check')] = c.classList.contains('done'); });
    return { episode_id: EPISODE, show: SHOW, script: sc?sc.innerHTML:null, checks: checks };
  }
  function apply(state){
    if(!state || typeof state!=='object') return;
    if(typeof state.script==='string'){ var sc=scriptEl(); if(sc) sc.innerHTML=state.script; }
    if(state.checks){ document.querySelectorAll('.check[data-check]').forEach(function(c){ var v=state.checks[c.getAttribute('data-check')]; if(v!=null) c.classList.toggle('done', !!v); }); }
  }

  // ---------- save (debounced 1s + flush on blur) ----------
  var timer=null, saving=false, pending=false;
  function doSave(){
    if(saving){ pending=true; return; }
    saving=true; setInd('Saving…','saving');
    fetch(STATE_URL, { method:'PUT', headers:{'Content-Type':'application/json','x-sheet-token':TOKEN}, body: JSON.stringify(collect()) })
      .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(function(){ setInd('Saved ✓','ok'); })
      .catch(function(){ setInd('Save failed','err'); })
      .then(function(){ saving=false; if(pending){ pending=false; doSave(); } });
  }
  function scheduleSave(){ setInd('Saving…','saving'); if(timer) clearTimeout(timer); timer=setTimeout(function(){ timer=null; doSave(); }, 1000); }
  function flushSave(){ if(timer){ clearTimeout(timer); timer=null; } doSave(); }

  // ---------- check toggle (replaces the inline classList toggle, + saves) ----------
  window.toggleCheck = function(el){ el.classList.toggle('done'); scheduleSave(); };

  // ---------- wire listeners ----------
  var sc=scriptEl();
  if(sc){
    sc.addEventListener('input', scheduleSave);
    sc.addEventListener('blur', flushSave);
  }

  // ---------- load saved state on open ----------
  setInd('Loading…','saving');
  fetch(STATE_URL, { headers:{'x-sheet-token':TOKEN} })
    .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
    .then(function(state){ apply(state); setInd('Saved ✓','ok'); })
    .catch(function(){ setInd('Not saved','err'); });
})();
</script>
</body>
</html>`;
