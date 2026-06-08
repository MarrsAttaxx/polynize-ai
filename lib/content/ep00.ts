/**
 * Episode Zero shoot sheet — the provided single-file HTML, verbatim in look,
 * with persistence baked in:
 *   - data-key / data-shot / data-check attributes for stable, migratable keys
 *   - a "Saved / Saving" indicator beside the progress counter
 *   - autosave (debounced 1s + flush on blur) to ./state, load-on-open
 *   - a print rule so edits (incl. collapsed sections) appear in the PDF
 *
 * The UI/CSS is unchanged from the source. Only persistence was added.
 */

export const ep00Html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Episode Zero — Shoot Sheet</title>
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
  body{background:radial-gradient(ellipse 900px 500px at 80% -10%, rgba(232,184,92,.05), transparent 60%),radial-gradient(ellipse 900px 500px at 20% 110%, rgba(105,252,203,.04), transparent 60%),var(--bg);
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
    font-family:'Space Grotesk';font-size:19px;line-height:1.42;font-weight:500;color:var(--text);}
  .say::before{content:'SAY';position:absolute;top:-9px;left:14px;background:var(--mint);color:#0a1a14;
    font-family:'JetBrains Mono';font-weight:500;font-size:10px;letter-spacing:.1em;padding:2px 8px;border-radius:5px;}
  .say .fill{color:var(--amber);font-weight:700;border-bottom:2px dotted var(--amber);}
  .say .exact{color:var(--mint);}
  /* editable script lines */
  .say[contenteditable]{outline:none;cursor:text;transition:background .15s,box-shadow .15s;}
  .say[contenteditable]:hover{box-shadow:inset 0 0 0 1px rgba(77,232,160,.25);}
  .say[contenteditable]:focus{box-shadow:inset 0 0 0 1.5px var(--mint);background:linear-gradient(180deg,rgba(77,232,160,.12),rgba(77,232,160,.05));}
  .say::after{content:'✎ tap to edit';position:absolute;top:-9px;right:12px;font-family:'JetBrains Mono';
    font-size:9.5px;letter-spacing:.06em;color:var(--text-3);opacity:.6;}
  .say[contenteditable]:focus::after{content:'editing — tap away to save';color:var(--mint);opacity:1;}
  .say.edited::after{content:'✎ edited';color:var(--amber);opacity:.9;}
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
  .clip-lbl small{color:var(--text-3);}
  .clip.done .clip-lbl{color:var(--text-3);}
  .clip-toggle{font-family:'JetBrains Mono';font-size:11px;color:var(--mint);background:rgba(77,232,160,.1);
    border:1px solid rgba(77,232,160,.3);border-radius:6px;padding:4px 9px;flex-shrink:0;}
  .clip-fields{display:none;padding:0 13px 13px;border-top:1px solid var(--hair);margin-top:2px;}
  .clip.expanded .clip-fields{display:block;padding-top:12px;}
  .clip-field{margin-bottom:10px;}
  .clip-field label{display:block;font-family:'JetBrains Mono';font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);margin-bottom:5px;}
  .clip-field input,.clip-field textarea{width:100%;background:var(--surface);border:1px solid var(--hair);border-radius:8px;padding:10px 12px;color:var(--text);font-family:'Inter';font-size:14px;resize:vertical;}
  .clip-field input{font-family:'JetBrains Mono';}
  .clip-field input:focus,.clip-field textarea:focus{outline:none;border-color:var(--mint);}
  .clip-field .hint{font-size:11px;color:var(--text-3);margin-top:4px;}
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
    .setup-body{display:block !important;}
    .clip-fields{display:block !important;}
    .chev,.clip-toggle,.reset{display:none !important;}
    .setup{break-inside:avoid;}
    .clip,.chk{break-inside:avoid;}
  }
</style>
</head>
<body>
<header>
  <div><div class="ttl">The Origin Story</div><div class="ep">EPISODE ZERO · SHOOT SHEET</div></div>
  <div class="head-right">
    <span class="saveind" id="saveState"></span>
    <div class="progress" id="prog">0 / 0</div>
  </div>
</header>
<div class="wrap">

  <div class="prep">
    <h2>① Lock these first</h2>
    <div class="field"><label>Date</label><input type="text" data-key="prep.date" placeholder="today's date"></div>
    <div class="field"><label>Wardrobe</label><input type="text" data-key="prep.wardrobe" placeholder="what you're wearing"></div>
    <div class="field"><label>Location</label><input type="text" data-key="prep.location" placeholder="office"></div>
    <div class="field"><label>Hours</label><input type="text" data-key="prep.hours" placeholder="e.g. 742"></div>
    <p class="note">Every clip must match this set. Use your <b>real</b> hour count — an exact odd number (742), never round (700). DJI mics on, both channels live.</p>
  </div>

  <div class="rules">
    <div class="r"><span class="dot">▸</span><div><b>Raw beats glossy.</b> Real and clear wins. Don't over-polish.</div></div>
    <div class="r"><span class="dot">▸</span><div><b>First 3 seconds decide everything.</b> Each hook opening is a hero shot — nail it, reshoot if flat.</div></div>
    <div class="r"><span class="dot">▸</span><div><b>Value per second.</b> Keep delivery tight — every second earns the next.</div></div>
    <div class="r"><span class="dot">▸</span><div><b>Slate every clip.</b> Each row has a <span class="amber">SHOT ##</span>. Say <span class="amber">"shot 4, take 1"</span> before you start, <span class="amber">"end clip"</span> when you finish — every take. Then tick the box & log the file.</div></div>
    <div class="r"><span class="dot">▸</span><div><b>Work straight down.</b> Record → stop → tap the box under it → log the clip → next. The page is in shoot order.</div></div>
  </div>

  <div class="setup open active" data-setup>
    <div class="setup-head" onclick="toggle(this)">
      <div class="setup-num">1</div>
      <div class="setup-title"><div class="t">The 4 Hook Openings</div><div class="s">~5–8s each · to camera · hero shots · record first</div></div>
      <div class="chev">⌄</div>
    </div>
    <div class="setup-body">
      <div class="do"><div>Start here — short, sharp openings that warm you up and get the thesis in your mouth before the body. <b>First 3 seconds are everything.</b> Beat of silence before & after each. Reshoot any that feel flat.</div></div>
      <p class="beatlbl">Hook 1 · Problem</p>
      <div class="say" contenteditable="true" spellcheck="false" data-key="say.hook1">Every AI company will try and sell you an agent in a box. But it's never going to run any part of your business — and I'll show you why.</div>
      <div class="clip" data-clip data-shot="shot01"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 01</div><div class="clip-lbl" onclick="check(event,this)">Hook 1 — Problem</div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot01.filename" placeholder="IMG_1350"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot01.description" placeholder="best take, any notes"></textarea></div></div></div>
      <p class="beatlbl">Hook 2 · Thesis</p>
      <div class="say" contenteditable="true" spellcheck="false" data-key="say.hook2">One person and four AI agents will out-produce a team of twenty. We're betting our whole company on it.</div>
      <div class="clip" data-clip data-shot="shot02"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 02</div><div class="clip-lbl" onclick="check(event,this)">Hook 2 — Thesis</div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot02.filename" placeholder="IMG_1351"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot02.description" placeholder=""></textarea></div></div></div>
      <p class="beatlbl">Hook 3 · Stakes</p>
      <div class="say" contenteditable="true" spellcheck="false" data-key="say.hook3">We're about to hand most of our company over to a team of AI agents. On purpose. Here's the plan.</div>
      <div class="clip" data-clip data-shot="shot03"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 03</div><div class="clip-lbl" onclick="check(event,this)">Hook 3 — Stakes</div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot03.filename" placeholder="IMG_1352"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot03.description" placeholder=""></textarea></div></div></div>
      <p class="beatlbl">Hook 4 · Story</p>
      <div class="say" contenteditable="true" spellcheck="false" data-key="say.hook4">I spent <span class="fill">[hours]</span> hours building AI agents, and it taught me one thing that changed how we run our entire company.</div>
      <div class="clip" data-clip data-shot="shot04"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 04</div><div class="clip-lbl" onclick="check(event,this)">Hook 4 — Story</div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot04.filename" placeholder="IMG_1353"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot04.description" placeholder=""></textarea></div></div></div>
      <p class="beatlbl">The Series Hook · constant, follows every opening</p>
      <div class="say" contenteditable="true" spellcheck="false" data-key="say.series">In this series, I'll show you how to delegate 84% of a real business to 21 AI agents. 5 teams, 4 humans, 3 months to prove it works. That's the challenge — here's the journey.</div>
      <div class="clip" data-clip data-shot="shot05"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 05</div><div class="clip-lbl" onclick="check(event,this)">Series hook (1–2 takes)</div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot05.filename" placeholder="IMG_1354"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot05.description" placeholder=""></textarea></div></div></div>
    </div>
  </div>

  <div class="setup" data-setup>
    <div class="setup-head" onclick="toggle(this)">
      <div class="setup-num">2</div>
      <div class="setup-title"><div class="t">Narrative Voiceover</div><div class="s">~19s · audio only · lays over B-roll</div></div>
      <div class="chev">⌄</div>
    </div>
    <div class="setup-body">
      <div class="do"><div>Voice only — clean audio on the DJI. Calm, authoritative. Plays under the wall + desk footage. One take or three short ones.</div></div>
      <p class="beatlbl">VO part 1</p>
      <div class="say" contenteditable="true" spellcheck="false" data-key="say.vo1">I spent <span class="fill">[hours]</span> hours building AI agents. The biggest thing I learned is that a single agent — the kind every company is racing to sell you — can't actually run a business.</div>
      <p class="beatlbl">VO part 2</p>
      <div class="say" contenteditable="true" spellcheck="false" data-key="say.vo2">Real work doesn't happen in one box. It happens across a team. So we stopped building agents and started building a team of them — with a human at the centre of each one.</div>
      <p class="beatlbl">VO part 3</p>
      <div class="say" contenteditable="true" spellcheck="false" data-key="say.vo3">One human plus four agents: five times the throughput. That's the bet. And we're making it with our own company — live.</div>
      <div class="clip" data-clip data-shot="shot06"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 06</div><div class="clip-lbl" onclick="check(event,this)">Narrative voiceover (clean audio)</div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot06.filename" placeholder="IMG_1355"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot06.description" placeholder="one take, or note which parts"></textarea></div></div></div>
    </div>
  </div>

  <div class="setup" data-setup>
    <div class="setup-head" onclick="toggle(this)">
      <div class="setup-num">3</div>
      <div class="setup-title"><div class="t">The Body · To Camera</div><div class="s">the heart of the episode · each beat is its own shot</div></div>
      <div class="chev">⌄</div>
    </div>
    <div class="setup-body">
      <div class="do"><div>Each beat is its own short take — slate it, say it, stop, log it, move on. A flub only costs that beat. Talk straight to camera, your own words.</div></div>
      <p class="beatlbl">Opening line</p>
      <div class="say" contenteditable="true" spellcheck="false" data-key="say.open">For the last few months I've been obsessed with one question: how much of an actual business could you hand to AI agents? Not the toy version — a real company, with real clients, real money.</div>
      <div class="clip" data-clip data-shot="shot07"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 07</div><div class="clip-lbl" onclick="check(event,this)">Opening line</div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot07.filename" placeholder="IMG_1356"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot07.description" placeholder=""></textarea></div></div></div>
      <p class="beatlbl">Beat 1 · The problem</p>
      <div class="say" contenteditable="true" spellcheck="false" data-key="say.beat1">Every AI company sells you an agent now — Claude, Notion, Salesforce. Useful. But they're agents in a box. The second you need something specific, or working with your team, or handing to another agent — they can't. Locked in their own ecosystem. Never a real teammate.</div>
      <div class="clip" data-clip data-shot="shot08"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 08</div><div class="clip-lbl" onclick="check(event,this)">Beat 1 — the problem</div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot08.filename" placeholder="IMG_1357"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot08.description" placeholder=""></textarea></div></div></div>
      <p class="beatlbl">Beat 2 · The hours</p>
      <div class="say" contenteditable="true" spellcheck="false" data-key="say.beat2">Learned this the hard way. <span class="fill">[hours]</span> building agents — first on OpenClaw, now our own stack.</div>
      <div class="clip" data-clip data-shot="shot09"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 09</div><div class="clip-lbl" onclick="check(event,this)">Beat 2 — the hours</div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot09.filename" placeholder="IMG_1358"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot09.description" placeholder=""></textarea></div></div></div>
      <p class="beatlbl">Beat 3 · The insight</p>
      <div class="say" contenteditable="true" spellcheck="false" data-key="say.beat3">The answer isn't a better single agent. It's a team of them — one human at the centre, four agents doing the work that doesn't need to be human. <span class="exact">One human plus four agents: five times the throughput.</span></div>
      <div class="clip" data-clip data-shot="shot10"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 10</div><div class="clip-lbl" onclick="check(event,this)">Beat 3 — insight (tagline exact)</div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot10.filename" placeholder="IMG_1359"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot10.description" placeholder=""></textarea></div></div></div>
      <p class="beatlbl">Beat 4 · The wall reveal <span class="coral">(walk to wall)</span></p>
      <div class="say" contenteditable="true" spellcheck="false" data-key="say.beat4">This is what we've built. Every sheet is an agent. Every line is a decision about what stays human and what an agent runs. Five teams. 21 agents. Four humans.</div>
      <div class="clip" data-clip data-shot="shot11"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 11</div><div class="clip-lbl" onclick="check(event,this)">Beat 4 — wall reveal</div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot11.filename" placeholder="IMG_1360"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot11.description" placeholder=""></textarea></div></div></div>
      <p class="beatlbl">Beat 5 · The stakes</p>
      <div class="say" contenteditable="true" spellcheck="false" data-key="say.beat5">Next 90 days, we're handing 84% of our own company — Polynize — to this team. Marketing, customer success, operations, all of it. And documenting exactly how. <span class="fill">(confidence — not "if it works")</span></div>
      <div class="clip" data-clip data-shot="shot12"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 12</div><div class="clip-lbl" onclick="check(event,this)">Beat 5 — the stakes</div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot12.filename" placeholder="IMG_1361"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot12.description" placeholder=""></textarea></div></div></div>
      <p class="beatlbl">Beat 6 · Close into CTA</p>
      <div class="say" contenteditable="true" spellcheck="false" data-key="say.beat6">If you've been wondering where AI agents actually fit in your business — that's the whole reason I'm documenting this.</div>
      <div class="clip" data-clip data-shot="shot13"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 13</div><div class="clip-lbl" onclick="check(event,this)">Beat 6 — close</div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot13.filename" placeholder="IMG_1362"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot13.description" placeholder=""></textarea></div></div></div>
      <p class="beatlbl">The CTA</p>
      <div class="say" contenteditable="true" spellcheck="false" data-key="say.cta">Go to polynize.ai, hit Map Your Bottleneck, and in about five minutes you'll see your own business mapped — what stays human, what's hybrid, what an agent can run. Once you see it, you can't unsee it. Link's in the bio.</div>
      <div class="clip" data-clip data-shot="shot14"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 14</div><div class="clip-lbl" onclick="check(event,this)">The CTA</div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot14.filename" placeholder="IMG_1363"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot14.description" placeholder=""></textarea></div></div></div>
    </div>
  </div>

  <div class="setup" data-setup>
    <div class="setup-head" onclick="toggle(this)">
      <div class="setup-num">4</div>
      <div class="setup-title"><div class="t">B-roll — at the wall</div><div class="s">no talking · slow & steady · ~8–10s each</div></div>
      <div class="chev">⌄</div>
    </div>
    <div class="setup-body">
      <div class="do"><div>Silent footage that cuts under the narrative and behind the hooks. Get extra length to trim. At least one connection clearly readable. Still slate each ("shot 15, take 1").</div></div>
      <div class="clip" data-clip data-shot="shot15"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 15</div><div class="clip-lbl" onclick="check(event,this)">Wall pan <small>slow, L→R, a connection readable</small></div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot15.filename" placeholder="IMG_1364"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot15.description" placeholder=""></textarea></div></div></div>
      <div class="clip" data-clip data-shot="shot16"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 16</div><div class="clip-lbl" onclick="check(event,this)">Node close-up <small>single agent sheet</small></div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot16.filename" placeholder="IMG_1365"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot16.description" placeholder=""></textarea></div></div></div>
      <div class="clip" data-clip data-shot="shot17"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 17</div><div class="clip-lbl" onclick="check(event,this)">Connection close-up <small>line / string / arrow</small></div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot17.filename" placeholder="IMG_1366"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot17.description" placeholder=""></textarea></div></div></div>
      <div class="clip" data-clip data-shot="shot18"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 18</div><div class="clip-lbl" onclick="check(event,this)">Hand touching / pointing to a node</div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot18.filename" placeholder="IMG_1367"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot18.description" placeholder=""></textarea></div></div></div>
      <div class="clip" data-clip data-shot="shot19"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 19</div><div class="clip-lbl" onclick="check(event,this)">Wall wide shot <small>the whole board</small></div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot19.filename" placeholder="IMG_1368"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot19.description" placeholder=""></textarea></div></div></div>
    </div>
  </div>

  <div class="setup" data-setup>
    <div class="setup-head" onclick="toggle(this)">
      <div class="setup-num">5</div>
      <div class="setup-title"><div class="t">B-roll — at the desk</div><div class="s">no talking · ~8–10s each</div></div>
      <div class="chev">⌄</div>
    </div>
    <div class="setup-body">
      <div class="clip" data-clip data-shot="shot20"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 20</div><div class="clip-lbl" onclick="check(event,this)">Hands on keyboard <small>close up</small></div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot20.filename" placeholder="IMG_1369"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot20.description" placeholder=""></textarea></div></div></div>
      <div class="clip" data-clip data-shot="shot21"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 21</div><div class="clip-lbl" onclick="check(event,this)">At desk, rear / over-shoulder</div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot21.filename" placeholder="IMG_1370"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot21.description" placeholder=""></textarea></div></div></div>
      <div class="clip" data-clip data-shot="shot22"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 22</div><div class="clip-lbl" onclick="check(event,this)">At desk, front <small>thinking</small></div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot22.filename" placeholder="IMG_1371"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot22.description" placeholder=""></textarea></div></div></div>
      <div class="clip" data-clip data-shot="shot23"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 23</div><div class="clip-lbl" onclick="check(event,this)">Hermes UI screen-rec <small>slow scroll</small></div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot23.filename" placeholder="screen_rec_01"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot23.description" placeholder=""></textarea></div></div></div>
    </div>
  </div>

  <div class="setup" data-setup>
    <div class="setup-head" onclick="toggle(this)">
      <div class="setup-num">6</div>
      <div class="setup-title"><div class="t">Pull existing footage</div><div class="s">not filmed — find & drop in</div></div>
      <div class="chev">⌄</div>
    </div>
    <div class="setup-body">
      <div class="clip" data-clip data-shot="shot24"><div class="clip-head"><div class="box" onclick="check(event,this)"></div><div class="shot-no">SHOT 24</div><div class="clip-lbl" onclick="check(event,this)">OpenClaw / old build footage <small>opens narrative + Story hook</small></div><div class="clip-toggle" onclick="expand(this)">+ clip</div></div><div class="clip-fields"><div class="clip-field"><label>File name(s)</label><input type="text" data-key="shot24.filename" placeholder="existing filenames"></div><div class="clip-field"><label>What's in it</label><textarea rows="2" data-key="shot24.description" placeholder=""></textarea></div></div></div>
    </div>
  </div>

  <div class="after">
    <h2>After the shoot — 10 min while fresh</h2>
    <div class="sub">Don't skip this — it's how the footage becomes usable.</div>
    <div class="chk" data-check="chk.upload" onclick="check(event,this)"><div class="box"></div><div class="lbl">Bulk-upload all clips to the storage folder</div></div>
    <div class="chk" data-check="chk.logged" onclick="check(event,this)"><div class="box"></div><div class="lbl">Filenames + descriptions logged on every shot above</div></div>
    <div class="chk" data-check="chk.continuity" onclick="check(event,this)"><div class="box"></div><div class="lbl">Everything carries today's date / wardrobe / location</div></div>
    <div class="chk" data-check="chk.unscripted" onclick="check(event,this)"><div class="box"></div><div class="lbl">Noted the good unscripted lines <small>what you actually said often beats the script</small></div></div>
    <div class="chk" data-check="chk.pdf" onclick="check(event,this)"><div class="box"></div><div class="lbl">Print this sheet to PDF → upload as the episode record</div></div>
  </div>

  <div class="winbox">
    <div class="h">The real win isn't a finished video</div>
    <p>It's proven footage, real style decisions, and your first true bank entries. If you want, hand-cut <b>one</b> variation (Hook 1 Problem + wall-as-prop) just to see it land.</p>
  </div>

  <button class="reset" onclick="resetChecklist()">reset checklist</button>
</div>

<script>
(function(){
  var clean = location.pathname.replace(/\\/+$/,'');
  var parts = clean.split('/');
  var EPISODE = parts[parts.length-1] || 'ep00';
  var SHOW = parts[parts.length-2] || 'pam';
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
