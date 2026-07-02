# PAM Console — UX Flow Document

**The functional specification for the PAM marketing console.**
**Version 1.0 · July 2026 · Internal · For: the PAM Console build agent · Owner: Marrs Coiro**

---

## How to read this document

This is a **UX and functionality spec, not a UI spec.** It defines *what each screen does, what it needs, how the user moves through it, and how the pieces connect.* It does **not** prescribe visual design — you (the PAM console build agent) own the UI, and you already hold the branding and the design principles of the console. Build the look; this document defines the machine.

Two companion documents sit beside this one:
- **The CC Content-Engine Handoff** (`PAM-CONSOLE-HANDOFF.md`) — the operational build reference: exact tools, the production rules learned in alpha, file realities, MCP wiring. Treat it as the *how-the-plumbing-works* reference. Its findings are **validated alpha results** — a proven starting point to build toward, not immovable law. That build session was an alpha; if a finding doesn't serve the goal now, evolve it.
- **The brand page** (`polynize.ai/brand`) — the live brand source (see §8).

Where this document states a rule about how content is made, that rule is baked into the instruction on purpose. Build to it.

---

## 1. Vision and mandate

The PAM console is the **marketing engine for Polynize** — the central working environment where content goes from an idea to a published, tracked piece across every platform we publish on. It lives on **polynize.ai** (the marketing front-end; client funnels and blueprinting have moved to polynize.io, so polynize.ai is now free to become this).

This is not a nice-to-have tool. It is designed to be **the centre of the company's marketing universe for the long term** — the machine that lets a small team produce content at a scale and consistency that builds a defining voice in the human-centric-AI movement, and that feeds qualified attention into the sales pipeline (Salesforce, where the BD team works). Design it with that ambition: a durable, scalable production system, not a one-off utility.

**What it produces:** the complete content set for a concept — short-form video, medium/long-form video, carousels, written posts, newsletter — per platform, mostly agent-run, with the human at the essential judgement points.

---

## 2. Architectural principles

These shape every screen. Hold them throughout.

1. **Modular, not monolithic.** Every screen and every production stage is a module with a defined job, defined inputs, defined outputs. Build them one at a time; they compose. This is what lets the build be scrappy without painting into a corner. The content pipeline itself is modular in the same way (see §5): a fixed frame with a swappable middle.

2. **Cockpit / engine-room split.** The interface is the **cockpit** — where the human views, edits, approves, and sees state. The agents and backend are the **engine room** — where interviewing, generation, and execution happen. The human sits in the cockpit and walks the process; the agents work below and surface their output to review points. The interface does not try to *be* the editing/generation tools; it *drives* and *reviews* them.

3. **Context-aware embedded chat.** The console has an embedded chat panel so the human never bounces to Slack mid-work. The chat is **aware of the current screen** — on the Treatment Map, it knows you're on the Treatment Map; on the script, it knows the script. The interface state *is* the context the agent works against. (See §6.)

4. **Agent-stack-agnostic — agents are swappable plugs.** The interface is a **fixed socket**; agents plug into it at their stages. Whether an agent runs on Hermes (current) or Agentforce (under evaluation) does not matter to the interface — it connects via whatever API the agent exposes and does its job in that screen's context. Design the connection points as stable interfaces, not as bindings to a specific agent runtime. (See §7.)

5. **Multi-user, single-output.** The console is multi-tenant: users log in with credentials (Marrs and Shourov first, then anyone with a polynize.io email). Each user gets the *same* console, tenanted to their login — not a bespoke build per person. But all owners' work converges on **one shared output calendar and one publishing tail.** Design *for* multi-tenancy from the start (so it isn't retrofitted); *build* Marrs-first, then Shourov. Do **not** build a team-admin / permissions layer first.

6. **Multi-piece, multi-tab workspace.** The console is not a linear wizard walked once. It is a workspace where **several pieces of content are in-flight at once**, each at a different stage, each with its own agent conversation. The human works one piece, and while an agent runs a long step (a render, a generation — often 10-15 minutes), flicks to another tab to advance a different piece. Think IDE or project-management tool, not step-by-step form.

7. **The system captures learnings as reusable rules.** Agent cognition is a *living* document. The production rules in the CC handoff grew as the alpha taught them; the console and the agents should be built to *absorb new rules over time*, not frozen at v1. This is a property to preserve, not a problem to solve.

---

## 3. The three layers

The console is organised into three layers. A user moves between them fluidly; they are not sequential.

- **MANAGE** — the Dashboard. The home. Where you see everything: ideas, in-development pieces, the calendar, the live plan, analytics, and the content-pillar library. (§4)
- **PRODUCE** — the Production Spine. Per-piece. The stage-by-stage journey from concept to published piece. (§5)
- **CONVERSE** — the context-aware chat panel. Always present alongside the other two. How you talk to the agents about whatever you're looking at. (§6)

---

## 4. Layer 1 — the Dashboard (MANAGE)

The management home. The thing that makes this feel like a *system* rather than a set of tools. It answers, at a glance: what are we making, what's in flight, what's going out when, and how is it performing.

### 4.1 Streams (by owner)
The top-level organising structure. Content is organised into **streams by owner/brand**: Marrs, Shourov, Polynize (brand), Team. Each stream is a bucket the user can select into. A user sees the streams they own (and, per the multi-tenant model, the shared brand/team streams as appropriate). Streams make the owner separation visible while everything still flows to one output.

### 4.2 Ideas
Where content ideas are captured and held before they enter production. A user (or an agent) can park an idea here to develop later. This is the front of the funnel for the *content itself* — the raw material that becomes concepts.

### 4.3 In-development
The pieces currently in production — each shown with its current stage in the spine (§5) and its owner. This is the overview of the multi-piece workspace (§ principle 6): every in-flight piece, where it is, what it's waiting on. Selecting one opens its Production Spine.

### 4.4 Content calendar
What's going out, when, and on which platforms. This is the **shared output calendar** — all owners' scheduled pieces converge here (principle 5). It shows volume and cadence across platforms so the team knows how much is publishing where. Publishing is scheduled from here (never blasted; see §5 tail).

### 4.5 Live content marketing plan
A view of the current content marketing plan the team has agreed on — the strategy the production is executing against. Kept live so it's a reference, not a stale doc. (This is agreed with the leadership/marketing team and may evolve; the console surfaces the current version.)

### 4.6 Analytics dashboard (Donnie's realm — first-class, closes the loop)
A **major** part of the dashboard, not an afterthought. Performance per concept, per framing, per format, per platform: what's shared, what's reshared, skip rate, sends-per-reach, retention, and the pipeline metrics (click-through, map completions, newsletter signups, meetings). This is what makes the machine **self-improving** — performance data feeds back and *re-informs the top of the process* (which concepts to mine further, which formats/treatments work). Donnie is the agent that populates this (§7). The analytics layer is the closing of the loop the whole engine depends on.

> **Note:** the analytics feedback loop needs the publishing + analytics legs connected (Blotato, Windsor.ai) — currently **not connected** (see §9 gaps). The dashboard should be built to receive this data; the connection is a separate task and publishing can be manual until it lands.

### 4.7 Content-pillar library (demoted — reference/config, not daily-driver)
A lower-priority section, but a genuinely useful one. A library of the **content pillars**, each with a **blueprint**: what the pillar is, what it does, and exactly how it's produced. Two purposes:
1. **A source of intelligence the agents draw on.** When Mikey produces a piece in a given pillar, it reads that pillar's blueprint to know the production recipe (which format module, which treatment sub-modules, the specifics). The blueprint *is* the pillar's production configuration.
2. **A place to park and develop new pillar ideas.** The owner constantly has ideas for new pillars; this is where they're captured and worked up.

Pillars have two states: **active** (blueprinted, in production) and **developing** (an idea being worked up). A pillar blueprint is essentially: *which format module + which treatment sub-modules + the pillar-specific specifics* — so the library is the recipe book, and the production spine (§5) is the kitchen. Demote it in the layout; it's config and ideation, not the daily driver like the calendar or analytics.

---

## 5. Layer 2 — the Production Spine (PRODUCE)

The per-piece journey from concept to published. This is the core of the console. It is structured as a **fixed frame with a swappable middle** — the key to the whole system's scalability.

### 5.0 The vocabulary (locked — use it consistently)

- **Format** = the *type* of content (short-form video, medium/long-form video, carousel, text post). The level at which the middle of the pipeline **generalises**.
- **Content pillar** = a *specific recurring style within a format* (e.g. "Show and Tell" is a subset of short-form video). Where the middle gets **specific**.
- **Core concept** = the *idea*. The atomic unit. Everything derives from it.
- **Framing** = a specific *angle* on a concept.

Production logic: **core concept → framing → expressed via a content pillar (which sits inside a format) → on a platform.**

### 5.1 The three zones

The pipeline has three zones. **The top and tail are fixed and shared across every format. Only the middle swaps.**

```
  ┌─────────── FIXED TOP (every format inherits) ───────────┐
  Idea → Interview → Core concept doc → Format variations
  └──────────────────────────────────────────────────────────┘
                          ↓ (format selection routes to the right middle module)
  ┌──── SWAPPABLE MIDDLE (this module = short-form video) ────┐
  Script → Treatment Map → Record → Rough cut → Refine edit
        → Treatment execution → Captions → Final approve
  └──────────────────────────────────────────────────────────┘
                          ↓
  ┌─────────── FIXED TAIL (every format inherits) ───────────┐
  Schedule → Publish → Track
  └──────────────────────────────────────────────────────────┘
```

**Nested modularity (build this understanding in):**
- The **middle zone swaps by FORMAT** — short-form video has one middle module; carousel, long-form, and text each have their own. All plug into the same top and tail.
- Within a format's middle, the **Treatment stage swaps by PILLAR** — the treatment recipe (layout, overlays, etc.) is what makes "Show and Tell" different from another short-form pillar.
- This means: build a format's middle module *once*; each new pillar in that format is a light specialisation (mainly its treatment recipe). A format only becomes *selectable* once its middle module exists (containment — see 5.2 Format variations).

### 5.2 The FIXED TOP zone (shared by all formats)

| Stage | Who | Interface or Slack | What it does | In / Out |
|---|---|---|---|---|
| **Idea** | Human | Chat (Slack-like) | The owner surfaces a content idea. Conversational. | → an idea captured |
| **Interview** | Hybrid (April) | **Chat** (this is the defining conversational interaction) | April interviews the owner to mine one concept deeply — the argument, proof, story, contrarian angle, quotable lines. Works from the owner's Personal Brand Voice doc so it mines the *idea*, not the identity. Separate per-owner sessions (Marrs's and Shourov's never cross). | idea → interview transcript |
| **Core concept doc** | Agent | Interface (view / light-edit) | The agent turns the interview into `core-concept-{framing}.md` — the canonical source everything downstream derives from. The human reviews/confirms it. | transcript → approved concept doc |
| **Format variations** | Hybrid | Interface (selection) | The owner selects, from a **finite list**, which format outputs to produce from this concept. The agent can infer/propose from the concept; the owner confirms or directs (e.g. "make this long-form we can cut down," or April asks "record to camera for this or not?"). This selection **routes** which middle modules activate. The list contains only formats whose middle modules have been engineered (containment — no promising outputs the system can't make). | concept doc → selected formats |

The Interview stays a **genuine conversation** (in the embedded chat, §6) — it can't be a form. Everything downstream of the concept doc is where the interface earns its place.

### 5.3 The SWAPPABLE MIDDLE zone — short-form video module

This is the first middle module (proven in alpha). Other formats get their own middle modules built later, plugging into the same top/tail.

| Stage | Who | Interface or Slack | What it does | Notes / alpha findings |
|---|---|---|---|---|
| **Script** | Hybrid | **Interface** (the script/teleprompter screen — a v1 already exists) | Agent drafts the script from the concept doc; the human edits it in the interface. The screen doubles as a **teleprompter** for recording (press to advance section by section). Script + Hook are the *same* interface. | The script is a loose guide — talent ad-libs; the recording is the truth, not the script. |
| **Hooks** | Hybrid | Interface (review/select) + chat (generate) | Generate multiple hook options (visual / verbal / written), the owner selects. Record several, choose the best in the edit. | Part of the same script/teleprompter surface. |
| **Record** | Human | (Neither — physical) | The owner films. The interface's job here is to *hold the teleprompter*. **Delivery method:** record section by section, several takes at different expression levels, not one word-perfect run — reads more naturally and gives editorial choice. One continuous master where possible. | Capture-mode guidance surfaces here. |
| **Rough cut** | Agent | Backend (reports done to interface) | The agent produces the clean cut from the recording. The human isn't watching; the stage just needs to report completion to the interface. | Descript is the cutting engine (see §5.5). |
| **Refine edit** | Human | **Links out to Descript** | The human refines the rough cut — the hands-on editorial adjustment. **This includes the zoom / framing decisions** (done in Descript via camera-zoom keyframes). The agent gives a link to the Descript project; the human opens it and edits there. | This is the stage that most needs the human. Do NOT rebuild an editor in the console — link to Descript, which is where framing/punches happen cleanly. |
| **Treatment Map** | Hybrid | **Interface (key asset — see 5.4)** | Built *after* refine (needs the actual refined transcript, since what's recorded diverges from the script). The full transcript, sentence by sentence, each row a treatment decision + a per-clip generation concept. The human edits it; the agent completes it. | **The single most important production screen. See 5.4.** |
| **Treatment execution** | Agent (+ human review) | Backend execution + interface review | The agent applies the treatment per the Treatment Map: the **treatment sub-modules** (see 5.4.2). The human approves the treated output; the human does not hand-place every overlay. | Additive overlays on the locked spine — proven safe. |
| **Captions** | Agent | **Own final stage** — decision: Descript-native vs internal renderer | Captions go on **LAST** — on top of everything, after all treatment is composited (you can't caption then cover with b-roll). Continuous, top-to-tail, brand-styled. **The only decision at this stage:** send to Descript (which is strong at captions, and the owner has a Descript caption style already) or render internally. May differ by pillar. | Worked out with the agent at the time. |
| **Final approve** | Human | **Interface (the gate)** | The human watches the finished piece and approves it. The editorial gate. | Nothing proceeds without this. |

### 5.4 The Treatment Map (renamed from "EDL" — the key production asset)

The Treatment Map is where the piece's treatment is planned. It replaces what the alpha called an "edit decision list," which was (a) confusingly named and (b) built wrong — it only held sparse snippets the agent chose, in a static timecode table the human couldn't *feel* as video.

**What it must be instead:**
- The **complete transcript, broken sentence by sentence** — every line, in order, top to tail. Not a summary, not selected snippets.
- Each row is **editable** — the human can split a line the agent merged, and type treatment calls and concepts against any line.
- Each row is **playable / scrubbable against the actual footage** — the human decides treatment by *watching the moment*, not reading a timecode. (Skip static thumbnails; the value is seeing the moment play. The owner reads it like a playable script, sectioned top to tail.)
- The human makes treatment decisions per line; the agent completes the sheet. **This is a hybrid stage** — agent proposes a first pass, human shapes it, agent finalises.

**Why it sits after Refine edit:** the Treatment Map is built from the *refined transcript*, because what gets recorded and refined diverges from the script. It must match reality. After any editorial change upstream, the Treatment Map re-anchors to the current transcript.

**Design goal:** make the Treatment Map the *executable object* — editing the map drives the treatment execution. It reads like a playable script and it *is* the build instruction.

#### 5.4.1 The b-roll prompt logic (build this in)
Generating consistent b-roll across clips that each illustrate a different line requires **two prompts combined**:
- **The stylistic master prompt (the constant)** — lives in the brand/style guide (§8). It carries *both* the visual style (a hyperreal, Simon Stälenhag-esque near-future corporate world; muted teal-amber; a recurring metaphor world) *and* the tonal direction: **always slightly exaggerated, slightly satirical, a provocative take** on whatever's being said (not necessarily comedic — satirical is the register). This tonal rule is what makes the b-roll feel like *ours*, not generic illustration.
- **The per-clip concept (the variable)** — lives in the Treatment Map, per row. The specific scene for *this* sentence, tied to its meaning.
- The agent **combines master + per-clip** to generate. Build the "combine these two" step explicitly. (This fixes the alpha's inconsistency, which came from having no fixed master prompt so each generation drifted.)

#### 5.4.2 Treatment sub-modules (what "Treatment" contains)
Treatment is not one thing — it's a container of sub-modules. Which are active, and how, varies by format *and* pillar (this variation is the pillar's fingerprint):

1. **Layout** — chosen *first* because it constrains the rest (e.g. split-screen vs full-screen). For "Show and Tell": split-screen (front camera + overhead, presenter at a touchscreen explaining a diagram).
2. **Overlays** — the richest sub-module, with its own sub-choices: the **type** (one of: generated video b-roll / stock footage / infographic animation / title card), plus positioning, generation, and bundled sound effects (SFX ride with generated video where the generator produces synced audio).
3. **Audio** — music placement, fades, where it beds under vs drops away.
4. **Structural cards** (format-specific) — e.g. long-form: an **episode card** (hook → cut to full-screen episode card → into the episode). Present in long-form, not short-form.
5. *(Captions are their own final stage, §5.3 — not part of this treatment pass.)*

### 5.5 The FIXED TAIL zone (shared by all formats)

| Stage | Who | Interface or Slack | What it does |
|---|---|---|---|
| **Schedule** | Agent (human approves) | Interface | The approved piece is scheduled to the **shared output calendar** (§4.4), per platform. Default: draft/scheduled, never immediate blast. |
| **Publish** | Agent | Backend (gated) | Publishing fires per-format only on explicit human go. One unified publishing tail routes to each owner's separate platform accounts (Marrs: IG/TikTok/LinkedIn/YouTube; Shourov: LinkedIn/+X; brand: LinkedIn/YouTube). |
| **Track** | Agent (Donnie) | Interface (the analytics dashboard, §4.6) | Performance is tracked and fed back to the dashboard, closing the loop. |

The tail is uniform and fully agentic regardless of platform — it's a "go" button plus a dashboard, with the agents executing underneath.

---

## 6. Layer 3 — the context-aware chat panel (CONVERSE)

A persistent chat panel embedded in the console, so the human talks to the agents *without leaving for Slack*. This is the keystone that makes the console cohere into one environment rather than a set of tools plus a separate chat app.

**Core behaviour: it is aware of the current screen.** When the human is on the Treatment Map, the chat knows the context is the Treatment Map ("split that line," "make the overlay at 0:33 a title card instead"). On the script, it drafts and edits the script. On the calendar, it reasons about scheduling. **The interface state is the context the agent works against** — the human doesn't have to describe where they are.

**What it replaces:** the alpha ran through Slack, where the agent didn't know what the human was looking at and everything had to be described. Bouncing between Slack and a UI is the distraction; the embedded, context-aware panel removes it.

**The interaction split (cockpit / engine-room):**
- **Conversational / generative work happens in the chat** — the interview, hook generation, treatment back-and-forth, directing edits.
- **Structured seeing/deciding happens in the interface** — reviewing the concept doc, editing the Treatment Map, approving, scheduling.
- The chat *drives* the interface: an instruction in the chat can change the screen (edit the Treatment Map, update the script). Design the chat as able to *act on* the current screen, not just talk.

**Build note:** the full vision is the chat wired to act across every screen. The *first build* does not need that everywhere — prove the pattern on one screen (the script, or the Treatment Map), then extend. Keep the architecture (context-aware, drives the interface) even in the scrappy first version. Note: the chat is a **thin client onto the agents** — the console is not itself a Claude Code session; CC *builds* the console, it isn't the runtime. Agents connect as plugs (§7).

---

## 7. The agent architecture (swappable plugs into a fixed socket)

Agents are **stage-specialised** and plug into the interface at their stages. The interface is the stable socket; the agents are swappable plugs. This is what makes the console agent-stack-agnostic.

| Agent | Plugs in at | Role |
|---|---|---|
| **April** | Interview / intake (top zone), Treatment Map concept language | Interviews the owner, mines the concept, produces the concept doc. Copy/language/voice specialist. |
| **Mikey** | The middle zone (production) — rough cut, Treatment Map, treatment execution, captions | The production machinery. Drives Descript and the asset generation. |
| **Raph** | The tail (schedule / publish) | Publishing across all accounts via one unified schedule. |
| **Donnie** | The analytics dashboard (§4.6) | Analytics only. Populates the dashboard, closes the feedback loop. |

**Key design requirement:** define each agent's **connection points** (where it plugs in, what it reads, what it writes) as stable interfaces. Whether the agent behind a connection point is a Hermes agent or an Agentforce agent must not matter to the console — it connects via whatever API it exposes. Do **not** bind the console to one agent runtime.

*(Context: the company is evaluating moving from Hermes to Agentforce. The plan is to build the marketing agents in Hermes first, then mirror their function in Agentforce as the real evaluation. The console must support either — hence stable, runtime-agnostic connection points.)*

**Agent-shared storage:** agents read/write shared state (the concept bank, etc.) from a dedicated S3 bucket (`polynize-agents`, prefix-partitioned — e.g. `pam/concept-bank/`). The concept docs April writes and Mikey reads live there. (See the agent-shared-storage decision doc.)

---

## 8. The brand page — a live dependency (build this in)

The console and its agents treat **`polynize.ai/brand`** as a **live dependency, read fresh before every job.** It is simultaneously:
- the human brand guide,
- the central source of truth for the brand,
- and the reference an agent reads *before producing anything* to check for changes.

**Why this matters now:** the brand is mid-redesign. To avoid stagnating, the agents **build to the current brand** and evolve as it evolves — never wait for the new brand, never work from a stale copy. Mikey (and any producing agent) fetches the brand fresh from source each time. The b-roll **stylistic master prompt** (§5.4.1) also lives here (the house visual + tonal style).

Build the brand page as a first-class input the production stages consult, not a static document referenced once.

---

## 9. Honest gaps (things the build agent will need to work out)

Stated plainly so they're planned for, not discovered:

1. **Publishing + analytics legs not connected.** Blotato (publishing) and Windsor.ai (own-performance analytics) are **not wired**. The analytics dashboard (§4.6) and the publish tail (§5.5) should be *built to receive* these, but the connections are separate tasks. Publishing can be **manual** until Blotato is connected. Confirm Blotato can post to each target platform (TikTok specifically was flagged to confirm).
2. **Skip-rate and retention-curve data** are not API-available from the platforms — they're native-dashboard only. The analytics layer will either pull these manually or descope them from v1. A decision for the analytics build.
3. **Which middle modules exist.** Only the **short-form video** middle module is proven (alpha). The medium/long-form video, carousel, and text modules are **not yet built** — they plug into the same top/tail when engineered. The "format variations" list (§5.2) should only offer formats whose middle module exists.
4. **The Treatment Map as an executable, playable-against-footage object** is a new build — the alpha only had the static table. This is a genuine build problem (rendering the transcript sentence-by-sentence, playable per row, editable, driving execution).
5. **Captions decision per pillar** (Descript-native vs internal) is unresolved and worked out with the agent per pillar at the time.
6. **Descript's capabilities at scale.** Descript reliably does the cut and the framing/zoom. It *reports* it can also place b-roll and do captions on the timeline — **unproven at scale.** Test before relying; the current proven division is Descript = cut + framing, our own tooling = asset generation + brand captions.
7. **Multi-tenant depth.** Build Marrs-first, then Shourov, designing *for* multi-tenancy but **not** building the team-admin/permissions layer first.

---

## 10. What is explicitly OUT of scope for this document

- **UI / visual design.** You own it. You have the branding and the console's design principles. This document defines function and flow only.
- **The deep operational plumbing** (exact ffmpeg settings, Descript API specifics, generation model parameters, file paths). That lives in the CC handoff (`PAM-CONSOLE-HANDOFF.md`) — the build reference. Consult it for *how*; this document is *what and why*.
- **The agent runtime decision** (Hermes vs Agentforce). The console is built agnostic to it; the decision is made elsewhere.
- **Perfecting the alpha's long-form piece.** That session was an alpha; its findings are captured. Don't resume it — build the system.

---

## 11. Suggested build sequence (scrappy but modular)

A recommendation, not a mandate — but hold the discipline: **build screen by screen, visible progress fast, modular so nothing needs redesigning later.** Do not spec-and-build the whole console as a monolith before shipping a screen.

1. **The script / teleprompter screen** — already has a v1. Extend it. It's the most-proven, immediately-useful surface, and it makes the system visible fast.
2. **The Treatment Map screen** — the key production asset (§5.4), and the thing the human most needs. The playable-script, editable, sentence-by-sentence build.
3. **The embedded context-aware chat panel** — prove it on one of the above screens, then extend.
4. **The Dashboard shell** — the minimum that lets you start a piece and see it in the in-development list + calendar. Enrich over time (analytics, pillar library later).
5. **The production spine wiring** — connect the stages so a piece flows concept → published, with the agent plugs at their points.
6. **The tail** (schedule/calendar/publish) and **analytics** — as the publishing/analytics connections come online.

Each of these is a module. Build one, prove it, move on. The console **accretes from working pieces** — it is not built all at once.

---

## Appendix — the pipeline at a glance

```
MANAGE (Dashboard)
  Streams(owner) · Ideas · In-development · Calendar · Live plan · Analytics · Pillar library

PRODUCE (Spine) — fixed top → swappable middle (by format) → fixed tail
  TOP:    Idea → Interview → Core concept doc → Format variations
  MIDDLE: Script → Treatment Map → Record → Rough cut → Refine edit
          → Treatment execution → Captions → Final approve
  TAIL:   Schedule → Publish → Track

CONVERSE (Chat) — context-aware of the current screen, drives the interface

AGENTS as plugs: April(intake) · Mikey(production) · Raph(publish) · Donnie(analytics)
Multi-user, single output. Agent-stack-agnostic. Modular. Brand read fresh.
```

---

*Polynize Pty Ltd · PAM Console UX Flow Document v1.0 · July 2026 · Internal*
*Functional spec for the PAM console build. UI is the build agent's to design. Operational detail in the CC handoff. Alpha findings are a proven starting point, evolvable as the goal requires.*
