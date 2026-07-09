# PAM — Decision Log

**What this doc is:** the load-bearing decisions behind PAM, and *why* each is the way it is. These are the things that look arbitrary or "improvable" to someone seeing the code cold — but each is deliberate, and reversing one without understanding it tends to break something. **If a change would contradict a decision here, stop and flag it rather than proceeding.**

Format per entry: the decision, the context that forced it, the rationale, and the consequence if it's violated.

**Last updated:** 2026-06-05

---

## D1 — Strict on generate, liberal on read

**Decision:** The capability-map has two schemas. The **generation** path (website intake) is strict (`capability-map-schema-v05.ts`, enum cluster types, required fields, validated). The **read/render** path (`schema-v2.ts`, `loadBlueprintV2`) is liberal (e.g. `cluster_type: z.string()` free-string), accepting broader real-world vocabulary and normalizing to canonical shapes on read.

**Context:** Generated data should be clean and canonical. But real data — hand-built, or produced by the transform — arrives slightly off-shape (different field vocabulary, string-vs-object arrays, enum values the schema hadn't seen). If the read path is as strict as generation, the Console returns null and the blueprint shows an empty state.

**Rationale:** The render path must *never* break on real data that's slightly off. Generation can afford to be strict because it controls its own output.

**Consequence if violated:** Tightening the read schema to match generation is **the recurring mistake that breaks live blueprints.** It has been tempting several times. Do not do it. If the read path is rejecting valid real data, widen the read path or fix the data — never tighten the read path toward the generation gate.

---

## D2 — Fix the data to canonical, don't widen the schema (for drift)

**Decision:** When transform-produced data fails the read schema, the default is to **normalize the data to the canonical shape** (using a real committed file as the reference), *not* to widen the schema to accept the drift. Widen only for genuinely-valid new vocabulary the schema legitimately should support.

**Context:** The lenient read schema was widened three times to absorb successive emulator outputs. By the third, it was eroding toward "validates nothing." Newkind's emulator produced **83 schema failures** — all of which were *drift* (invented shapes), not valid new vocabulary.

**Rationale:** A schema that accepts anything protects nothing. Drift (e.g. completeness value "DEFINED" instead of the canonical STUB/PARTIAL/COMPLETE, bare-list motion covers, wrong evidence shape) should be corrected in the data, not blessed in the schema. The proven move: classify each failure against a real committed file (EverStock is canonical) — DRIFT → fix the data; GENUINELY-VALID-BUT-UNSUPPORTED → widen.

**Consequence if violated:** Each unprincipled widen moves the schema closer to validating nothing, and the *next* transform drifts further because nothing pushes back. (Counter-example of a *correct* widen: `cluster_type: "parallel"` for reMYnd — a real concept the free-string read path already accepted, so no change was even needed.)

---

## D3 — Give the transform a real file as template, not a described schema

**Decision:** When producing Blueprint JSON via a transform (the manual emulator now, Ben later), feed it an **actual committed example file** as the "match this exact shape" template — not a paraphrased/described schema.

**Context:** Emulator runs given a *described* schema drifted badly (EverStock 26 issues, Newkind 83 issues). The reMYnd run, given a complete real EverStock capability as the literal template plus explicit array-vs-object / enum callouts, came back with **0 issues**.

**Rationale:** A model mimics a concrete example far more reliably than it follows a prose description of a shape. The real file is a hard contract; a description is an invitation to improvise.

**Consequence if violated / why it matters forward:** This is the spec for **Ben's** transform cognition — it must be anchored to the real schema as a contract, not a paraphrase. Ignoring this reintroduces the drift-and-reconcile tax (which cost real time four times over).

---

## D4 — The CWU invariant: every team is three tiers, always

**Decision:** Every engagement's agent team is exactly three tiers: **Human accountable lead → Team leader agent → Worker agents.** The team leader is auto-inserted on every team (an *additional* agent, not a promoted worker), with a standard coordinating/security/liaison role. Enforced at generation (the strict schema requires `team_leader` matching an agent name).

**Context:** The team leader is the connection point between Polynize, the client, and the agent team — the reporting/escalation channel and the security layer (ACTA team-lead role). It's not optional flavour; it's structural.

**Rationale:** Consistency and safety. Every team has a known coordination + escalation + security point. Making it a *required* field in the generation schema means the rule is **self-enforcing at the source** — you cannot generate a valid leaderless team.

**Consequence if violated:** If `team_leader` doesn't exactly match an agent's `name` (case-sensitive), the org chart **silently falls back to two tiers** — the rule is broken with no error. The match is the fragile point; guard it. (Roxbury was the sole grandfathered pre-rule exception, retrofitted with Mable as leader.)

---

## D5 — Readiness is phase-relative, and completeness is provisional

**Decision:** Readiness measures progress through the *current phase's* work (Build → work-plan sprint weighting; Modelling → 0.80 × analysis completeness + 0.20 × blocker resolution). The completeness metric driving Modelling readiness is explicitly a **provisional AI judgment**, marked as such in code.

**Context:** A single readiness formula across phases is meaningless (a Modelling engagement has no sprint; a Build engagement's completeness is settled). And the completeness values were set by the emulator/AI eyeballing "how well could I specify this from the notes" — not measured against a rigorous standard.

**Rationale:** Phase-relative readiness gives an honest signal per phase. Marking completeness provisional prevents false precision — a client reading "44%" shouldn't think it's a measured fact when it's an AI's impression. It becomes rigorous when Cognitive Studio / Ben define and assess against a real "what makes a capability complete" standard.

**Consequence if violated:** Removing the provisional framing creates false precision (the "looks measured, is actually impressionistic" trap). Applying the Modelling formula to a Build engagement (or vice versa) produces a wrong number. The dashboard and blueprint must use **one shared readiness module** — a past bug had two separate calcs giving 40% vs 66% for the same engagement.

---

## D6 — Blockers are the last mile, not the whole of readiness

**Decision:** In Modelling readiness, resolving critical blockers is the final 20%, not the whole. The bulk (80%) is analysis completeness. Blockers are the *closing segment* of the modelling work.

**Context:** A blueprint with full capability mapping but a couple of open blockers is *most* of the way done, not at zero. Treating "blockers resolved" as the whole readiness would read a well-analysed engagement as barely started.

**Rationale:** Mirrors the work-plan weighting logic (front-heavy, light tail). The understanding is the bulk; the last-mile decisions gate sign-off.

**Consequence if violated:** Conflating "blockers" with "all gaps" inflates the blocker count and tanks readiness. The gap-register split (blockers vs in-build) exists precisely to separate the last-mile blockers from the in-build work; only blockers drive the 20%.

---

## D7 — The gap register splits blockers from in-build work

**Decision:** Gaps are split into **Critical Blockers** (gate sign-off) and **Gaps to resolve in build** (real work, not sign-off blockers), via a per-row **Blocking** column (Yes/No). Items aren't deleted when they're "not blockers" — they're reclassified to in-build.

**Context:** The gap register was conflating two things: modelling sign-off blockers vs work to be done during the build. Real build tasks (e.g. "write persona 3 voice doc") were inflating the blocker count.

**Rationale:** Readiness should count only the sign-off blockers. Reclassifying (not deleting) preserves the record while removing build-work from the blocker count. The `blocking` flag is the source of truth; the renderer splits on it.

**Consequence if violated:** A plain `Blocks` column does **not** trigger the split (no substring match with "blocking") — this is intentional so the old column doesn't accidentally activate it. The footer format `**Status:** N gaps open · M blocking sign-off.` must use `·` or `•` as the separator or the parser misses it.

---

## D8 — Never fabricate; mark inferred and provisional

**Decision:** Transform output must trace to real source. Inferred content is flagged (`_inferred` in benchmark text, STUB completeness for under-defined capabilities, empty `evidence` arrays where no real quote exists). A "Real vs Inferred" review note accompanies each build for human eyes — and is **not** committed (it stays with Marrs).

**Context:** Early Roxbury content included CC-fabricated data. The discipline since: a partial-but-honest map beats a complete-but-fabricated one.

**Rationale:** Fabricated specifics ("we know your CAC is $5") are worse than honest gaps ("this benchmark is inferred"). Clients can see these (within-tenant), so honesty is also a posture choice.

**Consequence if violated:** Fabrication erodes trust and produces confidently-wrong blueprints. The subtler form is *false precision* — inventing exactness (a clean percentage, a specific number) where the input was impressionistic.

---

## D9 — Deploy Console before data (when schema changes)

**Decision:** When a change touches both Console code and engagement data, push the **Console first**, poll Vercel to success, *then* push the data. Data-only changes need no ordering.

**Context:** New-shape data read by an old schema fails to parse → the blueprint shows empty state. There's no staging environment to catch this (a known gap).

**Rationale:** The schema that understands the new data must be live before the new data is readable.

**Consequence if violated:** A window where production reads new data against the old schema → broken blueprint. This is a *manual* discipline standing in for a staging environment; it's fragile and depends on remembering it. (See the maturity report — proper staging removes the need.)

---

## D10 — blueprint.md is authoritative over the HTML diagram; only 5 sections render in 2.0

**Decision:** When `blueprint.md` and any HTML diagram diverge, `blueprint.md` wins. In 2.0, only 5 markdown sections render (`infrastructure`, `integrations`, `throughput`, `gap-register`, `sign-off`); the other 1.x sections are ignored and can be removed on migration.

**Context:** Several engagements carried stale 1.x markdown (old agent names, old narratives) in sections that the 2.0 renderer ignores — so they looked stale in the file but didn't render. The summary/capability-map/team now come from JSON.

**Rationale:** One source of truth for the rendered narrative. The dead sections are noise.

**Consequence if violated:** Editing a dead 1.x section and expecting it to render wastes effort (it won't). Conversely, the 5 live sections are the only place narrative edits take effect.

---

## D11 — Client-write paths are narrow, explicit, and unit-tested

**Decision:** Clients are read-only **except** two deliberate write paths: adding/editing-own-open Questions, and filling/signing their own SoW fields. Each is gated to the client's own slug, to the specific action only, and is unit-tested. Every other mutation requires team scope.

**Context:** Until Questions, clients were pure read-only. Opening write access is where access-control bugs live.

**Rationale:** Each new client-write capability is a risk surface; it must be the *narrowest possible* grant (this action, this slug, these fields) and proven by a test matrix, not just UI gating.

**Consequence if violated:** A loosely-built client-write route could let a client mutate things they shouldn't (status changes, other fields, other slugs). The pattern is: a pure, unit-tested authorization function (`authorizeQuestionUpdate`, `authorizeSowFieldEdit`, `authorizeSowSign`) + server-side enforcement, never UI-only.

---

## D12 — A signed SoW locks server-side; unlock clears the signature

**Decision:** Signing locks the SoW; the lock is **enforced server-side** (the field route returns 423 when locked, for client and team). Team can unlock, which **clears the client signature** (re-signing required). Regenerate on a locked SoW is blocked (423).

**Context:** The SoW is a legal agreement clients sign. A "locked" document that's only locked in the UI isn't locked.

**Rationale:** A signature must be invalidated if the document can change after signing — so unlock clears it. The lock must be real (server-enforced), or the API is a bypass. A signed agreement must never be silently overwritten by a regenerate.

**Consequence if violated:** UI-only locking = editable-via-API "locked" docs. Keeping a signature across an unlock-edit = a signature on a document that changed since signing (legally meaningless).

---

## D13 — "Support" stays the defined legal term; "Operate" is the commercial/lifecycle label

**Decision:** The §9.1 fee row and field *labels* use "Operate" (matching the Modelling → Build → Operate lifecycle). The Service Agreement legal clauses (clause 19, Schedules 2 & 4) keep "Support" as the defined legal term. The underlying field keys (`support_fee`, `support_period`) were kept (display relabelled only) so filled data isn't orphaned.

**Context:** "Operate" matches the engagement-phase vocabulary used everywhere else. But "Support" in the clauses is a defined legal term, cross-referenced, in reviewed copy.

**Rationale:** Renaming a defined term across legal clauses needs a legal review (risk of partial matches, broken definition links, changed legal meaning) — not a find-replace. The fee-row label and the legal term can differ for related-but-distinct concepts.

**Consequence if violated:** A blind "support"→"Operate" across the clauses risks an inconsistent/ambiguous signed contract. If the rename is ever wanted, it's a see-the-text-first, legal-eyes task. Renaming the field *keys* (vs just labels) would orphan already-filled data.

---

## D14 — The repos are the source of truth; commits are the write mechanism

**Decision:** Blueprint/SoW/engagement content lives as files in per-engagement GitHub repos, read live by the Console. There is no separate content database; committing to a repo is how content changes.

**Context:** This gives version history, auditability, and a clean contract for the eventual transform engine (Ben) to write into.

**Rationale:** Git is the audit log and the rollback mechanism for content. The Console rendering live from the repo means a push is immediately reflected (pages are `force-dynamic`).

**Consequence if violated:** Introducing a parallel content store without reconciling it to the repos creates two sources of truth. The intended automated future (Ben writing JSON into repos) assumes the repo *is* the destination.

---

## D15 — PAM pivots to a marketing engine; blueprinting moves to Cognitive Studio

**Decision (2026-06):** The PAM Console's primary purpose becomes the **marketing engine**. Capability mapping + blueprinting is being absorbed into **Cognitive Studio on polynize.io**, so PAM no longer owns that workflow long-term. The Console home is now a three-section launcher: **Marketing** (primary, incoming build), **Leads** (the polynize.ai funnel), and **Blueprinting** (legacy).

**Consequences already applied:**
- **Newkind, reMYnd, and Roxbury engagement repos were hard-deleted** (repo + git history) for the SOC 2 audit and because they are no longer active PAM engagements (Roxbury continues as a client, handled outside PAM). This supersedes D4/D12/D14 *for those three engagements only* — their data is gone by design.
- **EverStock is the sole remaining engagement** and stays under Blueprinting (active build). `everstock-build` (no console marker) is untouched.
- `CONSOLE_CLIENTS` fallback reduced to `['everstock']`; dynamic discovery still finds any repo carrying `.polynize/client-config.yaml`.
- Blueprinting disappears once EverStock wraps; Leads will likely change when **Salesforce** becomes the core CRM.

**Open:** the marketing engine's own design (a UX-flow + functional spec) is the next major project and will define that section's shell.

---

## D16 — April interviews in-console, and the agent connection is transport-abstract

**Decision (2026-07):** April's concept-extraction interview runs **inside the console** (the intake screen, top of the production spine), not over Slack. The console always hosts the interview via its own context-chat, calling April through the agent socket (`docs/pam-console/agent-socket-contract.md`). The connection is **transport-abstract**: the console does not know or care what runtime is behind the socket.

**Context:** We are mid **SOC 2 audit** and minimising Slack data flow. The interview — loosely imagined as a Slack surface — needs a home in the console. This also reframes **T5**: it was "the April draft round-trip through the socket"; it becomes "April plugs in at the intake screen and runs the interview → concept doc." Same socket work, now with a screen at the front of the spine (where concepts are *created*, filling the gap the Script screen currently assumes is already filled).

**Rationale:** Keeping the interview in-console keeps sensitive intake data inside the audited surface. Keeping the connection transport-abstract means Slack can be added later as an *additional* surface (post-audit) without a console rebuild — that becomes April's concern, not the console's. The context-chat primitive already shipped on the Script screen (T4) is the right reusable surface for the interview.

**Consequence if violated:** Building the interview against Slack, or hard-wiring a specific agent runtime into the intake screen, reintroduces the Slack data flow the audit is minimising and couples the console to one transport. Do not build console-only assumptions either (no "there is no Slack" logic) — build to the socket, stay agnostic. Sequencing is unchanged: the real April still lands via the Master Agent Builder before the round-trip is live (the interim OpenRouter stand-in fills in until then, per D1).

---

## D17 — Small structured data flows through the job contract; large blobs go direct to storage and return a ref

**Decision (2026-07):** Agents return **small structured results through the job contract** (April returns the concept Markdown on `/api/agents/jobs/[id]/complete`; the console writes it to the bucket). Agents that produce **large binary artifacts write them direct to storage and return a ref** (Mikey's rendered video/b-roll later: upload to the bucket, return the object key on complete). This is **one rule, not two patterns** — the split is driven by payload size, not by which agent it is.

**Context:** April-via-console (markdown through the API) and Mikey-direct-to-S3 (video refs) look like an inconsistency between two agents. They are the same principle applied to different payload sizes.

**Rationale:** The physical reason is you do not pipe gigabytes through a JSON API (request-size limits, function memory, latency). For small data, routing it through the contract keeps the **console the single writer** and lets it enforce owner-partitioning + keying server-side (the agent never needs storage credentials). For large blobs, that round-trip is infeasible, so the agent writes direct and hands back a ref the console records.

**Consequence if violated:** Routing large media through the job API blows request/memory limits. Routing tiny data direct-to-storage would force S3 credentials onto every agent box and lose the server-side owner enforcement the contract provides. When adding an agent, choose the path by artifact size, and keep the console the writer for anything small enough to pass through the contract.

---

## D18 — Metricool replaces Blotato + Windsor.ai (behind an abstraction, gated on a test); Palmier is craft-tier, never in the console

**Decision (2026-07):** The tail zone consolidates onto **Metricool** via its official MCP (`https://ai.metricool.com/mcp`, auth via OAuth or `METRICOOL_USER_TOKEN` + `METRICOOL_USER_ID`): **publishing** (Raph's socket, replacing Blotato) and **analytics** (Donnie's socket, replacing Windsor.ai). One platform, one MCP, one auth. Separately, **Palmier Pro is a craft-tier LOCAL tool and is NOT integrated into the console**; Descript remains the console's cloud editing engine.

**Context:** Both incumbents burned us on specific failures (Blotato publishing; Windsor is generic ETL, not social-native). Metricool does both halves, is social-native (per-post/reel engagement, best-time, competitors), and has a real video/Reels publishing engine. Palmier fixes the Higgsfield round-trip seam-glitches by generating b-roll in-timeline — but its MCP runs on `http://127.0.0.1:19789` (localhost, Mac-only), unreachable from the headless AWS console.

**Rationale + the gate:** Build both legs **behind an abstraction; do not hard-wire until the test passes.** The one risk that decides publishing: Metricool's MCP `post_schedule_post` reportedly sends `providers` as strings (`["linkedin"]`) instead of objects (`[{"network":"linkedin"}]`), so scheduling fails (READ works). **Before committing publishing, run the schedule test:** schedule one real (video/Reel, multi-network) post to a test account and confirm it lands. **Pass → Metricool for both.** **Fail → publishing routes through the Purple Horizons `metricool-cli` (open-source) instead; analytics stays on the MCP (its read side works).** Known analytics gap (not a Metricool fault, do not chase): skip-rate, retention curves, sends-per-reach are platform-native only, out of scope for automated pull. Plan: Metricool **Advanced tier** (~$53-67/mo) powers the API/MCP in production.

**Consequence if violated:** Hard-wiring Metricool publishing before the schedule test repeats the Blotato burn. Wiring **Palmier** into any console stage (Mikey's production socket, Treatment execution) is architecturally impossible from headless AWS — it is Marrs's local craft workflow, never a console backend. Keep the tier split: the console is the **scale tier** (cloud, agentic: Descript + Metricool); Palmier is **craft tier** (local, Mac). Both products are young; re-verify the flagged risks at build time. This is tail-zone work, deferred until Raph/Donnie are provisioned.

**Update (2026-07-09, with Marrs):** The console reaches Metricool via its **REST API with a token**, NOT its MCP. The MCP is built for an AI agent to call tools interactively and needs a login to authorize; the console runs **headless on Vercel**, where an interactively-authed MCP is absent (the alpha's "connectors absent in headless contexts" risk). Calling REST also lets us control the exact payload, which **sidesteps the `providers`-as-strings bug** this decision worried about. Metricool splits accounts by **brand** (Polynize, Marrs Coiro, …), so config is a **per-stream → Metricool brand-id map** (a stream maps to a Metricool brand), not one global id. Env: `METRICOOL_USER_TOKEN`, `METRICOOL_USER_ID`, and a per-stream brand-id map. See **D24** for the full publishing model. (This does not change D18's substance: Metricool is still the tail for publish + analytics, behind an abstraction; only the *interface* to it is REST, not MCP.)

---

## D19 — The Output-plan step is the top→middle pivot; treatment is format-specific; "shoot once, cut many"

**Decision (2026-07-08, aligned with Marrs):** Between the concept doc and the middle module there is a load-bearing **Output-plan** step: the owner selects **platforms + formats + ICP (per output)**. This is not a fan-out convenience — it determines *which* middle modules run **and how the script is written**. Full model in `pam-console/production-model.md`.

- **Unit model:** a concept → one **"production"** that owns (for video) a **single canonical recording** + a set of **format outputs**; each output is a piece running its format-specific module. **Video outputs share the one recording ("shoot once, cut many");** text/image outputs derive from concept + script.
- **Script authoring inputs:** concept + selected formats + ICP + **the stream's brand voice**; the script is the **shot-list** that yields the canonical recording.
- **Treatment is format-specific, NOT format-agnostic** — it lives inside a format's module, post-record. (Supersedes an earlier "format-agnostic treatment map" framing, which was wrong.)
- **v1:** video module wired; other formats selectable but "module coming." The flow must not assume video (most users lean non-video; Marrs is the main video user).

**Consequence if violated:** collapsing Output-plan back into a single "develop into a script" button (the current shortcut) hard-codes short-form video, breaks multi-format + ICP, and mis-authors the script. Building the treatment map as format-agnostic produces a screen that can't actually treat a specific output.

---

## D20 — Brand voice is per-STREAM, editable, referenced on every content creation

**Decision (2026-07-08):** Brand voice is keyed by **stream** (Polynize / Marrs / Shourov / Patricia), not by owner email — a concept is *for* a stream regardless of who is signed in. Each stream's home surfaces its **brand voice + brand guidelines** docs; they are **created via an April interview** and **editable/updatable**. Content creation in a stream (concept synthesis, the interview register, script authoring) reads that stream's brand voice.

- **Polynize** sources its voice from **polynize.ai/brand** (D6, live dependency) if pullable, else a platform copy. **Other streams** get a bucket doc created via April (seed her interview from Marrs's brand-voice master prompt).
- **Refactor note:** the current `getBrandVoice(owner-email)` + `pam/brand-voice-docs/{owner}/` keying moves to per-stream.

**Consequence if violated:** keying brand voice on the signed-in user means a Polynize piece written by any team member gets that person's voice, not the Polynize voice. Voice is the product; it must follow the stream.

---

## D21 — Content pillars are the style layer: pillar → blueprint → treatment; per-stream library; referenced on creation

**Decision (reaffirmed 2026-07-08):** A **content pillar** is a recurring **style within a format** (e.g. "Marrs Attacks", "Show and Tell", podcast). It was always in the spec (`ux-flow-v1.0.md` §4.7 + §5, `content-format-matrix.md`, `pillars` table in `0009`); integrated into the aligned model here. Production logic: **concept → framing → pillar (inside a format) → platform.**

- Each pillar has a **blueprint** = which format module + which treatment sub-modules + the pillar-specific specifics/style. **The Treatment stage swaps by pillar** — the pillar's fingerprint. Build a format's middle module once; a new pillar is a light specialisation (mainly its treatment recipe).
- **Referenced on content creation:** a piece for a pillar follows that pillar's predefined style/format (especially video — the script style + treatment come from the blueprint). So the Output-plan (D19) carries **pillar** alongside format + ICP, and script authoring + treatment read the blueprint.
- **Content-pillar library** is a **per-stream** stream-home core asset (alongside brand voice + guidelines), pillars in `active` / `developing` states. Demoted (config + ideation, not a daily-driver).
- **ICP archetype set** (from the brand-voice builder, `brand-voice-builder-prompt.md`): Organisational Architect · High-Stakes Operator · Revenue Accelerator · Talent Champion · Service Ops Leader (+ custom) — the taxonomy for the Output-plan ICP field.

**Consequence if violated:** ignoring the pillar when creating a piece produces off-style content (wrong treatment recipe, wrong register); the pillar blueprint is the recipe, the production spine is the kitchen. Treatment that doesn't vary by pillar collapses the thing that differentiates the styles.

---

## D22 — The authenticity line: human faces and voices are always real captures

**Decision (2026-07-08, with Marrs):** Polynize's product is amplifying **human** creativity, and the flagship concept is literally "Strip the AI out first." So a hard line on generative media:

- **Any output presenting Marrs or Shourov on camera or as the speaker is a real recorded capture** (footage / voice). No AI avatars, no full cloned-narration presented as them.
- **Generative video is licensed only for:** the b-roll world (the owned satirical "AI look" register on polynize.ai/brand), diagrams, cards/overlays, and an optional **disclosed, faceless** brand-owner explainer format (Polynize stream only, piloted before it earns a module).
- **`shorts_studio` (restyle-to-AI) is rejected for talking-head content** — it converts the authentic recording into an AI render, paying the full shoot cost while destroying the only thing the shoot buys.
- **Voice cloning is narrow:** surgical word/phrase repair inside Marrs's own approved recording (ear-approved), and dubbing/language transfer of finished pieces. Never a full cloned read presented as him.
- **Provenance is tracked:** every output carries a `provenance` marker (`human_capture | ai_generated | hybrid`) so a published piece always knows what it is. Per-piece AI exceptions (e.g. a satirical bit where the AI look *is* the joke) are allowed only when **explicit and disclosed**, never silent.

**Consequence if violated:** an AI-generated Marrs is self-refutation of the brand thesis; blurring human vs AI provenance is a reputational risk the brand cannot afford. This is why the answer to "can we just AI-generate the videos?" is: only the b-roll and the non-video formats, never the human on camera.

---

## D23 — Prove the spine with text first; Descript is orchestrated, not replaced (test-first)

**Decision (2026-07-08, with Marrs):** Reverse the earlier build order. Marrs is the primary user and video is the flagship, but **text is the cheapest way to prove the entire shared spine** (Output-plan step, approve gate, publish/track tail, the output data model) — all of which video also needs. Video adds only the expensive, prerequisite-blocked middle (Treatment Map + Descript orchestration + b-roll) on top of that same spine. So:

- **Build order:** Output-plan step (one-tap confirm) → **one text output module** (concept + script → post copy, one LLM call) → **tail** (manual publish now, Metricool per D18 when creds land) → **then** the video Treatment Map. Video routing to the existing Script screen stays live throughout; video is de-risked, not deprioritized.
- **The disagreement was never text-vs-video** — it was "what proves the shared plumbing fastest." Text has no middle, so it shakes out the skeleton in days without also debugging the Treatment Map.
- **Descript is kept and orchestrated, not routed around.** The alpha's #1 solved time sink was the raw→clean cut, *solved by Descript*; the friction to remove is **iteration latency**, not Descript. Wire Mikey to drive Descript's write surface (`import_media`, `prompt_project_agent`, `publish_project`) so routine cuts/republishes run agent-side, with the Descript UI as the human escape hatch for surgical fixes.
- **Test-first gate (Marrs):** brand fidelity and quality are non-negotiable, so **no reliance on `prompt_project_agent` until one real piece is run through it and Marrs eyeballs the cut + brand adherence.** It is a validated capability, not an assumed one. `explainer_video` (the free assembly/render backend) is likewise proven on one test piece before it becomes the compositor.

**Consequence if violated:** building the video middle before the spine means you debug the tail, the approve gate, the data model, and the Treatment Map all at once, and still cannot publish what you make. Routing around Descript re-opens a solved bottleneck to avoid a friction that is actually review latency.

---

## D24 — Publishing: the console is the hands, Raph is the brains; the calendar is console-owned; per-stream brand mapping

**Decision (2026-07-09, with Marrs):** The publishing tail has two layers, and they stay separate:

- **The brains = Raph (an agent):** the judgment. Which channels, what date, the best times for the audience, per-platform caption wording, and conversational rearranging ("move that to Saturday"). Raph *proposes and adjusts a plan*; he does not hold the Metricool connection.
- **The hands = the console:** once a plan is set, the console makes the actual Metricool REST call (D18 update). The console is the single writer to the outside world (consistent with D3/D17: agents reason, the console executes and holds the creds).

**The calendar is a console-owned surface**, not an agent's. It reads the console's own `calendar_entries` (one row per piece × channel), so the team can see what is coming up **before Metricool is even wired**. Each entry links back to its piece in the console and, once scheduled, out to its post in Metricool (there is no live platform URL until it publishes, so the Metricool link is the pre-live destination).

**Build order (publishing, chosen 2026-07-09):**
1. **Step 1 — console-side, no external dependency (built):** per-platform caption generation (April adapts the approved post per channel) + the calendar view (grouped by date, platform marks, links, manual date-set). Closes the loop visually; usable immediately.
2. **Step 2 — needs Metricool creds:** the console's hands call Metricool's REST API to actually schedule/publish; entries gain their live Metricool link + `external_ref`. Gated on the D18 schedule test (verify the first real post lands).
3. **Step 3 — Raph:** the chat layer that proposes and rearranges the schedule (using Metricool's built-in best-time data), talking to the console which executes.

**Analytics is per stream (feeds the top of the funnel).** Because Metricool splits by brand and each stream maps to a brand, performance data is **per-stream** and belongs on each stream's dashboard (Donnie's read side, D18). The loop back to the top — using what performed to shape the next concept/hook — is a later intelligence layer (it can also draw on the social-intel data source); noted, not built.

**Consequence if violated:** putting the Metricool connection inside an agent (rather than the console) scatters credentials and breaks in headless runs; treating the calendar as an agent surface loses the team's shared window; using one global Metricool brand id posts a stream's content under the wrong brand. Keep brains and hands separate, keep the calendar console-owned, and key the brand per stream.

**Update (2026-07-09, after the first real test):**
- **The queue is console-side.** Metricool's REST API exposes post-create + best-time analytics but **no queue / time-slot / autoschedule endpoint** (confirmed against their docs + the full-coverage CLI). So "Add to queue" is ours: per-stream **ideal time slots + timezone** stored as console config (`posting-schedule.json`), and Add-to-queue appends a post to the next open slot after the last queued one, then schedules it at that concrete time via REST. "Next in the queue, next in the queue."
- **Timezone gotcha:** Metricool's default brand timezone is **Europe/Madrid**; a post sent as 9am Sydney displayed as ~1am. Fix: the console sends each stream's configured timezone (default `Australia/Sydney`), AND the brand's timezone must be set to match in Metricool. Timezone is per-stream config on the Connect screen.
- **Raph is deferred (maybe unneeded).** Because Metricool holds the ideal-time behaviour via the console-side queue, the "schedule at best times / move things around" value Raph would add is largely covered. Marrs's call: do not build Raph now; revisit only if the queue proves insufficient in practice.

---

## How to add to this log

When you make a decision that future-you (or a cold agent) might be tempted to undo, add an entry: the decision, the context that forced it, why, and the consequence of violating it. The bar for inclusion: *would someone seeing this cold reasonably think it's wrong or improvable, when it's actually deliberate?* If yes, it belongs here.

---

## Change log

| Date | Change |
|---|---|
| 2026-06-05 | Initial decision log: D1–D14 captured from the build history. |
| 2026-06-18 | D15: PAM → marketing engine; mapping/blueprinting to Cognitive Studio; Newkind/reMYnd/Roxbury repos hard-deleted (SOC 2 + off-boarding); EverStock retained. |
| 2026-07-03 | D16: April interviews in-console (SOC 2, minimise Slack); T5 reframed as the intake screen; agent connection is transport-abstract. See `pam-console/agent-socket-contract.md`. |
| 2026-07-07 | D17: small structured data flows through the job contract (console is the writer); large blobs go direct to storage and return a ref. One payload-size rule. |
| 2026-07-07 | D18: tail zone consolidates on Metricool (publish + analytics) behind an abstraction, gated on a schedule test (metricool-cli fallback); Palmier is craft-tier local, never in the console; Descript stays. |
| 2026-07-08 | D19: Output-plan step (platforms + formats + ICP) is the top→middle pivot; production owns one recording + many outputs (shoot once, cut many); treatment is format-specific. See `pam-console/production-model.md`. |
| 2026-07-08 | D20: brand voice is per-stream (not per-owner), editable, April-created, referenced on every content creation. |
| 2026-07-08 | D21: content pillars = style layer (pillar→blueprint→treatment-swaps-by-pillar); per-stream pillar library; referenced on creation. ICP archetypes captured. See `brand-voice-builder-prompt.md`. |
| 2026-07-08 | D22: the authenticity line — human faces/voices are always real captures; generative video only for b-roll/diagrams/disclosed-faceless; provenance flag on every output; voice cloning is patch/dub only. |
| 2026-07-08 | D23: prove the spine with text first (Output-plan → text module → tail → then video Treatment Map); Descript is orchestrated not replaced; `prompt_project_agent` + `explainer_video` are test-first (one real piece, Marrs eyeballs brand fidelity, before reliance). |
| 2026-07-09 | D18 update: the console reaches Metricool via REST (token), not the MCP (headless-safe + sidesteps the providers bug); per-stream → Metricool-brand-id mapping. |
| 2026-07-09 | D24: publishing = brains (Raph proposes/rearranges the plan) + hands (console makes the Metricool REST call, holds the creds); the calendar is console-owned (reads calendar_entries, usable pre-Metricool); Step 1 (per-platform copy + calendar view) built; analytics is per-stream. |
| 2026-07-09 | D24 update: Metricool has no queue API, so "Add to queue" is console-side (per-stream ideal-time slots + timezone, next-slot append); timezone gotcha (Metricool defaults to Madrid, set brand tz to Sydney); Raph deferred (queue likely covers his near-term value). Step 2 fully built. |
