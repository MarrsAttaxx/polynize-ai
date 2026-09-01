# PAM Console (Marketing Engine) — start here

**For the marketing Build PM (and anyone joining the build).** One entry point. Read this, then the docs below in order.

---

## What we're building, in one paragraph

The PAM Console is becoming Polynize's **marketing engine** — the working environment where a content idea goes from concept to published, tracked pieces across every channel, mostly agent-run with the human at the judgement points. It lives on polynize.ai (client/blueprint work moved to polynize.io). We build it **screen by screen, modular** — one working piece at a time, nothing built as a monolith. CC writes the code; Marrs + the PM steer scope and react to what ships.

---

## Read in this order

**The current-state view, for a marketing lead rather than a builder:**
0. **`marketing-intelligence.md`** *(written 1 September 2026)* — what the console already knows and will make: the five gates, the twenty-post catalogue with what each frame is for, the platform figures with their sources, the writing and image intelligence, how the queue decides when things post, what analytics can and cannot do yet, and the known gaps. Read this before the build docs below, which are older and describe intent rather than what shipped.

**Must read (defines what we're building and the first move):**
1. **`pam-console-ux-flow-v1.0.md`** *(Marrs's source doc — the functional spec)* — what each screen does, the three layers (Dashboard / Production Spine / Chat), the pipeline (fixed top → swappable middle → fixed tail). The north star.
2. **`phase-1-vertical-slice.md`** — the first thing we build (the Script screen + chat + one agent round-trip, short-form) and the **six ordered tickets (T1–T6)**. Plus the concrete **test vehicle** ("Strip the AI out first" → its full derivative set).
3. **`content-format-matrix.md`** — the production surface: owner × channel × format × funnel. Drives what's selectable in the console.

**Reference (the constraints + the plumbing):**
4. **`storage-and-agent-socket.md`** — the load-bearing decisions: no central agent, Supabase + Lightsail-bucket split, the agent socket, `owner_id` day-one, OpenRouter/DeepSeek, and the team roster.
5. **`production-model.md`** — the revised spine (aligned 2026-07-08): the Output-plan step (platforms + formats + ICP), "shoot once, cut many", format-specific treatment, per-stream brand voice, the build order, and the real Descript fixture. **Read before building the middle/output stages.**
6. **`agent-socket-contract.md`** — the concrete plug shape between the console and the agents: the two capabilities (sync `converse`, async jobs), the `AgentProvider` seam, the job lifecycle, the intake interview, and the concept-doc artifact. What April is built against.
6. **`runbooks.md`** — operating the live pieces: the agent-bridge flip/rollback, activation signals, triage, storage backends, and how to add a new user/stream card. Read when operating or debugging, not building.
7. **`figure-medium-research.md`** — research, not yet a decision: is CSS the right material for prezie figures? Checked what Higgsfield's video models and explainer presets actually do, why the div box is the wrong primitive and SVG is already permitted, and how sandboxing removes the JavaScript ceiling. Read before changing how figures are drawn.
8. **`../../asset-kit/PAM-CONSOLE-HANDOFF.md`** — the alpha's operational findings (Descript workflow, the rules, tooling). Skim; consult when we hit production stages.

---

## Where things stand

- **Decisions locked** with Marrs: no central agent (the console is the conductor), Supabase + Lightsail bucket, short-form video first, OpenRouter (DeepSeek default), April interviews in-console (D16).
- **Shipped & deployed:** T2 (Script screen), T3 (teleprompter), T4 (context chat), T6 (LLM → OpenRouter), and the dashboard shell. T1 runs on an interim store (migration `0009` pending creds). See the build-status note in `phase-1-vertical-slice.md`.
- **In flight:** T5 reframed as the **intake screen** (April interviews in-console → concept doc). Dependency-free groundwork underway (socket contract done); the real April round-trip waits on the Master Agent Builder. The `polynize-agents` bucket is provisioned (access keys pending).
- The old blueprint console (EverStock) still lives under the `/console` launcher's "Blueprinting" card; the new marketing work is the "Marketing" card.

## First milestone (Phase 1)

The Script screen slice — see `phase-1-vertical-slice.md`. Proves the whole architecture (cockpit + context-chat + one agent round-trip) on the smallest surface, using the existing "Strip the AI out first" concept. Nothing external blocks it (interim agent runs on the console's own LLM layer).

## What the PM should weigh in on

- The **format matrix** — is the owner × channel × format surface right?
- **Phase-1 scope** — is the Script-screen-first slice the right first ship?
- The **"short-form post"** ambiguity in the test vehicle (text post vs the short-form video).
- Sequencing after Phase 1 (Treatment Map next vs a different priority).

## Who's who (the marketing team)

- **April** — interview / concept / voice (+ team re-voicing, Kit.com newsletter)
- **Mikey** — production (cut, Treatment Map, execution, captions; drives Descript)
- **Raph** — publishing (Blotato)
- **Donnie** — analytics (Windsor.ai)
- **Splinter** — team lead / manager (role in the console TBD)
- **Leo** — leads (a separate system, not part of this content engine)

---

*Drafts, current as of the build kickoff. Push back on anything — these evolve as we build.*
