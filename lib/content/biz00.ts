/**
 * "Strip the AI Out First" capability-mapping shoot sheet (biz/00) — the
 * provided single-file HTML, verbatim in look, with persistence baked in the
 * same way as ep00:
 *   - data-key / data-shot / data-check attributes for stable, migratable keys
 *   - a "Saved / Saving" indicator beside the progress counter
 *   - autosave (debounced 1s + flush on blur) to ./state, load-on-open
 *   - a print rule so edits (incl. collapsed sections) appear in the PDF
 *
 * The UI/CSS is unchanged from the source. Only persistence was added.
 */

export const biz00Html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Strip the AI Out First — Shoot Sheet</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
  :root{
    --bg:#161620; --bg-deep:#0f0f17; --surface:#1d1d29; --surface-2:#232331;
    --mint:#4de8a0; --coral:#e87a4d; --amber:#e8c44d; --gold:#f0e1b6; --blue:#a5c1ec;
    --text:#f4ece4; --text-2:#c7b9ac; --text-3:#8a7d72;
    --hair:rgba(244,236,228,.08); --hair-strong:rgba(244,236,228,.14);
  }
  *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
  html{scroll-behavior:smooth;}
  body{background:radial-gradient(ellipse 900px 500px at 80% -10%,rgba(232,184,92,.05),transparent 60%),radial-gradient(ellipse 900px 500px at 20% 110%,rgba(105,252,203,.04),transparent 60%),var(--bg);
    color:var(--text);font-family:'Inter',sans-serif;line-height:1.5;padding:0 0 120px;max-width:760px;margin:0 auto;}
  header{position:sticky;top:0;z-index:50;background:rgba(15,15,23,.92);border-bottom:1px solid var(--hair-strong);
    padding:14px 20px;display:flex;align-items:center;justify-content:space-between;}
  header .ttl{font-family:'Space Grotesk';font-weight:600;font-size:17px;letter-spacing:-.02em;}
  header .ep{font-family:'JetBrains Mono';font-size:12px;color:var(--mint);}
  .head-right{display:flex;align-items:center;gap:14px;}
  .progress{font-family:'JetBrains Mono';font-size:12px;color:var(--text-3);}
  .saveind{font-family:'JetBrains Mono';font-size:11px;color:var(--text-3);transition:color .2s;white-space:nowrap;}
  .saveind.saving{color:var(--amber);}
  .saveind.ok{color:var(--mint);}
  .saveind.err{color:var(--coral);}
  .wrap{padding:20px;}
  .prep{background:var(--surface);border:1px solid var(--hair);border-radius:16px;padding:18px;margin-bottom:14px;
    box-shadow:inset 1px 1px 0 rgba(255,255,255,.05),inset -1px -1px 0 rgba(0,0,0,.4),8px 10px 20px rgba(0,0,0,.5);}
  .prep h2{font-family:'Space Grotesk';font-size:13px;text-transform:uppercase;letter-spacing:.14em;color:var(--amber);margin-bottom:14px;}
  .field{display:flex;align-items:center;gap:12px;margin-bottom:10px;}
  .field label{font-size:13px;color:var(--text-2);width:90px;flex-shrink:0;}
  .field input{flex:1;background:var(--bg-deep);border:1px solid var(--hair);border-radius:9px;padding:10px 12px;color:var(--text);font-family:'JetBrains Mono';font-size:15px;}
  .field input:focus{outline:none;border-color:var(--mint);}
  .prep .note{font-size:12px;color:var(--text-3);margin-top:6px;line-height:1.45;}
  .prep .note b{color:var(--mint);}
  .rules{border:1px dashed var(--hair-strong);border-radius:14px;padding:14px 16px;margin-bottom:24px;}
  .rules .r{display:flex;gap:10px;align-items:flex-start;font-size:13px;color:var(--text-2);margin:7px 0;}
  .rules .r b{color:var(--mint);font-weight:600;}
  .rules .dot{color:var(--mint);flex-shrink:0;}
  .rules .amber{color:var(--amber);}
  .setup{margin-bottom:14px;border-radius:18px;overflow:hidden;border:1px solid var(--hair);background:var(--surface);}
  .setup.active{border-color:rgba(77,232,160,.4);box-shadow:0 0 24px rgba(77,232,160,.08);}
  .setup-head{display:flex;align-items:center;gap:14px;padding:18px;cursor:pointer;background:var(--surface-2);user-select:none;}
  .setup-num{width:38px;height:38px;flex-shrink:0;border-radius:10px;background:var(--bg-deep);border:1px solid var(--hair-strong);
    display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono';font-size:16px;font-weight:500;color:var(--mint);}
  .setup-title{flex:1;}
  .setup-title .t{font-family:'Space Grotesk';font-weight:600;font-size:18px;letter-spacing:-.01em;}
  .setup-title .s{font-size:12.5px;color:var(--text-3);margin-top:2px;}
  .chev{color:var(--text-3);font-size:20px;transition:transform .2s;}
  .setup.open .chev{transform:rotate(180deg);}
  .setup-body{display:none;padding:6px 18px 20px;}
  .setup.open .setup-body{display:block;}
  .say{position:relative;background:linear-gradient(180deg,rgba(77,232,160,.08),rgba(77,232,160,.03));
    border-left:3px solid var(--mint);border-radius:8px;padding:16px 16px 16px 18px;margin:14px 0 0;
    font-family:'Space Grotesk';font-size:19px;line-height:1.42;font-weight:500;color:var(--text);outline:none;cursor:text;
    transition:box-shadow .15s;}
  .say::before{content:'SAY';position:absolute;top:-9px;left:14px;background:var(--mint);color:#0a1a14;
    font-family:'JetBrains Mono';font-weight:500;font-size:10px;letter-spacing:.1em;padding:2px 8px;border-radius:5px;}
  .say::after{content:'tap to edit';position:absolute;top:-9px;right:12px;font-family:'JetBrains Mono';
    font-size:9.5px;color:var(--text-3);opacity:.6;}
  .say:hover{box-shadow:inset 0 0 0 1px rgba(77,232,160,.25);}
  .say:focus{box-shadow:inset 0 0 0 1.5px var(--mint);background:linear-gradient(180deg,rgba(77,232,160,.12),rgba(77,232,160,.05));}
  .say:focus::after{content:'editing';color:var(--mint);opacity:1;}
  .say.edited::after{content:'edited';color:var(--amber);opacity:.9;}
  .say .fill{color:var(--amber);font-weight:700;border-bottom:2px dotted var(--amber);}
  .say .exact{color:var(--mint);}
  .do{display:flex;gap:10px;align-items:flex-start;background:var(--bg-deep);border:1px solid var(--hair);
    border-radius:8px;padding:12px 14px;margin:14px 0 0;font-size:14px;color:var(--text-2);}
  .do::before{content:'DO';font-family:'JetBrains Mono';font-size:10px;letter-spacing:.1em;color:var(--coral);
    background:rgba(232,122,77,.14);padding:2px 7px;border-radius:5px;flex-shrink:0;margin-top:1px;}
  .do b{color:var(--text);font-weight:600;}
  .beatlbl{font-family:'JetBrains Mono';font-size:11px;letter-spacing:.08em;color:var(--blue);text-transform:uppercase;margin:20px 0 0;}
  .beatlbl .coral{color:var(--coral);}
  .clip{background:var(--bg-deep);border:1px solid var(--hair);border-radius:10px;margin:8px 0 0;overflow:hidden;}
  .clip-head{display:flex;align-items:center;gap:11px;padding:12px 13px;cursor:pointer;}
  .clip .box{width:24px;height:24px;flex-shrink:0;border-radius:7px;border:2px solid var(--text-3);
    display:flex;align-items:center;justify-content:center;font-size:15px;color:var(--bg);transition:all .15s;}
  .clip.done .box{background:var(--mint);border-color:var(--mint);}
  .clip.done .box::after{content:'✓';font-weight:700;}
  .shot-no{font-family:'JetBrains Mono';font-size:11px;font-weight:500;color:var(--amber);
    background:rgba(232,196,77,.12);border:1px solid rgba(232,196,77,.35);border-radius:6px;
    padding:3px 7px;flex-shrink:0;letter-spacing:.04em;white-space:nowrap;}
  .clip-lbl{flex:1;font-size:14px;color:var(--text-2);}
  .clip-lbl small{color:var(--text-3);display:block;font-size:12px;margin-top:2px;}
  .clip.done .clip-lbl{color:var(--text-3);}
  .clip-toggle{font-family:'JetBrains Mono';font-size:11px;color:var(--mint);background:rgba(77,232,160,.1);
    border:1px solid rgba(77,232,160,.3);border-radius:6px;padding:4px 9px;flex-shrink:0;}
  .clip-fields{display:none;padding:0 13px 13px;border-top:1px solid var(--hair);margin-top:2px;}
  .clip.expanded .clip-fields{display:block;padding-top:12px;}
  .clip-field{margin-bottom:10px;}
  .clip-field label{display:block;font-family:'JetBrains Mono';font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);margin-bottom:5px;}
  .clip-field input,.clip-field textarea{width:100%;background:var(--surface);border:1px solid var(--hair);
    border-radius:8px;padding:10px 12px;color:var(--text);font-family:'Inter';font-size:14px;resize:vertical;}
  .clip-field input{font-family:'JetBrains Mono';}
  .clip-field input:focus,.clip-field textarea:focus{outline:none;border-color:var(--mint);}
  .chk{display:flex;align-items:center;gap:12px;padding:13px 14px;margin:8px 0 0;background:var(--bg-deep);border:1px solid var(--hair);border-radius:10px;cursor:pointer;font-size:15px;}
  .chk .box{width:24px;height:24px;flex-shrink:0;border-radius:7px;border:2px solid var(--text-3);display:flex;align-items:center;justify-content:center;font-size:15px;color:var(--bg);}
  .chk.done .box{background:var(--mint);border-color:var(--mint);}
  .chk.done .box::after{content:'✓';font-weight:700;}
  .chk.done .lbl{color:var(--text-3);text-decoration:line-through;}
  .chk .lbl small{display:block;color:var(--text-3);font-size:12px;margin-top:2px;text-decoration:none;}
  .after{background:var(--surface);border:1px solid var(--hair);border-radius:18px;padding:20px;margin-top:14px;}
  .after h2{font-family:'Space Grotesk';font-size:13px;text-transform:uppercase;letter-spacing:.14em;color:var(--blue);margin-bottom:6px;}
  .after .sub{font-size:12.5px;color:var(--text-3);margin-bottom:14px;}
  .winbox{margin-top:24px;border-radius:16px;padding:20px;background:radial-gradient(circle at 50% 0%,rgba(105,252,203,.10),transparent 60%),var(--surface);border:1px solid rgba(77,232,160,.25);text-align:center;}
  .winbox .h{font-family:'Space Grotesk';font-weight:600;font-size:16px;color:var(--mint);margin-bottom:8px;}
  .winbox p{font-size:14px;color:var(--text-2);line-height:1.55;}
  .winbox b{color:var(--mint);}
  .reset{display:block;margin:28px auto 0;background:none;border:1px solid var(--hair);color:var(--text-3);font-family:'JetBrains Mono';font-size:12px;padding:8px 16px;border-radius:8px;cursor:pointer;}
  /* print: expand everything so persisted edits show, hide interactive-only chrome */
  @media print{
    header{position:static;}
    .saveind{display:none;}
    .setup-body{display:block!important;}
    .clip-fields{display:block!important;}
    .chev,.clip-toggle,.reset{display:none!important;}
    .setup{break-inside:avoid;}
    .clip,.chk{break-inside:avoid;}
    body{padding-bottom:0;}
  }
</style>
</head>
<body>
<header>
  <div><div class="ttl">Strip the AI Out First</div><div class="ep">CAPABILITY MAPPING · FRAMING 01 · SHOOT SHEET</div></div>
  <div class="head-right">
    <span class="saveind" id="saveState"></span>
    <div class="progress" id="prog">0 / 0</div>
  </div>
</header>
<div class="wrap">

  <!-- PREP -->
  <div class="prep">
    <h2>① Lock these first</h2>
    <div class="field"><label>Date</label><input type="text" data-key="prep.date" placeholder="today's date"></div>
    <div class="field"><label>Wardrobe</label><input type="text" data-key="prep.wardrobe" placeholder="what you're wearing — note it, every clip must match"></div>
    <div class="field"><label>Location</label><input type="text" data-key="prep.location" placeholder="studio / office"></div>
    <div class="field"><label>Format</label><input type="text" data-key="prep.format" placeholder="9:16 / 16:9 / both"></div>
    <p class="note">DJI mics on, both channels live. Every clip inherits this continuity set. <b>Video naming:</b> shot{NN}_take{N}_{descriptor}.mp4 — e.g. shot01_take2_hook1_contrarian.mp4</p>
  </div>

  <!-- GOLDEN RULES -->
  <div class="rules">
    <div class="r"><span class="dot">▸</span><div><b>Work straight down.</b> Record → stop → tap box → log file → next. The page is in shoot order.</div></div>
    <div class="r"><span class="dot">▸</span><div><b>Slate every clip.</b> Say <span class="amber">"shot [N], take [M]"</span> before, <span class="amber">"end clip"</span> after. Every take. Matches the filename convention.</div></div>
    <div class="r"><span class="dot">▸</span><div><b>First 3 seconds decide everything.</b> The verbal hooks are hero shots. Reshoot if flat. A beat of silence before and after each.</div></div>
    <div class="r"><span class="dot">▸</span><div><b>Raw beats glossy.</b> Real and clear wins. Your voice does the explaining — the graphic behind you does almost no words.</div></div>
  </div>

  <!-- SETUP 1: VERBAL HOOKS (to camera, hero shots) -->
  <div class="setup open active" data-setup>
    <div class="setup-head" onclick="toggle(this)">
      <div class="setup-num">1</div>
      <div class="setup-title"><div class="t">3 Verbal Hook Openings</div><div class="s">~5–8s each · to camera · hero shots · record first</div></div>
      <div class="chev">⌄</div>
    </div>
    <div class="setup-body">
      <div class="do"><div>Start here — three short, sharp openings. A beat of silence before and after each. Reshoot any that feel flat. These are the shots the whole piece rests on.</div></div>

      <p class="beatlbl">Hook 1 · Contrarian</p>
      <div class="say" contenteditable="true" spellcheck="false" data-key="say.hook1">Stop looking at the AI. It's the worst place to start.</div>
      <div class="clip" data-clip data-shot="shot01"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 01</div><div class="clip-lbl" onclick="check(event,this)">Hook 1 — Contrarian</div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot01.filename" placeholder="shot01_take1_hook1_contrarian.mp4"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot01.description" placeholder="best take, any notes"></textarea></div></div></div>

      <p class="beatlbl">Hook 2 · Stakes / stat</p>
      <div class="say" contenteditable="true" spellcheck="false" data-key="say.hook2">95% of the first wave of AI projects failed. Same reason every time.</div>
      <div class="clip" data-clip data-shot="shot02"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 02</div><div class="clip-lbl" onclick="check(event,this)">Hook 2 — Stakes / stat</div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot02.filename" placeholder="shot02_take1_hook2_stakes.mp4"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot02.description" placeholder=""></textarea></div></div></div>

      <p class="beatlbl">Hook 3 · Authority</p>
      <div class="say" contenteditable="true" spellcheck="false" data-key="say.hook3">I've spent 800 hours building AI agent teams. The biggest mistake I see business leaders make is starting with the AI.</div>
      <div class="clip" data-clip data-shot="shot03"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 03</div><div class="clip-lbl" onclick="check(event,this)">Hook 3 — Authority</div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot03.filename" placeholder="shot03_take1_hook3_authority.mp4"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot03.description" placeholder=""></textarea></div></div></div>
    </div>
  </div>

  <!-- SETUP 2: THE BODY (beat by beat) -->
  <div class="setup" data-setup>
    <div class="setup-head" onclick="toggle(this)">
      <div class="setup-num">2</div>
      <div class="setup-title"><div class="t">The Body · To Camera</div><div class="s">5 beats · each beat is its own shot</div></div>
      <div class="chev">⌄</div>
    </div>
    <div class="setup-body">
      <div class="do"><div>Each beat is its own short take — slate it, say it, stop, log it, move on. A flub only costs that beat. Talk straight to camera, your own words. These five beats are the arc: trap → cost → the move → the unlock → the close.</div></div>

      <p class="beatlbl">Beat 1 · The trap</p>
      <div class="say" contenteditable="true" spellcheck="false" data-key="say.beat1">Every business owner with a bottleneck right now is reaching for an AI tool to fix it. That feels like progress. It's actually the mistake.</div>
      <div class="clip" data-clip data-shot="shot04"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 04</div><div class="clip-lbl" onclick="check(event,this)">Beat 1 — The trap</div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot04.filename" placeholder="shot04_take1_beat1_trap.mp4"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot04.description" placeholder=""></textarea></div></div></div>

      <p class="beatlbl">Beat 2 · The cost of skipping</p>
      <div class="say" contenteditable="true" spellcheck="false" data-key="say.beat2">95% of the first wave of AI integration failed. Not because the tools were bad. Because people applied an agent to a problem they hadn't even defined yet. When your agent is only 80% right, your team rejects it. Every time.</div>
      <div class="clip" data-clip data-shot="shot05"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 05</div><div class="clip-lbl" onclick="check(event,this)">Beat 2 — Cost of skipping</div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot05.filename" placeholder="shot05_take1_beat2_cost.mp4"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot05.description" placeholder=""></textarea></div></div></div>

      <p class="beatlbl">Beat 3 · The move</p>
      <div class="say" contenteditable="true" spellcheck="false" data-key="say.beat3">The move is to strip the AI out completely. Forget it exists for a minute. Look at the bare work. Take the one bottleneck choking your business and break it into its capabilities — the atomic units of the actual work. Then decide: which of these is human, which is hybrid, which can an agent run entirely.</div>
      <div class="clip" data-clip data-shot="shot06"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 06</div><div class="clip-lbl" onclick="check(event,this)">Beat 3 — The move</div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot06.filename" placeholder="shot06_take1_beat3_move.mp4"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot06.description" placeholder=""></textarea></div></div></div>

      <p class="beatlbl">Beat 4 · The unlock <span class="coral">(the keystone moment)</span></p>
      <div class="say" contenteditable="true" spellcheck="false" data-key="say.beat4">Here's the thing nobody tells you. "What does good look like?" is completely unanswerable at the business level. The moment you break it to one capability — say, triaging inbound email — you can suddenly answer it with total clarity. The decomposition creates the clarity. That's the whole special sauce.</div>
      <div class="clip" data-clip data-shot="shot07"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 07</div><div class="clip-lbl" onclick="check(event,this)">Beat 4 — The unlock</div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot07.filename" placeholder="shot07_take1_beat4_unlock.mp4"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot07.description" placeholder=""></textarea></div></div></div>

      <p class="beatlbl">Beat 5 · The close</p>
      <div class="say" contenteditable="true" spellcheck="false" data-key="say.beat5">Everyone agrees with this the moment they see it. The problem is nobody's shown them the move exists. Map the work. Find the human. Then add the agents. That's the order.</div>
      <div class="clip" data-clip data-shot="shot08"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 08</div><div class="clip-lbl" onclick="check(event,this)">Beat 5 — The close</div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot08.filename" placeholder="shot08_take1_beat5_close.mp4"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot08.description" placeholder=""></textarea></div></div></div>

      <p class="beatlbl">The CTA</p>
      <div class="say" contenteditable="true" spellcheck="false" data-key="say.cta">Go to polynize.ai and hit Map Your Bottleneck. In about five minutes you'll see your own business mapped — what stays human, what's hybrid, what an agent can run. Once you see it, you can't unsee it. Link's in the bio.</div>
      <div class="clip" data-clip data-shot="shot09"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 09</div><div class="clip-lbl" onclick="check(event,this)">The CTA</div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot09.filename" placeholder="shot09_take1_cta.mp4"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot09.description" placeholder=""></textarea></div></div></div>
    </div>
  </div>

  <!-- SETUP 3: FACE BANK (studio photos) -->
  <div class="setup" data-setup>
    <div class="setup-head" onclick="toggle(this)">
      <div class="setup-num">3</div>
      <div class="setup-title"><div class="t">Face Bank Photos</div><div class="s">still photos · different expressions · goes to _inputs/face-bank/</div></div>
      <div class="chev">⌄</div>
    </div>
    <div class="setup-body">
      <div class="do"><div>Still shots, natural real moments. Phone camera in good light is fine. <b>Naming: marrs_{expression}_{angle}_{n}.jpg</b> — e.g. marrs_focused_front_01.jpg. These unlock thumbnails and the photo-base layering system across all content.</div></div>

      <div class="clip" data-clip data-shot="shot10"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 10</div><div class="clip-lbl" onclick="check(event,this)">Focused / at screen <small>front + slight 3/4 angle</small></div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot10.filename" placeholder="marrs_focused_front_01.jpg"></div><div class="clip-field"><label>Notes</label><textarea rows="2" data-key="shot10.description" placeholder="natural, working, not posed"></textarea></div></div></div>

      <div class="clip" data-clip data-shot="shot11"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 11</div><div class="clip-lbl" onclick="check(event,this)">Thinking / chin up <small>looking slightly off-camera</small></div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot11.filename" placeholder="marrs_thinking_45deg_01.jpg"></div><div class="clip-field"><label>Notes</label><textarea rows="2" data-key="shot11.description" placeholder=""></textarea></div></div></div>

      <div class="clip" data-clip data-shot="shot12"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 12</div><div class="clip-lbl" onclick="check(event,this)">Direct / confident <small>straight to camera — the authority thumbnail</small></div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot12.filename" placeholder="marrs_direct_front_01.jpg"></div><div class="clip-field"><label>Notes</label><textarea rows="2" data-key="shot12.description" placeholder=""></textarea></div></div></div>

      <div class="clip" data-clip data-shot="shot13"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 13</div><div class="clip-lbl" onclick="check(event,this)">Eyebrows raised / reaction <small>the scroll-stop thumbnail expression</small></div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot13.filename" placeholder="marrs_reaction_front_01.jpg"></div><div class="clip-field"><label>Notes</label><textarea rows="2" data-key="shot13.description" placeholder=""></textarea></div></div></div>

      <div class="clip" data-clip data-shot="shot14"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 14</div><div class="clip-lbl" onclick="check(event,this)">Caught working <small>2–3 candid shots, natural</small></div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot14.filename" placeholder="marrs_candid_desk_01.jpg, marrs_candid_desk_02.jpg"></div><div class="clip-field"><label>Notes</label><textarea rows="2" data-key="shot14.description" placeholder=""></textarea></div></div></div>
    </div>
  </div>

  <!-- SETUP 4: B-ROLL -->
  <div class="setup" data-setup>
    <div class="setup-head" onclick="toggle(this)">
      <div class="setup-num">4</div>
      <div class="setup-title"><div class="t">B-roll</div><div class="s">no talking · ~8–10s each · cuts under the arc</div></div>
      <div class="chev">⌄</div>
    </div>
    <div class="setup-body">
      <div class="do"><div>Silent footage. Still slate each ("shot 15, take 1"). Get extra length to trim. These cut under the body beats and the narrative. The capability map diagram (on screen or printed) is the key visual prop for this framing.</div></div>

      <div class="clip" data-clip data-shot="shot15"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 15</div><div class="clip-lbl" onclick="check(event,this)">Capability map on screen <small>slow scroll / pan across it</small></div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot15.filename" placeholder="shot15_take1_broll_capmap_screen.mp4"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot15.description" placeholder=""></textarea></div></div></div>

      <div class="clip" data-clip data-shot="shot16"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 16</div><div class="clip-lbl" onclick="check(event,this)">Three columns visible <small>human / hybrid / agent — the allocation</small></div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot16.filename" placeholder="shot16_take1_broll_columns.mp4"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot16.description" placeholder=""></textarea></div></div></div>

      <div class="clip" data-clip data-shot="shot17"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 17</div><div class="clip-lbl" onclick="check(event,this)">Hands on keyboard / working <small>close up</small></div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot17.filename" placeholder="shot17_take1_broll_keyboard.mp4"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot17.description" placeholder=""></textarea></div></div></div>

      <div class="clip" data-clip data-shot="shot18"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 18</div><div class="clip-lbl" onclick="check(event,this)">At desk, over-shoulder / rear</div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot18.filename" placeholder="shot18_take1_broll_desk_rear.mp4"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot18.description" placeholder=""></textarea></div></div></div>

      <div class="clip" data-clip data-shot="shot19"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 19</div><div class="clip-lbl" onclick="check(event,this)">Screen-recording: Hermes or the map interface <small>slow scroll</small></div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot19.filename" placeholder="screen_rec_capmap_01.mp4"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot19.description" placeholder=""></textarea></div></div></div>
    </div>
  </div>

  <!-- SETUP 5: NARRATIVE VO -->
  <div class="setup" data-setup>
    <div class="setup-head" onclick="toggle(this)">
      <div class="setup-num">5</div>
      <div class="setup-title"><div class="t">Narrative Voiceover</div><div class="s">~20s · audio only · lays over B-roll</div></div>
      <div class="chev">⌄</div>
    </div>
    <div class="setup-body">
      <div class="do"><div>Voice only on the DJI — calm, authoritative. Plays under the B-roll footage. One take or three short ones.</div></div>

      <p class="beatlbl">VO</p>
      <div class="say" contenteditable="true" spellcheck="false" data-key="say.vo">Most businesses trying to add AI agents to their team are doing it in the wrong order. They look for a tool, find an agent that sounds right, and bolt it on. Then wonder why their team rejects it six months later. The answer is always the same: they started with the AI. The move is to strip it out first. Map the bare work. Find the human at the centre of it. Then — and only then — design the agent team around them.</div>
      <div class="clip" data-clip data-shot="shot20"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 20</div><div class="clip-lbl" onclick="check(event,this)">Narrative voiceover <small>clean audio, one or three parts</small></div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot20.filename" placeholder="shot20_take1_narrative_vo.mp4"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot20.description" placeholder="one take, or note which parts"></textarea></div></div></div>
    </div>
  </div>

  <!-- AFTER -->
  <div class="after">
    <h2>After the shoot — 10 min while fresh</h2>
    <div class="sub">Don't skip this — it's how the footage becomes usable by CC.</div>
    <div class="chk" data-check="chk.videobank" onclick="check(event,this)"><div class="box"></div><div class="lbl">Drop all clips into video-bank: <code style="font-family:'JetBrains Mono';font-size:12px;color:var(--mint)">asset-kit/capability-mapping/strip-the-ai-out-first/_inputs/video-bank/</code></div></div>
    <div class="chk" data-check="chk.facebank" onclick="check(event,this)"><div class="box"></div><div class="lbl">Drop all face-bank photos into <code style="font-family:'JetBrains Mono';font-size:12px;color:var(--mint)">_inputs/face-bank/</code></div></div>
    <div class="chk" data-check="chk.logged" onclick="check(event,this)"><div class="box"></div><div class="lbl">Filenames + descriptions logged on every shot above</div></div>
    <div class="chk" data-check="chk.continuity" onclick="check(event,this)"><div class="box"></div><div class="lbl">Everything carries today's date / wardrobe / location</div></div>
    <div class="chk" data-check="chk.unscripted" onclick="check(event,this)"><div class="box"></div><div class="lbl">Noted the good unscripted lines <small>what you actually said often beats the script</small></div></div>
    <div class="chk" data-check="chk.pdf" onclick="check(event,this)"><div class="box"></div><div class="lbl">Print this sheet to PDF → upload as the shoot record</div></div>
  </div>

  <div class="winbox">
    <div class="h">What CC needs to assemble the first real cut</div>
    <p>The <b>3 verbal hooks</b> (Shots 01–03) + the <b>5 body beats</b> (Shots 04–08) + <b>B-roll</b> (Shots 15–19) + at least <b>2 face-bank photos</b> (Shots 10–14) for the thumbnail. Everything else is a bonus for this first batch.</p>
  </div>

  <button class="reset" onclick="resetChecklist()">reset checklist</button>

</div>
<script>
(function(){
  var clean = location.pathname.replace(/\\/+$/,'');
  var parts = clean.split('/');
  var EPISODE = parts[parts.length-1] || '00';
  var SHOW = parts[parts.length-2] || 'biz';
  var STATE_URL = clean + '/state';
  var TOKEN = new URLSearchParams(location.search).get('k') || '';

  // ---------- UI behaviour (from the original sheet) ----------
  window.toggle = function(head){
    var s=head.closest('.setup');
    var wasOpen=s.classList.contains('open');
    document.querySelectorAll('.setup').forEach(function(x){x.classList.remove('open');x.classList.remove('active');});
    if(!wasOpen){s.classList.add('open');s.classList.add('active');s.scrollIntoView({behavior:'smooth',block:'start'});}
  };
  window.check = function(e,el){
    if(e) e.stopPropagation();
    var row=el.closest('.clip')||el.closest('.chk');
    row.classList.toggle('done');
    updateProg();
    scheduleSave();
  };
  window.expand = function(btn){
    var c=btn.closest('.clip');
    c.classList.toggle('expanded');
    btn.textContent=c.classList.contains('expanded')?'– clip':'+ clip';
  };
  window.updateProg = function(){
    var all=document.querySelectorAll('.chk, .clip').length;
    var done=document.querySelectorAll('.chk.done, .clip.done').length;
    document.getElementById('prog').textContent=done+' / '+all;
  };
  window.resetChecklist = function(){
    if(!confirm('Clear all checkmarks?')) return;
    document.querySelectorAll('.chk.done, .clip.done').forEach(function(c){c.classList.remove('done');});
    updateProg();
    scheduleSave();
  };

  // ---------- save indicator ----------
  var ind=document.getElementById('saveState');
  function setInd(text, cls){ if(!ind) return; ind.textContent=text; ind.className='saveind'+(cls?' '+cls:''); }

  // ---------- collect / apply (the migratable shape) ----------
  function collect(){
    var prep={};
    document.querySelectorAll('[data-key^="prep."]').forEach(function(el){ prep[el.getAttribute('data-key').slice(5)] = el.value; });
    var scripts={};
    document.querySelectorAll('.say[data-key]').forEach(function(el){ scripts[el.getAttribute('data-key')] = { text: el.innerHTML, edited: el.classList.contains('edited') }; });
    var shots={};
    document.querySelectorAll('.clip[data-shot]').forEach(function(c){
      var id=c.getAttribute('data-shot');
      var fn=c.querySelector('[data-key="'+id+'.filename"]');
      var ds=c.querySelector('[data-key="'+id+'.description"]');
      shots[id]={ done:c.classList.contains('done'), filename: fn?fn.value:'', description: ds?ds.value:'' };
    });
    var checks={};
    document.querySelectorAll('.chk[data-check]').forEach(function(c){ checks[c.getAttribute('data-check')] = c.classList.contains('done'); });
    return { episode_id: EPISODE, show: SHOW, prep:prep, scripts:scripts, shots:shots, checks:checks };
  }
  function apply(state){
    if(!state || typeof state!=='object') return;
    if(state.prep){ document.querySelectorAll('[data-key^="prep."]').forEach(function(el){ var k=el.getAttribute('data-key').slice(5); if(state.prep[k]!=null) el.value=state.prep[k]; }); }
    if(state.scripts){ document.querySelectorAll('.say[data-key]').forEach(function(el){ var sc=state.scripts[el.getAttribute('data-key')]; if(sc){ if(typeof sc.text==='string') el.innerHTML=sc.text; if(sc.edited) el.classList.add('edited'); else el.classList.remove('edited'); } }); }
    if(state.shots){ document.querySelectorAll('.clip[data-shot]').forEach(function(c){ var id=c.getAttribute('data-shot'); var sh=state.shots[id]; if(sh){ c.classList.toggle('done', !!sh.done); var fn=c.querySelector('[data-key="'+id+'.filename"]'); var ds=c.querySelector('[data-key="'+id+'.description"]'); if(fn&&sh.filename!=null)fn.value=sh.filename; if(ds&&sh.description!=null)ds.value=sh.description; } }); }
    if(state.checks){ document.querySelectorAll('.chk[data-check]').forEach(function(c){ var v=state.checks[c.getAttribute('data-check')]; if(v!=null) c.classList.toggle('done', !!v); }); }
    updateProg();
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

  // ---------- wire listeners ----------
  // capture .say originals BEFORE applying saved state, so edited-detection compares to the baked text
  document.querySelectorAll('.say[contenteditable]').forEach(function(el){
    el.dataset.original = el.innerHTML;
    el.addEventListener('input', function(){
      if(el.innerHTML !== el.dataset.original){ el.classList.add('edited'); } else { el.classList.remove('edited'); }
      scheduleSave();
    });
    el.addEventListener('blur', flushSave);
    el.addEventListener('click', function(e){ e.stopPropagation(); });
  });
  document.querySelectorAll('[data-key^="prep."], .clip-field input, .clip-field textarea').forEach(function(el){
    el.addEventListener('input', scheduleSave);
    el.addEventListener('blur', flushSave);
  });

  // ---------- load saved state on open ----------
  setInd('Loading…','saving');
  fetch(STATE_URL, { headers:{'x-sheet-token':TOKEN} })
    .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
    .then(function(state){ apply(state); setInd('Saved ✓','ok'); })
    .catch(function(){ updateProg(); setInd('Not saved','err'); });

  updateProg();
})();
</script>
</body>
</html>`;
