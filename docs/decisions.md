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

> **PARTLY SUPERSEDED by D29 (2026-07-21):** the **"shoot once, cut many"** single-shared-recording model below is replaced by two purpose-built hero formats, each with its own capture. The Output-plan step as the top->middle pivot, and format-specific treatment, still stand.

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

## D25 — Content Pillar Templates are the creative loop; concepts are living source documents

**Decision (2026-07-11, with Marrs):** The daily creative loop is: **pick a core concept → pick a Content Pillar Template (CPT) → the console guides you through only what the template can't know → queue.** This extends D19/D21: a CPT *is* a pillar with its blueprint made concrete, and **the template carries the plan** (platforms + format + ICP + register), so selecting one replaces the Output-plan form as the default path (the manual "custom plan" remains as the fallback).

- **A template declares three things:** *what you bring* (inputs, e.g. "the finished episode"), *what you get* (outputs, e.g. "a captioned short with a re-cut hook + first-frame thumbnail"), and *how it's made* (the production recipe / agent instructions, refined run over run — this is what lets agents one-shot the piece). Plus ICP, platforms, an example piece, and a lifecycle status (**active / developing / retired**) driven by real performance: keep what works, kill what flops.
- **Per-stream template library** alongside the brand-voice doc (a stream-home core asset), plus a **built-in starter library** (curated over time, e.g. from what performs on sandcastles.ai) that streams can borrow/copy from. A template shows its example before you commit to it; it doesn't go *active* until one real piece made from it was good.
- **Core concepts are living master documents:** multi-input (interviews, pasted docs, dropped .md files, later images), continually appendable, each feeding many pieces. Console gains (a) an **Import concept** door (paste a .md → concept in a stream) and (b) later an **"Add material"** action (April folds new input into the master doc, keeping a source list).
- **Media library is per-STREAM** (not per-user), like brand voice: a stream's photos/videos (faces for LinkedIn images, b-roll, direct in-console upload of a pillar recording) live with the stream and are drawn on at creation. Banked as the build after templates + living concepts.
- **Fireflies concept extraction is POSTPONED** (client-data security: meeting transcripts hold client-confidential material; keep that in an isolated Claude session for now). Marrs extracts manually → .md → Import. Method + learnings captured in `pam-console/concept-extraction.md`; the in-console design (candidate inbox + editorial charter + human promotion gate) is banked there for later. ICP archetypes not final yet — extracted concepts firm up when they are.

**Consequence if violated:** rebuilding the Output-plan form as the primary path re-introduces per-piece ceremony the template exists to remove; making templates rigid forms (no chat escape hatch) violates the "can't be a form" doctrine; keying the media library per-user splits assets from the stream whose content needs them; wiring Fireflies into the console before the security posture is designed leaks client-confidential context into the content engine.

---

## D26 — April skills placement, "Content Series" rename, and console design principles

**Decision (2026-07-13, with Marrs):**

- **April's hook + curiosity-gap skills live in two places.** The canonical docs are in the repo (`docs/pam-console/april-skills/hook-writing-v1.0.md`, `curiosity-gap.md`) and go to the Master Agent Builder for the real April agent. Because the console runs April's cognition console-side for copy/script tasks (its own prompt with April's key), a **condensed distillation** (`lib/marketing/hook-guidance.ts`) is injected into the script-chat and text-draft prompts so hooks improve now. The full docs are the source of truth; the fragment is kept tight so it does not bloat prompts. Rule of thumb for future April skills: canonical doc in the repo, condensed fragment injected only where that skill is exercised.
- **"Content Pillar" / "Templates" → "Content Series" in the UI.** "Pillar" is jargon; "series" instantly conveys *a recurring set of posts in the same style*. User-facing copy uses **Content Series** (library = the content-series library, each item a series); the internal code identifiers (`template`, `pillar`, `template_ref`, `content-templates/`) are unchanged to avoid a risky rename. Distinct from **stream** (the brand bucket: Polynize / Marrs / …), which keeps its name.
- **Console design principles (now canon):** (1) the per-screen back button (`BackLink`) goes to the PREVIOUS screen, not a fixed destination (fresh deep links fall back to the logical parent); the top nav ("§ PAM control centre") is the way home. (2) **Visual hierarchy**: sections are bordered panels with a clear title, so each block reads as its own unit (Marrs's ADHD-driven, best-practice requirement) — apply on every page. (3) **Light + dark themes**: a cream (not white) light mode toggled top-right and persisted; `--bg` stays dark (it is the ink for text on mint/coral accents, which stays dark in both themes), only neutrals flip. Secondary buttons use a light mint outline that brightens on hover, not a dark border that vanishes on dark bg.

**Consequence if violated:** re-pinning back buttons to fixed destinations reintroduces the "jumps to the top from anywhere" disorientation; dropping the bordered-section hierarchy makes pages hard to parse; changing `--bg` to cream in light mode turns every on-accent label unreadable; renaming the internal `template`/`stream` identifiers is a large, needless refactor (the rename is display-only).

**Amended 2026-07-20 (Marrs):** the UI term reverts from "Content Series" back to **"Content templates"**. "Series" did not hold up conceptually in live use — a template is a *reusable recipe* you mash with a concept, whereas "series" implied a fixed run of episodes. Display strings across the stream page, the template manager, and the concept create/develop flow now read "template(s)". Code identifiers were already `template` / `template_ref` / `content-templates/`, so this remained display-only (no refactor), exactly as the original rename was.

**Also 2026-07-20:** the console back button now shows a second **"Dashboard"** link beside it (in the shared `BackLink`) going to `/console/marketing`, as a reliable "I'm lost, take me home" escape. This does not change principle (1) — the primary Back still steps through history; Dashboard is an explicit, always-present home.

---

## D27 — The media library stores references (Box.com live links / public URLs), not binaries. Amends D2.

**Decision (2026-07-14, with Marrs):** The per-stream media library stores **references** to files hosted on Box.com (or any public direct-download URL), **not uploaded binaries**. The console never handles the bytes: Box holds the file and serves a stable public "Direct Link", and Metricool fetches it by URL at publish time. A media asset is small JSON (`{ url, kind, label, stream, owner }`) that rides the existing bucket-or-interim dispatch, keyed per-stream at `pam/media-library/{stream}/{id}.json` (mirrors the template store). **This amends D2**, which had put heavy media as blobs in the private Lightsail bucket.

- **Why Box, not the Lightsail bucket:** Metricool ingests media by *public URL*. The Lightsail bucket is **private and text-only** (no presigner installed, no binary put), and Vercel's ~4.5MB request-body cap rules out proxying a video upload through a route. Presigned GET URLs would work but **expire** (S3 max 7 days), which breaks posts scheduled further ahead. Box gives large-file upload via its native apps, a stable non-expiring Direct Link (`/shared/static/<hash>.<ext>`), and it is on Marrs's existing **1TB Business account** (2TB/file/month bandwidth; and Metricool downloads the file *once* to re-host on the platform, so shared-link bandwidth is a non-issue). Net effect: the whole binary-storage problem disappears.
- **Data flow:** `piece.media` (asset ids) → `prepare` copies them onto each `CalendarEntry.media` → `publish.resolveMediaUrls(entry.stream, ids)` resolves to current public URLs → Metricool's `media` field (which the client already supported; it was hardcoded empty).
- **v1 is paste-a-link:** add a Box Direct Link (or any public URL) in the stream's Media library; it becomes selectable on the piece screens and rides to the post. **Banked fast-follows:** in-console upload straight to Box (chunked API + downscoped token), and Box-folder auto-sync (a CCG service app listing a folder and auto-creating Direct Links).
- **One empirical gate before trusting video:** Box Direct Links for large video can 302-redirect to `dl.boxcloud.com`; confirm Metricool follows it and ingests the video with one real test post before relying on it.

**Consequence if violated:** routing media back through the private Lightsail bucket reintroduces the presigned-URL-expiry problem (breaks advance-scheduled posts) and the CORS + large-upload problems Box sidesteps; storing bytes in the console at all hits the Vercel body cap; keying the media library per-user instead of per-stream re-splits assets from the stream whose content needs them (violates D25).

---

## D28 — Permissions layer (admin vs user): scoped, DEFERRED

**Decision (2026-07-20, Marrs): capture the intended two-tier model now, build it later.** D4 deferred permissions; Marrs has now articulated the target model but chose to DEFER the build to keep momentum on the video module. Captured here so it is ready and not re-litigated. Nothing was built for it yet (the Move-concept and dev-group Delete controls shipped ungated; they become admin-only when this lands).

- **Two tiers inside 'team':** admin (Marrs) and user (other team members). Determined by an admin-email allowlist (new env, e.g. `CONSOLE_ADMIN_EMAILS`, mirroring `CONSOLE_ALLOWED_EMAILS`). Safe default: if unset, everyone stays admin (today's behaviour), so nothing breaks before it is configured.
- **Admin:** sees and accesses ALL streams; can move concepts, delete concepts, delete dev groups, and edit the global built-in series.
- **User:** sees ONLY Polynize + their own stream (needs an email->stream map, mirroring `CONSOLE_CLIENT_EMAILS`); can create content, copy concepts into their own stream, and edit their own stream's assets; CANNOT move or delete core concepts, delete dev groups, or edit the global built-in series.
- **Editing the built-in series is inherently admin + global.** The built-ins are shared code constants (`lib/marketing/template-library.ts`), so global editing needs an OVERRIDE STORE (persist admin edits that shadow the constants for all streams). Per-stream refine already exists (Copy to this stream -> edit; the stream copy shadows the built-in via the kept `library:{id}`). So global built-in editing ships WITH this layer.
- **Enforcement is server-side, not just hidden UI:** every admin-only action's route must reject non-admins, and stream reads/writes must check the caller's visible streams. Hiding a button is not access control.

**Consequence if violated:** shipping an admin-gated action's UI without the server-side gate leaks it to users; shipping global built-in editing ungated lets any user rewrite shared recipes for everyone (the exact reason it must be admin-only); keying user visibility per-user without the email->stream map has no source of truth.

---

## D29 — Two purpose-built hero formats (9:16 split-screen, 16:9 screen-record). SUPERSEDES "shoot once, cut many" (D19)

**Decision (2026-07-21, Marrs):** Stop deriving short and long form from one canonical 16:9 recording. **"Shoot once, cut many" (D19) is superseded for video:** short and long form are fundamentally different pieces of content, and forcing one capture to serve both is where the friction lives. Instead there are **two purpose-built hero formats**, each with its own capture setup, script shape, and assembly. Lock these two workflows first, then expand. D19's other elements (the Output-plan step as the top->middle pivot, format-specific treatment) still stand; only the shared-single-recording model is replaced.

**The visuals live on the touchscreen, not in post.** The load-bearing insight: instead of generating graphics and compositing them onto video per piece, the **32in touchscreen IS the visual layer**. Marrs interacts with it live and the camera / screen recorder captures it. This converts "make visuals" from a per-video generation problem into a repeatable capture, which is what makes real volume possible off one setup.

- **9:16 Split-screen short (`split_screen_short`) — the HERO, built first.** One setup, two angles: TOP half a mid front shot to camera, BOTTOM half a bird's-eye of the touchscreen. Both halves on screen throughout. Representational visuals only: one big bold idea per beat, readable in a thumbnail, never a bullet slide. Each touch does one legible thing that reinforces the spoken line. 45-75s.
- **16:9 Screen-record long (`screen_record_long`).** Same room, but the screen is captured as a clean SCREEN RECORDING for fidelity. Opens full screen on the presenter, then switches to the screen recording with the head in a PIP circle, cutting to the overhead angle when the physical touch is the point. 4-8 min.
- **The simple vertical stays** (`short_form_video`, relabelled "Short-form video (simple vertical)"): single mobile 9:16, simple cut, music, captions. The everyday lightweight option, not a hero.

**AMENDED 2026-07-21 (same day, Marrs) — the SCRIPT and the TREATMENT are two separate artifacts, and Treatment is a PRE-RECORD stage.** The first cut of this decision put the screen brief inline in the script (`SPOKEN:` / `SCREEN:` per beat). That was wrong for a concrete reason: the teleprompter renders `piece.script` verbatim ([teleprompter/page.tsx](../app/console/marketing/piece/[id]/teleprompter/page.tsx) splits on blank lines and shows every block), so the presenter would be reading screen directions aloud. Marrs caught it. The fix honours BOTH prior positions:
- **The script is SPOKEN-ONLY.** Beat labels + the words. It is a teleprompter document; nothing that is not spoken appears in it.
- **The screen plan is its own artifact** with its own **stage** (`treatment_map`, which already existed in `lib/marketing/stages.ts` between Script and Record, marked "soon" — this fills it in). It is the brief handed to the animation build.
- **Named the SCREEN PROMPT (Marrs, 2026-07-21).** It prompts twice over, which is the point of the name: its cues prompt the presenter's gestures during the take, and it is the prompt the animator builds the HTML page from. Sits naturally beside Script and Teleprompter. Route `piece/[id]/screen-prompt`, LLM delimiter `===SCREEN PROMPT===` (the legacy `===TREATMENT===` spelling is still parsed so an in-flight draft cannot lose its plan). **The stored field stays `piece.treatment`** and the stage id stays `treatment_map`: display-only rename, so already-drafted pieces are not orphaned (same pattern as D26's series/templates rename).
- **It is a full HTML BUILD BRIEF, not a sketch** (Marrs, after the first animator handoff came back "a bit simple"). Every Screen Prompt opens with three global sections — **BUILD BRIEF** (one self-contained HTML page, fullscreen on the 32in touchscreen, one state per beat, gesture-advanced), **DESIGN SYSTEM** (Space Grotesk 700, the real palette, and the tactile depth language: one upper-left light source, three elevations only, raised cards vs recessed wells, decisive motion with no crossfades per the standing no-fades rule), and **OPERATOR STRIP** — then one state per beat carrying six enforced fields: `COMPOSITION` / `TYPE` / `COLOUR` / `MATERIAL` / `MOTION` / `GESTURE` / `CUE`. Loose fields produced thin briefs; naming each one forces specificity.
- **The OPERATOR STRIP is the presenter's own cue line**, rendered by the page itself: pinned to the bottom edge, ~14px uppercase cream at 6-8% opacity, no panel, updated per state, never animated. Legible to Marrs standing over the screen, effectively invisible on camera. Cues are four words or fewer (`TAP CENTRE TO SPLIT`).
- **SAFE AREA is format-specific**, which the 9:16-vs-16:9 capture decision forces: in the split-screen the touchscreen occupies the bottom half of a 1080x1920 frame, i.e. a **1080x960 near-square (9:8)**, so composition must be centre-weighted with nothing important within 12% of the side edges (a full-width 16:9 layout would lose ~37% to letterboxing or be side-cropped); in the 16:9 screen-record the full width is usable, but the PIP corner and the bottom cue strip stay clear.
- **The Screen Prompt is generated on its OWN stage, from the LOCKED SCRIPT plus the operator's DIRECTION** (revised 2026-07-21 after the first real animator handoff). The original design generated both in one pass with the script; in practice that produced briefs that were generic and only loosely tied to the words, because **the screen design is a creative decision the operator owns**. Marrs: "I need this opportunity to talk through what I want the graphics to look like before the prompt gets created." So the flow is: script (fine as is) → Screen Prompt stage, which **starts blank** and carries an April **direction chat** plus a **Generate / Regenerate from script** button. The generation reads the locked script beat by beat, the concept (for facts), the stream brand voice, the operator's direction, and the current brief when regenerating (so a follow-up refines rather than restarts). **The operator's direction WINS** over the model's own ideas; the model fills in only what was left open. `lib/marketing/screen-prompt.ts` + `piece/[id]/screen-prompt/generate`; `draftVideoScript` is script-only again.
- **A state may carry no text at all.** The earlier contract forced exact words on every state; a purely visual moment (three pillars, no caption) is often stronger, especially the opening, so `TYPE: none` is explicitly allowed. Texture is invited too (grain, pixelation, eroded edges, glow), and generated images can be embedded now that the console has image generation.
- **Treatment moves from post-record to PRE-record for these formats.** D19 placed treatment post-record (b-roll/overlays applied to footage) and D21 made the Treatment stage the pillar's fingerprint (naming "split-screen" explicitly). Both still hold, but the touchscreen format changes the timing: the screen visual must be BUILT BEFORE the shoot because the presenter touches it live on camera. It is a prop, not post-production. The separate post-record `treatment` stage (overlays/captions on the footage) remains for what genuinely is post.
- This preserves the standing principle that visual decisions are made at **script time, not discovered at edit time** (the asset-kit lesson: reactive visual decisions cost ~10 iterations). Front-loading is kept; only the artifact boundary changed.

**Scripts are generated as two tracks.** A script for these formats carries, per beat, a `SPOKEN:` line (the words) and a `SCREEN:` line (what is on the screen, the touch interaction, the transition). The SCREEN track is simultaneously the delivery guide, the **brief the animation build works from** (Marrs develops animations in a separate chat from this script), and the instruction for assembly. Implemented as `FormatDef.scriptShape` — the format owns its PHYSICAL output shape (how it is shot/assembled), which is kept separate from a template's recipe (its editorial structure); when present it replaces the default script shape in the draft prompt.

**Assembly (agreed, build after Phase 1):** import the two files from a **local studio folder** (no cloud; Box upload as the backup path for shoots away from the studio); **sync the two angles by audio** (both cameras record the same room sound, so alignment is automatic, no slate needed); **cut** to clean takes in Descript (its proven strength); **composite** the split-screen and the PIP with a **deterministic ffmpeg template** (fixed geometry, exact every time, per the same lesson as the text overlay: precise repeatable layout is a deterministic render, never a hand placement or an AI guess).

**Consequence if violated:** reverting to one shared recording reintroduces the compromise this replaces (a take that serves neither format well); generating and compositing graphics per piece instead of capturing the screen puts the bottleneck back into post and kills the volume this setup exists to produce; putting the format's capture shape into template recipes (instead of `scriptShape`) means every template has to restate the rig and they drift; **putting screen directions back into `piece.script` makes the teleprompter unreadable** (the presenter reads them aloud), and generating the treatment in a second, separate call lets the two artifacts drift out of lockstep.

## D30 — The console BUILDS the touchscreen deck in-house, on an unlisted URL. Replaces D29's animator handoff

**Decision (2026-07-21 to 2026-07-27, Marrs):** The Screen Prompt no longer briefs an external animator. **The console builds the deck itself** and serves it at an unlisted URL the studio machine opens and performs to camera. D29's Screen Prompt stage survives; what it produces changed, from a prose brief handed to a person to a plan the engine realises.

The trigger was pure friction. Marrs: *"I'm having trouble with the process of handing off the animator prompt to the external chat, can we just create the animation file inside this interface somehow instead?"* The handoff cost a round trip per revision, and the first one came back *"a bit simple"* because a brief can only describe a house style, never enforce one.

**The engine owns the look; April only decides content.** [`lib/marketing/deck.ts`](../lib/marketing/deck.ts) holds the entire house style and exports a small class vocabulary (`DECK_VOCABULARY`) that the generation prompt is written against. April picks content, sequence and gesture choreography and nothing else, so **a generated deck is on-brand by construction**. This is the same principle as the deterministic text overlay (D29 change log, 2026-07-21): precise, repeatable visual standards are a render, never a prompt.

- **The store holds STATES, not HTML.** [`deck-store.ts`](../lib/marketing/deck-store.ts) persists the state list at `pam/decks/{pieceId}.json`, and the route renders it through the current engine on every request. Improving the house style therefore upgrades every deck already built, with no regeneration and no LLM spend.
- **Keyed by PIECE ID ALONE**, unlike every other store in PAM, which is owner-scoped. It has to be: the URL is unauthenticated, so there is no owner to scope by at read time.
- **The URL is deliberately UNAUTHENTICATED** ([`app/console/deck/[id]/route.ts`](../app/console/deck/[id]/route.ts)), Marrs's explicit call: *"let's just make it an unlisted link."* The studio machine opens it and performs, with no console login in the shot. The id is a uuid so the link is unguessable, and a deck is pre-publication marketing material. Being a **Route Handler** it bypasses the `/console` layout's sign-in gate, which is what makes this possible inside the console tree at all. `cache-control: no-store`, because the performer may reload mid-shoot.

**The house style is an OSCILLOSCOPE** (Marrs, after developing the direction with April: *"we went with an oscilloscope vibe, make it feel a little oscilloscopic, full screen, like it's feeling vintage"*): a graticule with a brighter centre cross, phosphor persistence trailing the figures, CRT glass curvature and vignette, and corner telemetry readouts (`X-Y 1.00 V/DIV`, `TIME 5 MS/DIV`) so a number on screen reads as instrument output rather than a caption. This replaced the earlier crosshatch-blueprint substrate.

**The animation language is CYMATICS and LISSAJOUS figures**, Marrs's direction, and it carries meaning rather than decoration: a Chladni pattern is what a surface does when it is driven at a new frequency, which is exactly what a gesture does to the deck. Each gesture triggers its own figure, so the transitions ARE the gesture language:

| Gesture | Figure | Meaning |
|---|---|---|
| tap | hard cut | the quiet advance |
| double-tap | a reticle snaps shut | committing to a conclusion |
| swipe-left / right | a Lissajous curve sweeps the frame | advance / go back |
| swipe-up / down | the plate resonates, a Chladni pattern reorganises | a structural shift |
| pinch | concentric rings pull in | narrowing to a detail |

**"Less is more"** (Marrs): the flash lives in the transitions and the hand, not in the states. A state is one idea, huge type, no bullet list.

**A deck is FOUR to SIX states, enforced in CODE and not only in the prompt.** The first real deck came back at **26 pages** because my own instruction said one state per beat and never skip. Marrs: *"the first pass is just way overcomplicated."* The prompt now asks for the four to six turning points the argument actually pivots on, and `generateDeck` additionally slices to `MAX_STATES = 6`. A prompt rule is a preference; a slice is a guarantee.

**The plan is SLIDE CARDS, not prose** (Marrs: the prose brief was *"too, too difficult to read"*). The Screen Prompt stage is two columns: the script split into its sections on the left, and on the right a card per slide carrying **the only two things a human decides, what is on screen and what it says**. Add, edit, reorder, delete by hand, or ask April for a set. Everything technical stays hidden and is applied by the engine. Slides persist as JSON on `piece.slides` ([`lib/marketing/slides.ts`](../lib/marketing/slides.ts)) and are **authoritative over the prose brief** when they exist; `piece.treatment` remains the fallback so older pieces still build. The prose BUILD BRIEF / DESIGN SYSTEM / OPERATOR STRIP preamble that D29 specified was written for the animator and is now vestigial: the engine already knows all of it, and printing it only made the panel unreadable.

**Deck content must never leave the display** (2026-07-27). Marrs shot a deck whose headline was clipped off the top and whose pillars ran past the bottom. The cause was a composition sized from WIDTH (`aspect-ratio` on a width-driven flex child), so a wide screen produced a pillar taller than the viewport. Two rules now: **every dimension that can grow is capped against viewport HEIGHT as well as width**, and the engine **measures each state after render and scales it down if it would still overrun**. The measurement is belt and braces on purpose, because deck content is generated and its size cannot be predicted, and anything spilling off the display ruins a take. Related: a state's label always renders in cream, with the pillar's tint carrying the semantic colour, since a coral label on a coral-washed pillar vanishes on camera.

**Colour is mandatory, not optional** (2026-07-27). The first real deck came back monochrome, because the vocabulary listed `dim` (recede) inside the colour list, so the model read "recede" as an alternative to a colour role and left elements uncoloured. `dim` is a STATE that composes on top of a colour (`class="pillar coral dim"`), and every element that carries meaning takes a role: the problem coral, the tension amber, the proof gold, the resolution mint, held constant across states. A monochrome deck throws away the fastest signal the format has.

**Consequence if violated:** going back to an external handoff reintroduces a round trip per revision and a house style that can only be described and never enforced; storing rendered HTML instead of states freezes every existing deck at the engine version that built it; scoping the store by owner or putting the deck behind the sign-in gate breaks the unlisted URL, which is the whole delivery mechanism; letting the state cap live only in the prompt returns the 26-page deck; and letting a layout size itself from width alone puts content off the edge of the screen, which is only discovered when a take is already ruined.

---

## D31 — The touchscreen is an INTERFACE, not a slide deck. SUPERSEDES D30's slide model

**Decision (2026-07-28, Marrs, after performing the first real deck):** *"We've built it with the concept of slides when it's not supposed to be a slide presentation. It's about navigating around the interactive HTML, not going through a series of slides. It doesn't present right."*

**The reason it does not present right is OBJECT IDENTITY.** A slide deck destroys and recreates: state 2 is a different picture that happens to also contain a pillar. An interface transforms: the *same* pillar moves, grows and opens. An audience reads that difference immediately, because only one of them looks like a thing being operated rather than advanced. No amount of transition polish buys it, since what is missing is the continuity of the object, not the quality of the cut. D30's whole artifact model (states, an index, per-state HTML, gesture-driven advance) is therefore the wrong shape and is superseded.

**A scene is not a list of states.** It is one set of objects that exist for the whole piece and are never rebuilt, plus a view state saying which one is open and what has been revealed on it. `lib/marketing/scene.ts`:

- **CONCEPT** the headline over the board. It recedes when a node opens rather than disappearing, because the board is still there behind what you opened.
- **NODES**, two to four objects side by side. Each has a label, a colour role, a line shown when it opens, and up to four **FACTS** (a label that waits, and a value revealed on touch).
- **CLOSE**, the line worth remembering, raised over the board rather than replacing it.

**Motion is FLIP, and that is the load-bearing technique.** Measure where every object is (First), change the layout class (Last), invert the difference with a transform, release it (Play). The objects are never re-created, so the eye follows one continuous thing instead of seeing a cut to a new picture. Everything else in the engine is in service of that.

**Interaction is direct, not global.** Touching an object opens it; touching a fact reveals it; touching another object in the rail switches straight to it; touching the open object again, or swiping down, closes it. There is no next and no previous. A receded object stays on the board, shrunk and quiet but still touchable, so the set is never lost and switching is one move. Swipe up from the board raises the close line. Number keys, space and arrows do the same things for reviewing a scene in the console without a touchscreen.

**April supplies DATA ONLY** (`SCENE_VOCABULARY`): nodes, colours, lines, facts. No classes, no layout, no markup. The engine owns every pixel and every behaviour. This is what finally makes a generated scene predictable, and it retires a whole class of problems at once: content cannot run off the display, a generated state cannot lay itself out wrongly, and "remove the other pillars' names when one is focused" stops being something to ask for because the engine already does it.

**A NAME IS EARNED, NOT GIVEN** (Marrs, 2026-07-28). The board opens as unnamed shapes. An object's name appears only once the presenter has opened it, and then stays for good, so the board fills in as he works it. Reading all three names before he has said anything gives the argument away; revealing each at the moment he covers it means the audience learns the set from him rather than from the screen. It also gives the board a visible sense of progress, which the operator cue now counts ("2 TO GO").

**The close breaks where it was written to break.** Newlines in `close` are deliberate: it is the one piece of copy whose shape is the point ("Build a human" landing on its own line, "then amplify with AI" underneath), so it is authored, never left to wrapping.

**Content must work in ANY order.** No node may depend on another having been opened first, and no fact may read as "and then". This is a real constraint on the writing, and it is the price of the interface reading as one.

**THE TYPE FLOOR IS ABSOLUTE** (Marrs, 2026-07-28, set by eye against the real cut). The fact VALUES ("HIGH", "DECLINING") are the smallest anything may ever be on this screen, because in a 9:16 split-screen the board occupies half a phone screen. Everything is a deliberate multiple of `--t-floor` so the hierarchy survives at any viewport instead of collapsing into one middling size, and the headline is deliberately exaggerated. The fact LABELS sit AT the floor: their hierarchy against the values comes from weight and colour, never from shrinking them away.

**NO PROSE ON A NODE** (Marrs, 2026-07-28). An open node first carried a sentence explaining it. That is exactly what the presenter SAYS, so the audience was reading what they were being told, and it was the only variable-length element on the panel, which is what crowded the facts: *"we don't need it, that's what's on the script."* Removing it is why the panel now holds only fixed-size elements and fits by construction, and it bought enough room to make the values the biggest thing on the card. **The screen carries the name and the numbers; the explanation lives in the script.** A label is at most three words, a value at most two.

The remaining fit routine is a backstop, not a layout mechanism: it earns its keep only when four facts carry labels long enough to wrap, and it spends the LABELS' headroom down to the floor, never touching a value or a title. If it reaches the floor and still does not fit, the copy is too long, not the layout.

**The clincher is a real control, not a swipe** (Marrs, 2026-07-28). A swipe is invisible: it gave the last move of the piece no affordance on screen and nothing for the presenter's hand to go to on camera. So there is a glowing mint button parked bottom right, present through the whole piece, that lands the closing line. It is UNLABELLED on purpose, so it cannot spoil the line it is about to deliver, and it hides while an object is open, because then the hand belongs on the object.

**The console is wired to it** (2026-07-28). `scene-store.ts` holds the DATA keyed by piece id alone, so the unlisted URL needs no owner and improving the engine lifts every scene already built. `scene-generate.ts` has April read the locked script, the concept and the brand voice and return data: concept, objects, colour roles, facts, close. The caps (4 objects, 4 facts) are enforced in CODE as well as the prompt, per the lesson of the 26-state deck: a prompt rule is a preference, a slice is a guarantee. An unrecognised colour falls back BY POSITION rather than to one default, so a set can never come out monochrome. `/console/scene/[id]` serves it, unauthenticated, exactly as the deck route did.

**The Screen Prompt stage is now a data editor, and that is the point.** It carries the concept line, a card per object (name, colour role, fact rows) and the close. There is nothing about layout, size, motion or gestures, because the engine owns all of it. **Changing a word is TYPING, and costs no LLM call**: under D30 a small fix meant a rebuild that re-decided every state, which is what made minor edits feel impossible ("I need to remove text from certain slides, and I'm not sure how to do that"). April proposes and refines; she is never in the way of an edit. The preview is the real page in an iframe at `?node=N`, not a mock-up, so what is reviewed is what the camera will see.

**The stage is called the INTERFACE** (Marrs, 2026-07-28), renamed from "Screen Prompt", which was itself renamed from "Treatment". The name kept describing a DOCUMENT because that is what the artifact used to be: a prompt written for an animator to build from. It is not a document any more, so: *"screen prompt seems a little weird now, the mental model is this is the interface for this piece of content."* Route `piece/[id]/interface`, and the old path redirects rather than 404s, because the stage gets bookmarked and left open in a tab for days while a piece is in production. **The stage id stays `treatment_map` and the stored field stays `piece.treatment`** through all three renames: display-only, so no piece in flight is orphaned (the same rule as D26's series/templates rename).

**The rename forced the dead deck builders out.** Moving the directory would have created `interface/deck/`, which is actively misleading, and those four unreachable endpoints (`deck`, `deck/revise`, `slides`, `generate`) were the only things keeping `deck-generate.ts`, `deck-revise.ts`, `slides-generate.ts` and `screen-prompt.ts` alive, so all eight are gone. `scriptSections` was the sole surviving export of `slides.ts` and moved to `script-sections.ts`. **The deck PLAYBACK path is deliberately kept**: `deck.ts`, `deck-store.ts` and `/console/deck/[id]` still serve any deck already built, so a deck can still be performed, it just cannot be built. That is the fallback until a piece has been shot with a scene.

**Consequence if violated:** reintroducing an index, a next gesture, or per-state generated HTML brings back the slide deck and with it the thing Marrs saw on camera. Rebuilding objects instead of moving them loses the continuity that is the entire point, however good the transition looks in isolation. Letting April emit markup again puts layout failures and off-screen content back into a generated artifact that nobody reviews until the shoot.

---

## D32 — A piece needs three inputs: the concept, the template, and the ANGLE

**Decision (2026-08-04, Marrs):** Choosing a concept and a template used to create the piece and draft it in the same click. *"The script is way off."* It was, and not because April writes badly: **a concept says what a piece is ABOUT and a template says what SHAPE it takes, and neither says what ARGUMENT it makes or who it is for.** Drafting off the pair is drafting with no editorial intent, so the model has to invent one, and every such draft is generic by construction.

**So the angle is a first-class input, captured before anything is written.** Choosing a template asks one question on its own screen, "What angle do you want to take on this?", and the answer is saved to `piece.angle` before the draft runs.

- **ONE box, not three fields.** The angle, the audience and the rough points arrive in the same breath when a person describes what they want. Splitting them into separate inputs is the form-filling the step exists to remove.
- **It leads the draft message and sits at the TOP of the precedence list** in both prompts, above the concept's own emphasis and above the recipe. It selects and orders what matters; it never licenses a fact the concept does not contain.
- **Copy supplied in the angle is FINAL COPY.** Marrs gave specific hooks and a CTA and the draft wrote its own, because the recipe governs hooks and nothing said otherwise. Lines given in the angle now go in verbatim and beat the recipe, which governs only the shape of what the operator did not write.
- **The angle draft is never lost.** It is mirrored to localStorage per concept+template as it is typed, restored on return, cleared only once a piece exists. Local rather than server-side deliberately: it must survive a failed request and a closed tab, which are exactly the moments a server save would not have happened either. He lost a long angle once; that is one time too many for something that is often the most considered writing in the piece.
- **The angle SEEDS the prezie's narrative** (and scene generation falls back to it), so intent is stated once. On whether the two are the same thing: the **angle** is editorial (which argument, for whom) and the **narrative** is creative (the image that lands it). They arrive together, so they share one input and diverge only if the board later wants a tighter image than the brief had.

**Templates were fighting this, and needed three fixes of their own.**

- **A BUILT-IN BECOMES YOURS THE MOMENT YOU USE IT.** The library lived in a hardcoded array, so the starter templates were permanently unfixable: *"a mess of half-good templates I can't edit"*. Using one now copies it into the stream and the piece references the copy, so refining it afterwards actually affects the next piece.
- **HOOK COUNT IS STRUCTURE, NOT PROSE.** Marrs wrote the hook three times into a recipe and got one hook back, because the prompt is built to produce a single opening and no recipe wording can change the shape of the output. `hook_variants` (clamped 1-6) makes the prompt ask for N genuinely different ways in to the same argument, each with its own on-screen text, over ONE body written once. This is the mechanism behind one-body-three-posts: record every hook in a single session, cut into that many pieces, schedule them days apart.
- **Guidance lives on the templates page**, not in a doc nobody opens: write instructions rather than descriptions, one per line (the fields are injected as separate named sections, so a rule buried mid-paragraph carries less weight), say what NOT to do, and leave specific words to the angle so every piece off a template does not sound the same.

**Consequence if violated:** going back to drafting straight from concept plus template returns the generic first draft, and the fix will look like a prompt problem when it is a missing input. Letting the recipe outrank operator-supplied copy means his own lines get rewritten. Expressing structural asks (how many hooks, how long) as recipe prose means they are silently ignored, which is worse than refusing them.

---

## D33 — A prezie is authored FIGURES, drawn by conversation. Supersedes D31's fixed scene shape

**Decision (2026-08-05, Marrs):** He described, in plain English, a circle with a question mark, a lever whose falling counterweight flings the work out as output, a building that an "AI" box attaches to and then dissolves inside, and a three-column capability matrix filling in a column at a time. He got four coloured pillars with fact rows, and said April was *"using some kind of formula"*.

**She was not. The vocabulary had one sentence in it.** A scene was `nodes[] of {label, colour, facts[]}` and nothing else, so his prompt could only be translated into that. The fault was mine twice: I built the single shape, and I then proposed a fixed set of five "board types" as the fix. That was also wrong, and his very next request proved it: **the space of visual metaphors has no end, so any fixed vocabulary is permanently one metaphor behind the operator.**

**So generated markup returns, having been removed for good reason.** The deck model let April emit HTML and produced layouts that ran off the display and drifted off-brand. But the diagnosis of that failure was wrong: **it was not the freedom, it was the absence of a loop.** A deck generated 26 states blind and the problem was discovered with a camera pointed at it. Marrs: *"she needs to be able to iterate through the process with me."*

The three things that were missing, and are now the design:

- **ONE FIGURE AT A TIME.** A bad turn costs seconds, not a shoot.
- **A LIVE PREVIEW BESIDE A CHAT.** It is seen before it matters. The preview is the real page at `?figure=N`, not a mock-up.
- **HARD BOUNDS THE ENGINE OWNS.** The substrate, the type floor, the colour tokens, the tap mechanism, the frame. A figure supplies only what is inside its own box.

**REVISION IS THE PRIMARY OPERATION, and the brief ACCUMULATES.** Each turn appends to what the figure has been asked to be. Without that, turn three has no idea what turn one wanted and quietly undoes it, which is precisely what makes an iterative loop feel broken.

**The tap contract is CUMULATIVE.** The engine adds `s1`, then `s1 s2`, and so on, so a rule written for the first tap stays true for the rest of the figure and things stay where the presenter put them. `taps` declares how many the figure needs.

**Sanitising is load-bearing, not ceremony.** Figures serve from the unlisted prezie URL, which is unauthenticated by design (D31), so injected script would run for anyone holding the link. Stripped: script, event handlers, `javascript:`, remote urls, `@import`, `position:fixed`, and any rule targeting `html`, `body` or `:root`. Every selector she writes is then prefixed with that figure's own id, so two figures cannot collide and nothing she writes can reach the engine. Tested against adversarial input, which surfaced a real bug: the `:root` strip needed a loop, because removing one rule deletes the brace the next match anchors on and a single pass left every second one behind.

**Both models coexist.** `prezie.figures` renders as a tapped walkthrough through `renderFigureScene`; `prezie.scene` still renders as the open/close board through `renderScene`. Nothing already built changes behaviour, and `isPrezie` accepts either, because requiring a board would have made every figure prezie read as malformed and vanish from the version list.

**On D31's "no next and no previous":** that still holds WITHIN a figure, where objects persist and transform. Moving between figures is a real transition, because they are genuinely different pictures, and his own description is sequential.

**AMENDED 2026-08-05, same day, from Marrs using it: TALK BEFORE DRAWING, and April must know her own ceiling.**

He could not get a seesaw whose falling counterweight flings a ball: *"she's just not good at physics."* She was not refusing. **Nothing in her instructions said where CSS stops**, so she attempted a simulation, shipped a poor version of it, and he paid in wasted turns. `FIGURE_CAPABILITIES` now names both sides plainly: what CSS is genuinely good at (shapes, transforms, staged reveals, type as graphic, simple loops) and what it cannot do and she must never promise (physics, momentum, arbitrary paths, particles, fluid, 3D, illustration). It also gives her the move to make instead: for a lever, do not animate a flying ball, tilt the beam and let the output ARRIVE at scale, which reads as consequence rather than trajectory. **Naming the ceiling is what lets her say "that will look wrong, here is what reads better" instead of quietly failing.**

**And the loop gains a cheap step in front of the expensive one.** Marrs: *"I would like to explain to her what I'm trying to do, and then she explains to me the figure that she can draw. When I agree on it, she draws it."* So the panel is a conversation: he says what he is trying to get across, she proposes two or three concrete options she can actually build, recommends one, and only when they agree does she draw. **Talking costs a sentence and changes nothing; drawing costs a turn.** The disagreement belongs in the cheap step. The agreed conversation is passed in with the ask, so what was settled while talking is what gets built rather than only the last sentence of it. Drawing stays one click away for when he already knows what he wants.

The thread is deliberately client-side and clears when the figure changes: it is a working discussion about one picture, not a record worth keeping once the picture exists.

**Consequence if violated:** going back to a fixed data shape means the operator's next metaphor cannot be expressed and the tool starts dictating the ideas. Generating a whole prezie in one shot brings back the deck's failure whatever the vocabulary. Dropping the accumulating brief turns iteration into a random walk. Relaxing the sanitiser puts executable content on a public URL.

---

## D34 — Figures are drawn in SVG, on one fixed canvas. The div box was the wrong primitive

**Decision (2026-08-06, Marrs):** He asked whether we were using the wrong tool at all: *"Maybe CSS is not the right tool. I know that there's a model in Higgs Field that does graphics beautifully, obviously way better than this and way more accurately."* Research in [`pam-console/figure-medium-research.md`](pam-console/figure-medium-research.md); he chose the SVG change out of it, and it shipped the same day.

**The finding: April was missing her asks because she was drawing with boxes.** Asked for a funnel she returned a stack of narrowing bars, and that was read as her ignoring the brief or "using some kind of formula". **It was neither. A stack of narrowing bars is the only funnel a box model has.** `FIGURE_CAPABILITIES` listed "rectangles, circles, ellipses, triangles" and nothing else, so a picture that is fundamentally an OUTLINE could not be expressed. Rendered both primitives side by side on the same two asks to confirm this rather than assert it.

**And `<svg>` was already permitted.** `sanitiseFigureHtml` has never stripped it. The capability was there the whole time and she was simply never told she had it, which makes this the cheapest large change available: a prompt paragraph, not a rewrite. Every existing figure keeps working, because SVG is additive.

**ONE MANDATED CANVAS: `viewBox="0 0 1000 600"` with `preserveAspectRatio="xMidYMid meet"`.** Not left to her, for three reasons. It roughly matches the shape of the screen the prezie is filmed on, so figures fill the frame instead of letterboxing. `meet` guarantees the whole drawing is visible at any frame size, which retires the entire class of failure where a figure ran off the display. And coordinates become thousandths of the width, so the vh-versus-px question disappears inside the drawing and one legibility floor (32 units) covers every figure. Verified at 1400x800 and at iPhone SE 375x667: complete and legible at both.

**What this actually unlocked, tested end to end:** the lever Marrs was told was impossible. The beam tilts, the load drops, and the output travels along a real bezier arc to land clear. `offset-path` gives motion along an authored curve, which is what was missing when a straight tween read as "a sticker sliding rather than an object being thrown". It is still not simulation, and `FIGURE_CAPABILITIES` says so in those words: nothing collides or transfers momentum, so she must not promise a chain of consequences.

**Three traps are written into the prompt because the end-to-end test hit all three:**

1. **A CSS transform on an SVG element turns about the canvas origin, not the shape.** `transform-box:fill-box` plus `transform-origin` on anything rotated or scaled, every time.
2. **SVG text does not wrap and does not shrink.** A label wider than its shape hangs out of it, which is exactly how the first test render failed. `textLength` with `lengthAdjust="spacingAndGlyphs"` when a label must fit a known width; `dominant-baseline="central"` rather than an eyeballed y offset.
3. **The canvas must be checked AFTER each tap, not only at rest.** A tap that moves something can push it off the edge from a perfectly framed resting state, and that only surfaces in performance. With `offset-path` the path end is the travelling object's CENTRE, so it must be inset by its own radius.

**Ids must now be prefixed, where the old rule banned them.** SVG needs ids for gradients, clip paths, masks and motion paths, and every figure renders into the SAME document, so an unprefixed `id="grad"` in two figures makes both wrong. Class-prefixing already existed; ids join it.

**The sanitiser was hardened in the same commit that opened SVG up**, because telling her to draw with it changes what actually arrives. Added: `<foreignObject>`, which hosts arbitrary HTML inside the SVG namespace and is a standard way to smuggle markup past a filter that only knows about shapes; and remote `href`/`xlink:href` on `<image>`, `<use>` and `<a>`, which would make a figure fetch from the network mid-take. Remote targets are neutralised by renaming the attribute rather than deleting it, so a malformed tag cannot be stitched back together. Same-figure references (`href="#xg-path"`, `url(#xg-grad)`) must survive and are tested for explicitly, since gradients and motion paths depend on them. Ten adversarial cases pass, including the two that must NOT be stripped.

**What was rejected, and why it matters that it was checked:** Higgsfield's 25 explainer presets. Queried live rather than recalled. Generative video holds legible type now, so that objection is dead. But the register is consumer explainer (cartoon fruit, pastel storybook, glassmorphic keynote), and more decisively **those presets make the whole video INSTEAD of the presenter.** His format is him on camera operating a screen; handing the video to a generator does not improve that format, it deletes it. Video keeps a real but narrow role for later: render the before and after states in code and use `start_image` plus `end_image` to interpolate only the motion, so brand and copy stay exact. Its cost is that a clip is a re-roll rather than an edit, which breaks the change-one-thing loop the whole stage is built around.

**The rule this generalises to:** code for anything that must be exact, editable or touchable; generated pixels for anything that must be beautiful, textured or physical.

**Consequence if violated:** going back to box-model drawing reinstates the failure that reads as April ignoring instructions, and the diagnosis will be wrong again. Letting her choose the viewBox brings back off-screen figures and breaks the single legibility floor. Dropping id-prefixing makes two figures on one prezie corrupt each other's gradients, which looks like a rendering bug and is not. Relaxing `foreignObject` puts arbitrary markup on an unauthenticated URL.

---

## D37 — The shoot queue is CROSS-STREAM and grouped by RIG, not by brand

**Decision.** A piece is put in a studio queue with one button on its Script screen or its Prezie stage (both, because a piece with no prezie never visits the Prezie stage, and the Record stage has no screen of its own: it opens the teleprompter), and `/console/studio` is the only thing read in the room: what to shoot, in the order to shoot it. The queue **ignores streams** and **groups by format**, because format is the physical rig. Screen-rig groups come first. Marking a take Recorded advances it to `rough_cut` rather than only removing it from the queue.

**The context that forced it.** Marrs described the whole job in one sentence: *"I can get into the studio, set up the cameras, select one, put the Prezi on the screen, put the text in the teleprompter on the iPad, record it, done, click OK, and go to the next one."* Everything the console already had was organised by brand stream, which is the right shape for editorial work and the wrong shape for a shoot. He had one piece ready in Marrs and others elsewhere, and no view that would put them in front of him together.

**Why cross-stream.** A studio session is one room, not one brand. Grouping by stream would make him tear the lights down and set them up again to shoot the second thing. The stream is still on every row, because it tells him which voice he is speaking in, but it sorts nothing.

**Why grouped by format.** Format determines the rig: `split_screen_short` needs the overhead camera over the 32in touchscreen, a simple vertical needs one camera. Anything with a prezie needs the screen on. So format is the setup, and the groups are the order the room gets rebuilt in. Screen-rig groups sort first so the heaviest setup happens while the room is fresh, and prezie-bearing rows sort first inside a group.

**Recorded advances the stage.** Marrs's call. Leaving a shot piece at `record` would mean footage exists on a card with nothing in the console pointing at it; disappearing it entirely would be worse. `rough_cut` is where the next work actually is.

**Two doors, and the count is on the button.** The Studio is reached from the console home (a card, second after Marketing) and from the marketing dashboard **beside Calendar**, which is where Marrs looked for it: Calendar and Studio are the two things that are about the whole engine rather than one stream, so they belong together. The marketing button carries the queued count, so it says whether a session is worth setting up rather than merely that a studio exists. The count is taken from the pieces that page already loads, so it costs no extra read.

**The QR code is the iPad's way in.** Nothing here can push a URL to another device, and typing a uuid with two cameras waiting is not a workflow, so each row renders a QR of its teleprompter URL, server-side, at request time. It is built from the request's own host so it is correct on localhost, on a preview and on pam.polynize.ai with nothing configured; the `/console/...` path form works on both hosts because the pam rewrite only fires for paths that are not already under `/console`.

**Written in a hurry and worth knowing:** a read is shown in **seconds**, not minutes, because at short-form length every read rounds to "about 1 min" and the number says nothing; over 90 seconds it turns coral, which is a thing to learn before the room is set up rather than after the take. A video format queued with no prezie is flagged on the row for the same reason.

**The QR incident, because the lesson is mine.** I hand-rolled a QR encoder first. It passed every structural test I wrote, including a real spec bug I found and fixed in my own encoder along the way, and jsQR still could not read a single one. Replaced with the `qrcode` package, verified by rasterising the shipped SVG in a real browser and decoding it back to the exact URL. The reason I gave myself for hand-rolling it — that a shoot must not depend on a fetched dependency — was also simply wrong: `qrcode` runs server-side at render time, so nothing is fetched in the studio either way. **A generated code is only tested by a decoder that shares none of your code.**

**Consequence if violated.** Grouping the queue by stream reinstates the rig teardown the grouping exists to prevent. Making Recorded only dequeue loses the footage trail. Encoding a relative path in the QR produces a code that scans and goes nowhere, which fails in the one place there is no time to debug it.

---

## D38 — The CRM IS the leads table. One row per (owner, email), not a second contacts table

**Decision.** `/console/leads` becomes a CRM: a dashboard of five cards (the same five marketing streams) and one contact list per person. It is built by **extending the existing `leads` table**, not by adding a `crm_contacts` table beside it. Uniqueness moves from `email` to `(owner, email)`.

**Why one table.** A website lead has to appear in Polynize's CRM the moment it arrives. With two tables that means a copy, and a copy can disagree: a contact worked for three weeks in the CRM whose lead row still says nothing has happened. The cost is that one table now serves two readers, the CRM UI and the kit.com sync through `/api/leads`, so `synced_at` keeps its exact prior meaning and stays owned by the sync.

**Why (owner, email) and not email.** The old constraint was globally unique on email, which would have meant that once Marrs added a contact, Shourov could not add the same person to his own CRM. Two people legitimately know the same person.

**A plain constraint, not a functional one.** `unique (owner, email)`, not `unique (owner, lower(email))`. An expression index cannot be named as an upsert target through PostgREST's `on_conflict`, so a functional index would have silently broken every upsert including the website capture path. Callers lowercase instead. This was caught by reasoning about the write path before running it, which is the only reason it is not a production bug.

**Owners reuse the marketing stream ids** (`polynize`, `marrs`, `shourov`, `kristin`, `julian`) rather than declaring a second list of the same five people, so the two dashboards cannot drift. The route rejects any owner that is not a real stream, so a typed url cannot open a sixth invisible CRM that accepts contacts nothing will ever display.

**Team-visible, filtered by owner.** Marrs's call. Everyone can open everyone's CRM; each person has their own list. A genuinely private CRM is the first feature that needs the D28 permissions layer, and D28 says build that with the auth layer rather than piecemeal, so it is not half-built here.

**Sorted by what is due, and NOT a kanban.** The obvious build was columns per stage. Columns hide the date, which is the field that actually tells you to act, and they collapse badly on a phone. So the list sorts dated follow-ups first, soonest first, with undated rows falling back to newest first; stage is a control on each row and the stage filter does the job of looking at one column.

**Two details that would otherwise be silent bugs:** a date from a date input is `YYYY-MM-DD`, which Postgres reads as UTC midnight, and in Sydney that is the next morning, so a follow-up set for today would not read as due until tomorrow. Dates are pinned to midday. And moving a contact out of `new` stamps `last_contacted_at` automatically, because otherwise staying honest needs two deliberate edits and the second is the one people skip.

**The pure model is split from the store** (`lib/crm/model.ts` vs `contact-store.ts`) because the CRM's UI needs the stage list and the types, and importing them from the store would have pulled the Supabase service-role client into the browser bundle.

**Fireflies is designed for and NOT built.** D25 postponed automated Fireflies extraction on client-data security grounds. Marrs's ask here is a different purpose, contact capture rather than content mining, and he said to integrate it when needed, so the columns (`fireflies_transcript_id`, `fireflies_url`) exist and the UI renders a transcript link when they are set, but nothing writes them. **Turning it on is a decision that reverses part of D25 and needs Marrs to say so explicitly.** Note also that the Fireflies MCP is not reachable from a Vercel route, so the real integration is the Fireflies API with a key, not the MCP.

**Consequence if violated.** Adding a separate contacts table reintroduces the copy this decision exists to avoid. Restoring a global unique on email silently blocks two people from sharing a contact. Making the unique index functional breaks every upsert including website lead capture, with no error until a lead is lost.

---

## How to add to this log

When you make a decision that future-you (or a cold agent) might be tempted to undo, add an entry: the decision, the context that forced it, why, and the consequence of violating it. The bar for inclusion: *would someone seeing this cold reasonably think it's wrong or improvable, when it's actually deliberate?* If yes, it belongs here.

---

## Change log

| Date | Change |
|---|---|
| 2026-08-12 | THREE FIXES, TWO OF THEM MINE. (1) APRIL WENT SILENT on new concepts. The interview called `complete()` with `maxTokens: 700`, and the production model is a thinking model whose reasoning tokens are MANDATORY, undisableable and counted against max_tokens at roughly 800-950 (established 2026-07-20 when it truncated drafts, which is why the draft ceilings went to 6000/16000). A ceiling below the floor is spent entirely on reasoning and returns an EMPTY STRING, which reads on screen as the agent not answering rather than as an error. The short conversational calls were missed in that earlier fix and my longer interviewer prompt tipped a marginal case over. FIVE calls were under the floor and all are raised: both providers' converse (700), the concept-update chat (700), the media prompt refine (400), the bottleneck probe (200). (2) THE BLUEPRINT LINK 404'd. It was RELATIVE, and on pam.polynize.ai the middleware rewrites any path not already under /console into /console/..., so `/map-your-team/{id}` became `/console/map-your-team/{id}`: a hard 404, verified against production. A blueprint lives on the PUBLIC site, so the url is now absolute to `NEXT_PUBLIC_SITE_URL` and defaults to polynize.ai. Same rewrite trap as the studio QR codes; second time, hence the test asserting the url can never be relative again. (3) IDEAS GET A COMMIT BUTTON. Autosave meant the note being typed stayed pinned at the top as the current idea forever; now the top box is a permanent blank composer that does NOT autosave to the library, and Commit files it below and clears it. Draft text is held in localStorage so a closed tab does not lose an uncommitted thought, and the note is created WITH its text in one call so a commit cannot half-happen and leave a blank behind. |
| 2026-08-12 | (1) THE LEAD'S BLUEPRINT IS LINKED from both the CRM row and the new-lead email (Marrs: "that's important so I can see the blueprint"). Defined once as `blueprintUrl()` because two callers need it and a link that works in one place and 404s in the other is worse than none. FOUND A REAL BUG DOING IT: the email already had a blueprint link and it pointed at `/blueprints/{id}`, which does not serve these rows. A lead's capability blueprint is a `sales_blueprints` row and is served at `/map-your-team/{id}`, so every one of those links would have 404'd. (2) IDEAS: rough notes that come before a concept, at the bottom of the Core concepts panel ("a place under the core concepts, like an idea section"). Deliberately the least structured thing in the console: a text box and a button, no title and no fields, because the moment a note needs either it stops being faster than the phone's notes app and the notes go back to the phone. One JSON file PER STREAM (`pam/ideas/{stream}.json`) so two people in two streams cannot overwrite each other on a read-merge-write. "Create core concept" carries the note INTO the interview by id rather than through the query string (a note runs to paragraphs), and it seeds the INPUT BOX rather than sending it, so he reads it back and edits before April sees it. Unsent text flushes on unmount: this is a notes app and losing a note is the unforgivable bug. Collapsed by default, since half-formed thinking should not be the loudest thing on the stream page. |
| 2026-08-12 | FIREFLIES FILTERS BY WHOSE MEETINGS THEY ARE (my bug, found by Marrs: "Shourov's lead list is pulling my meetings not his"). The scan fetched recent meetings and offered the SAME set to every CRM, so each list showed whatever the API key could see. It does NOT need a key per person, and the live data proved it: the Polynize Weekly Sync came back with shourov@polynize.com as organiser under Marrs's key, so one key already sees the whole team. The fix is to filter on ATTENDANCE (`STREAM_EMAILS` in streams.ts, addresses taken from real attendee lists), checked against meeting_attendees, participants AND the organiser field, because the live data had meetings where only one of those held the address. Applied in the review route, the ACCEPT path (same filter, or a ticked address could be matched against a meeting that person was never in) and the daily digest. POLYNIZE IS DELIBERATELY ABSENT from the map and no longer offers the pull at all: it is the website-inbound CRM and a meeting's contacts belong to whoever was in the meeting. A stream with no address takes no meeting contacts rather than silently falling back to everyone's. Also: the Polynize logo is off the console cards, replaced by a mint dot at half the avatar circle's diameter (Marrs); a stream with no photo now renders that mark instead of an initial letter, and the leads dashboard renders a circle at all where before a missing avatar meant nothing. 31 Fireflies cases pass, including one asserting the old leak. |
| 2026-08-12 | DAILY FIREFLIES DIGEST (`/api/cron/fireflies-digest`, Vercel cron at 21:50 UTC = ~07:50 Sydney). Marrs asked for the pull to be automatic. It deliberately does NOT auto-add: his Fireflies holds personal meetings and no filter can tell one from a sales call, which is the whole reason the review list exists, so the automation is the REMINDER and not the writing. THE TRAP IT AVOIDS: candidates persist until added or dismissed, so a naive daily email would list the same three people every morning until dealt with, which is a notification muted inside a week. Every address mentioned is recorded (`pam/config/crm-digested.json`) and a digest is only sent when at least one address has NEVER been mentioned, so silence genuinely means nothing new. Addresses are only recorded once a send actually succeeded, otherwise a total send failure would mark people as told and they would never be mentioned again. ONE Fireflies call for all five streams, since the meeting list is identical regardless of whose CRM it is offered to. Goes to the Polynize notify list (the only list that exists) as ONE digest naming each person's CRM, one email per recipient so the list is not leaked. AUTH FAILS CLOSED: the route refuses to run when CRON_SECRET is unset rather than defaulting to open, because the alternative is a public endpoint that reads meeting data and sends mail; compared in constant time. The ignore store was generalised into `email-set-store.ts` since the digest needed the identical shape. 12 auth cases pass, including that an unset secret refuses everything. Needs CRON_SECRET in Vercel. |
| 2026-08-12 | CRM tidy + phone (all Marrs's calls). (1) A dismissed Fireflies candidate is REMEMBERED (`pam/config/crm-ignored.json`), because the scan reads the same recent meetings each time so anyone waved away would reappear on the next press and the list would never shorten: that is how a review list becomes something nobody opens. Ignored addresses join the already-a-contact exclusion set, so the pure filter needs no knowledge of either. Only the email is stored, never a reason and nothing from the meeting. (2) Each contact is now its own contained card in the same leathered language as the rest of the console ("each contact needs to be wrapped and contained in its own little section"). (3) The full-width notify bar became an "Add owner" button top-right opening a modal ("Enter your email if you want to know when someone is contacted"), POLYNIZE ONLY per Marrs, since a personal notify list for your own contacts tells you what you already know; the count lives on the button so the page spends no row on a setting changed twice a year. (4) PHONE: `.main` gutters cut from 28px to 16px console-wide (28 each side costs 15% of an iPhone SE), the identity block stacks (four things on one line at 375px is four truncated things), controls go full-width and thumb-sized, and long addresses wrap via `overflow-wrap: anywhere` plus `min-width: 0` on the flex children (a flex item will not shrink below its content without it). VERIFIED programmatically rather than by eye: headless Chrome enforces a ~500px minimum window, so an apparent right-edge bleed in screenshots was the SHOT being cropped and not the CSS; measuring every element against a hard 375px frame with the phone rules active reported everything fitting. |
| 2026-08-12 | FIREFLIES -> CRM, BY REVIEW (partially reverses D25, with Marrs's explicit go). Probing his real account through the MCP before designing changed the plan twice, and both changes are load-bearing. (1) One "Polynize Weekly Sync" carries twelve internal attendees, so an unfiltered pull would have put eleven colleagues in the CRM from a single meeting: a meeting now yields candidates only from EXTERNAL attendees (polynize.io + polynize.com excluded, confirmed by Marrs) and an all-internal meeting yields nothing. (2) His Fireflies also holds PERSONAL meetings, including a medical appointment in the most recent five, and no filter can reliably tell one from a sales call. That is precisely the risk D25 postponed this over, so NOTHING IS WRITTEN AUTOMATICALLY: the GET only proposes, the meeting TITLE is shown against every candidate because that is what a human reads to judge it, and a tick plus Add is required. The review step costs one click and removes the entire class of problem. Also learned from the live data: `displayName` is null on every attendee, so contacts are created with NO NAME rather than one guessed from the address local part. The accept path re-fetches from Fireflies rather than trusting the browser, so only the ticked EMAILS come from the client. GraphQL errors arrive with HTTP 200, so those are checked separately or a mistyped field would look like an empty account; the API's own message is surfaced because a wrong key and no meetings otherwise look identical. Needs FIREFLIES_API_KEY (added). 24 unit cases cover the filtering against the real data shapes, including that a lookalike domain (mail.polynize.io, notpolynize.io) is not treated as internal. |
| 2026-08-12 | CONTENT QUALITY: diagnosed and fixed at the source (`docs/pam-console/content-quality.md` is the full write-up). Marrs: split-screen scripts off the capability-mapping concept were "really bad. The hooks are bad and the beats aren't great." THREE CAUSES, all found in code. (1) `hook-guidance.ts`, distilled under D26 to avoid "bloating" the prompt, had kept every RULE and discarded the entire seven-pattern library and every worked example: exactly the wrong half, since rules compress and examples do not. The canonical doc predicted the failure by name ("A hook like 'This is why capability mapping matters' is dead on arrival") about the very concept in question. Now carries all seven patterns with their model lines, the paired text/verbal example, three real failed hooks with rewrites, and the eight-point gate. (2) ROOT CAUSE: the concept doc captured the ARGUMENT and none of the AMMUNITION. All seven sections were explanatory, the only concrete slot was optional, and the script prompt forbids inventing specifics, so a thin concept produced a generic hook BY DESIGN. Four sections added (What they believe instead / Concrete specifics / What it costs them / Lines worth keeping) and the interview now refuses to finalise without chasing them. (3) "If the concept holds no such number or proof, do not manufacture one" read as permission to be vague; it now names the no-number patterns and says a vague hook fails identically to an invented one. NEW TERM IN THE FORMULA: an exemplar flag on a piece ("This one is good" + a one-line why) injects worked examples into later drafts for the same stream and format, so the definition of good is what Marrs blesses and works from piece one; the analytics loop plugs into the SAME flag later (one definition, two sources of evidence). Few-shot's real hazard is copying material rather than craft, so the block restates the concept's primacy after the examples and gives a self-test. Brand voice: injection now says to imitate any real SENTENCES in the doc and treat adjectives as description, plus an authoring guide in the editor. DEFERRED ON PURPOSE: the model bake-off, because comparing models on a starved prompt measures which one best disguises missing input; and Sandcastles as an external benchmark, whose MCP server is not connected (no data was substituted from my own priors). |
| 2026-08-12 | GENERATED IMAGES ARE HOSTED IN PAM'S OWN BUCKET, not on the Higgsfield CDN (`lib/marketing/image-host.ts` + the unauthenticated `/console/generated/[stream]/[file]` route, same arrangement as the podcast clip media). Marrs reported two errors all week, "The image was created but could not be saved" and "The overlay was created but could not be saved": two messages, ONE cause, `uploadReferenceImage`. Generation and rendering both worked; only hosting failed. The deeper fault was hosting there at all — `POST /files/generate-upload-url` exists so you can hand a reference photo to a generation call, so using it as permanent storage bet every saved image on an AI vendor's file service keeping its shape, its plan allowing it, and the files persisting. This repo has already been bitten three times by Higgsfield endpoints moving (`/v1/text2image/soul` retired, FLUX Kontext 404, the Soul body shape). Higgsfield is now only a fallback for when no bucket is configured. The error text now NAMES the cause (bucket unconfigured vs the actual Higgsfield status code, read off the axios error's `response.status`/`response.data`, neither of which appears in `err.message`) because the old "try again" hid whether it was auth, a moved endpoint or a size limit, which is exactly why it went a week unfixed. NOTE the cause was inferred from the shared code path, not read from a production log. Soul-ID is unaffected: it takes urls, not bytes. |
| 2026-08-12 | CRM step 2 (extends D38): the NEW-LEAD PING and the ENGAGEMENT IMPORT. Recipients are per-stream CONFIG the console edits (`pam/config/crm-notify.json`, same bucket-or-interim dispatch as the Metricool config), not env vars: adding a recipient should not need a redeploy, and I should not be the one typing a colleague's address into a repo. "Is this lead new?" is asked BEFORE the upsert, because an upsert cannot say afterwards whether it inserted or updated, and a returning visitor re-running the blueprint form would otherwise announce themselves as fresh, which is how a notification becomes noise and then gets muted. The ping is AWAITED, not fired and forgotten: on a serverless function the response can end the invocation and kill an unawaited promise, so a background send is one that sometimes silently does not happen; it never throws and the lead is already committed, so awaiting cannot cost the lead. ONE EMAIL PER RECIPIENT, because a shared To: leaks the notify list to everyone on it. The link origin comes from `PAM_CONSOLE_ORIGIN` and not the request, since this fires on a polynize.ai request and the request host would build a link to the wrong site (falls back to the production console). THE ENGAGEMENT IMPORT IS A BUTTON, NOT A MIGRATION: those records are parsed out of client engagement configs rather than a table, so no SQL could move them and a silent import on page load would be invisible and unreviewable. It upserts on (owner, email) so it is safe to run twice, never blanks a field someone has since filled in, puts the engagement's name in `business` rather than inventing a person called EverStock, and NAMES the ones with no email so he can see which need a hand. Polynize only, since offering it on all five CRMs would invite five copies of the same people. |
| 2026-08-12 | D38: THE LEADS SECTION BECOMES A CRM (`/console/leads`), built by EXTENDING the existing `leads` table rather than adding a contacts table beside it, because a website lead must appear in Polynize's CRM immediately and a copy can disagree with the original. Uniqueness moves from `email` to `(owner, email)` so two people can each hold the same contact; the constraint is PLAIN and not `lower(email)` because an expression index cannot be an `on_conflict` target through PostgREST and would have silently broken every upsert including website capture. Owners reuse the five marketing stream ids so the two dashboards cannot drift. Team-visible filtered by owner (Marrs's call; real privacy needs D28). Sorted by what is DUE, deliberately not a kanban: columns hide the date, which is the field that tells you to act. Dates pinned to midday (a bare YYYY-MM-DD is UTC midnight, which in Sydney is the next morning, so "today" would not read as due). Moving out of `new` auto-stamps `last_contacted_at`. Pure model split from the store so the UI does not import the service-role client. Fireflies columns exist but NOTHING writes them: D25 postponed that on client-data security grounds and switching it on needs Marrs's explicit call. Also this pass: the control centre is down to two equal doors (Marketing, Leads) with Studio moved beside Calendar and Blueprinting delisted-but-alive. |
| 2026-08-12 | D37: THE STUDIO SHOOT QUEUE (`/console/studio`). One "Ready to record" button, on the Script screen and the Prezie stage, puts a piece in a cross-stream queue grouped by FORMAT, because format is the rig and a session is one room rather than one brand; screen-rig groups first, prezie-bearing rows first inside a group. Recorded advances the piece to `rough_cut` (Marrs's call) so shot footage still has something in the console pointing at it. Each row carries a server-rendered QR of its teleprompter URL, absolute and built from the request host, because nothing here can push a URL to an iPad and typing a uuid with two cameras waiting is not a workflow. Reads are shown in SECONDS (every short-form read rounds to "about 1 min"), coral over 90s. THE QR LESSON IS MINE: my hand-rolled encoder passed every structural test I wrote and jsQR could not read one code; replaced with the `qrcode` package and verified by rasterising the shipped SVG in a browser and decoding it back to the exact URL. My stated reason for hand-rolling (a shoot must not depend on a fetched dependency) was wrong too, since it runs server-side at render time. A generated code is only tested by a decoder that shares none of your code. |
| 2026-08-10 | D36: A PREZIE CAN BE IMPORTED. Marrs spent a week failing to get April to draw one figure, then one-shot a whole prezie in a chat in an afternoon and liked it: "April can't one-shot for shit." So the console stops trying to be the author. Paste the HTML on the Prezie stage and it is stored, versioned on the concept, and served at the unlisted studio URL. THE DIAGNOSIS, because it is mine: her prompt had grown to 184 lines and ~10KB, since every failure this week was answered with another rule, so "a large pulsating question mark" now competes with a hundred lines about SVG traps, snap controls and canvas checks. SERVED AS ITSELF, NOT WRAPPED, and that was learned by building the wrapper first and testing it: inside the engine's iframe his taps did nothing, while the same click on the file served directly advanced it 01/12 to 02/12, and the engine stacked a second operator cue strip reading "END" over the better one his file already draws. So the only thing added is the TOUCH SOUNDS, injected as a script, capture-phase and passive so they cannot swallow a tap. Security without the iframe: `Content-Security-Policy: sandbox allow-scripts` gives the top-level document an opaque origin, so a document written by a model cannot call /console/... with his session attached; the samples need CORS precisely because that origin is opaque. Also fixed: the engine returned before playing the sound on any figure that owned the screen with no steps left, which would have made an imported prezie silent for its whole performance. |
| 2026-08-10 | D35: FIGURES RUN IN A SANDBOXED IFRAME, so April can write JAVASCRIPT. Marrs after a week on one board: "she can't do one simple fucking thing", and his next question was the right one: "what's the point of your sanitiser if it's stripping us of capability?" The answer is that it was protecting something real with the wrong instrument. Prezies serve from the console's own origin, and although the session cookie is httpOnly, script on that origin can `fetch('/console/...')` and have the browser attach the session for it, so injected script could act as him against his own console. But `sandbox="allow-scripts"` WITHOUT `allow-same-origin` gives each figure an opaque origin, which removes that structurally: verified in a real browser with a hostile probe figure, which reported `cookie THREW: SecurityError | localStorage THREW: SecurityError | parent.document THREW: SecurityError | origin="null" | same-origin fetch BLOCKED`. So the security is now structural and the script ban is gone, along with the CSS stripping (position:fixed is bounded by the iframe, and html/body are the figure's own document). Dragging, real sliders, physics and canvas are all available; a drag was driven end to end to prove it. Selector scoping and id prefixing are also gone, because separate documents cannot collide. Step state crosses by postMessage with a ready handshake (a bare timeout races the iframe's parse), and the shim forwards raw pointer coordinates so all gesture logic stays in one place. THE COST OF GETTING THIS WRONG: I found the sandbox option days earlier and ranked it third behind two nicer features, then spent the week teaching April to work around a ceiling I could have removed on the first day. "Loads nothing from the network" is no longer enforceable by regex once script is allowed, so it moved into the prompt as a rule rather than pretending to be a guarantee. |
| 2026-08-10 | PODCAST CLIP PIPELINE built at `/console/marketing/podcast`: episode in, ranked clip proposals from the validated method, operator approval, Descript cuts. Unlocked by finding Descript's REST API (`descriptapi.com/v1`, `DESCRIPT_API_TOKEN`), since assembly had only ever been driven through the MCP, which the console cannot reach from Vercel. Checked rather than assumed: Descript job states are queued/running/stopped/cancelled and **`stopped` is not success**, the outcome is in `result.status`, so a stopped job with no status is treated as failed. THE VERTICAL PROBLEM WAS SOLVED UPSTREAM BY MARRS, not in software: he exports from Final Cut already 16:9 with both speakers centred, so a centre crop keeps both and speaker tracking (a manual Descript toggle, not exposed to automation) is not needed. That is the `pre_framed` flag, an operator DECLARATION rather than a detection because a landscape frame carries no signal about whether its subjects were placed for a vertical crop; without it the cautious instruction applies and an unfinishable clip is flagged in the UI rather than looking done. Captions and title are part of the cut, per the house craft already written down. Guardrails: proposing again never destroys a decision, paste is first-class alongside the pull, cuts are polled because a job outlives its request, and a failed poll is not a failed job. |
| 2026-08-06 | D34: FIGURES ARE DRAWN IN SVG, on one mandated canvas (`viewBox="0 0 1000 600"`, `meet`). April was missing asks because she was drawing with div boxes: a stack of narrowing bars is the only funnel a box model has, which had been read as her ignoring the brief. `<svg>` was already permitted by the sanitiser and merely never offered, so this is a prompt paragraph rather than a rewrite, and it is additive. Unlocked the lever Marrs was told was impossible (`offset-path` gives motion along an authored curve), tested end to end at desktop and iPhone SE. Three traps written in because the test hit all three: `transform-box:fill-box` or rotations turn about the canvas origin, SVG text neither wraps nor shrinks, and the canvas must be checked after each tap and not only at rest. Ids must now be prefixed (SVG needs them for gradients and motion paths, and all figures share one document). Sanitiser hardened in the same commit: `<foreignObject>` and remote `href`/`xlink:href`, with same-figure refs explicitly tested to survive. Rejected after checking rather than recalling: Higgsfield's explainer presets make the whole video INSTEAD of the presenter. |
| 2026-08-06 | Figure replies moved from JSON to DELIMITED BLOCKS (`---CSS---` / `---HTML---`) after every build failed with "That came back unusable". Cause was JSON.parse rejecting literal newlines in multi-line CSS, which the snap-control pattern made near-certain overnight: the payload is code and JSON was the format least suited to carrying it. The old JSON shape still parses and now repairs raw control characters inside string values, and a failure logs what actually arrived. |
| 2026-08-06 | PER-TASK MODELS. `complete()` takes a `model` per call, and the touchscreen FIGURE work (both drawing and the discussion about what to draw) reads `FIGURE_MODEL`, falling back to the global so nothing moves by accident. Marrs's read was that April's model "is not a coding model", which is right: figures are CSS and markup while the drafting model is chosen for prose and speed. Checked against OpenRouter rather than assumed: `deepseek/deepseek-v4-pro` is both a stronger coding model and far cheaper than `google/gemini-3.5-flash` (0.43 vs 1.50 per million in, 0.87 vs 9.00 out, same 1M context), so quality and cost point the same way. Worth recording honestly that a model swap fixes none of the five prezie failures so far: four were my vocabulary, prompt precedence and renderer bugs, and the fifth (physics) is a limit of CSS itself. What it should improve is the quality of the CSS. |
| 2026-08-05 | D33 amended: TALK BEFORE DRAWING. The prezie panel becomes a conversation (propose two or three buildable options, agree, then draw), because trial-and-error drawing cost a turn per misunderstanding. And `FIGURE_CAPABILITIES` gives April an honest ceiling after she attempted a physics animation nobody had told her CSS cannot do: it names what she draws well, what she must never promise, and what to offer instead. Also fixed the same day: the figure preview opened fully revealed so it showed the END of a figure, and she was treating the concept as a brief to illustrate rather than reference. |
| 2026-08-05 | D33: a prezie becomes authored FIGURES drawn by conversation, superseding D31's single scene shape and replacing the fixed five-figure vocabulary I proposed the day before (his next request already fell outside it). Generated markup returns with the loop that was missing: one figure at a time, a live preview of the real page, an accumulating brief so revisions do not undo each other, a cumulative s1..sN tap contract, and sanitising plus per-figure selector scoping because these serve from an unauthenticated URL. Both models coexist; nothing already built changes. |
| 2026-08-04 | The SHORT-FORM SCRIPT SHAPE is now Marrs's own, taken verbatim from a script he wrote (`docs/pam-console/short-form-script-shape.md`): N hooks separated by `----`, each with paired ON-SCREEN TEXT and SPOKEN lines, then BEAT 1-4 of spoken prose only, then CTA and CLOSE as separate sections. `HOOK_CRAFT` replaces invented hook examples with craft rules read off his three real hooks (withhold the payload, qualify the audience out loud, carry authority, and make the two lines do different jobs). One of the examples it replaces was a draft he had already rejected as a bad hook, which an agent had pulled from the starter library and recommended back to him: exemplars come from approved work, never from generated drafts. Also: concept and piece renaming separated after a piece rename retitled the in-development card (which was labelled with the first piece's title) and the hub's piece list showed the format label instead of the piece name. |
| 2026-08-04 | D32: the ANGLE becomes a first-class input, asked for on its own screen before any draft runs and saved to `piece.angle`; it leads both prompts' precedence and its supplied lines are used verbatim over the recipe. Angle drafts persist locally so they cannot be lost. Templates: built-ins copy into the stream on use (they were unfixable in code), `hook_variants` makes N-hooks-one-body structural rather than recipe prose, and how-to guidance sits on the templates page. Also: prezies belong to the concept with versions, decks retrofit into prezies, touch SFX from Marrs's samples, format icons on template cards, and the stream/dashboard load was parallelised after it took 3-4s to open a stream. |
| 2026-07-28 | The Screen Prompt stage is renamed the INTERFACE (Marrs: the name kept describing a document, and it is not one). Route `piece/[id]/interface` with the old path redirecting; stage id `treatment_map` and field `piece.treatment` unchanged, display-only as with every prior rename. The move also retired the unreachable deck/slides builders and their four lib modules, since leaving them would have created an `interface/deck/` endpoint; deck PLAYBACK (`/console/deck/[id]`) is kept so existing decks still perform. Audio for shoots settled: DJI lapel mics into the FRONT camera, so front-camera audio is the sync source, which is what the test footage already proved. |
| 2026-07-28 | D31 wired into the console: `scene-store.ts` (data keyed by piece id), `scene-generate.ts` (April returns data, caps enforced in code, colour falls back by position so a set is never monochrome), `/console/scene/[id]` unlisted route, and the Screen Prompt stage rebuilt as a scene editor where edits are direct and cost no LLM call. Engine additions the same day, all from Marrs performing it: a type scale with an absolute floor set by the fact values, no prose on a node (it is what he says, and it was the only variable-length element), a glowing clincher button replacing an invisible swipe, names revealed only once an object has been opened, and an authored line break on the close. The deck engine and its URLs stay live until a piece is shot with a scene. |
| 2026-07-28 | D31 SUPERSEDES D30's slide model: the touchscreen is an INTERFACE, not a deck. `lib/marketing/scene.ts` holds one set of persistent objects plus a view state, moved with FLIP so the same object transforms instead of a new picture replacing it. April supplies data only (nodes / colours / lines / facts); the engine owns all layout and behaviour. Touchable example at `/console/scene/demo`. Console rewiring (generation, editor, storage, per-piece route) still to come; the deck engine stays in place until it lands. |
| 2026-07-27 | D30: the console BUILDS the touchscreen deck in-house (`lib/marketing/deck.ts` engine + `deck-generate.ts` + `deck-store.ts` + the unlisted `/console/deck/[id]` Route Handler), replacing D29's external animator handoff. Oscilloscope house style; cymatics/Lissajous figure per gesture; 4-6 states capped in code after a 26-page first pass; the Screen Prompt plan became SLIDE CARDS (visual + text per card, authoritative over the prose brief). Viewport rule added after a clipped deck: cap against viewport HEIGHT, and measure-and-scale each state after render. |
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
| 2026-07-11 | D25: Content Pillar Templates = the creative loop (concept + template → guided completion → queue); template carries the plan (default path; custom remains); per-stream template library + built-in starters; concepts become living master documents (+ Import door); media library per-stream (banked); Fireflies extraction postponed for client-data security (manual Claude-session extraction → Import; method in `concept-extraction.md`). |
| 2026-07-13 | D26: April hook/curiosity-gap skills = canonical docs in repo + condensed injection into console prompts (+ hand to Master Agent Builder); "Content Pillar/Templates" → "Content Series" in UI (code identifiers unchanged); design principles: back button → previous screen, bordered-section visual hierarchy everywhere, cream light theme + dark toggle (--bg stays dark ink). |
| 2026-07-20 | D28: permissions layer (admin vs user) SCOPED but DEFERRED — admin sees all + can move/delete concepts, delete groups, edit global built-in series; users see Polynize + own stream, can copy but not move/delete; editing built-in series needs a global override store; server-side enforcement required. Build with the auth layer, not piecemeal. |
| 2026-07-14 | D27 (amends D2): per-stream media library stores references (Box.com live links / public URLs), not binaries — the console never handles bytes, Box serves the file, Metricool fetches by URL. Media store mirrors the template store (pam/media-library/{stream}/{id}.json); wired into piece production (piece.media → calendar_entries.media → publish resolves to URLs). v1 = paste a Box Direct Link; in-console upload + Box-folder auto-sync banked. Verify Metricool ingests a Box video Direct Link with one real post. |
| 2026-07-20 | Test-feedback fixes (amends D26): UI term "Content Series" → "Content templates" (display-only; reverses the D26 rename); dev-hub "Delete pieces" now deletes ONLY the in-development pieces + their calendar entries, NOT the core concept (the earlier version also called deleteConcept, which destroyed a whole concept — a real data-loss bug; concepts have no versioning so already-deleted ones are unrecoverable); Dashboard link added beside Back everywhere; FLUX Kontext dropped from the Higgsfield model registry (its endpoint 404s — Soul is now the default working model; text-on-image pending a verified FLUX endpoint). |
| 2026-07-20 | Auto-draft on template use (realises D25's "mash the template with the concept"): "Use this template" now generates the first draft in the create/go route — text pieces get a real body, video pieces get a real spoken script (HOOK / BEATs / CTA), both mashing the template recipe + concept + ICP + brand voice via a new shared `lib/marketing/draft.ts` (April's key). Best-effort: a draft failure still creates the piece (manual draft remains). The video Script screen gained a "Draft / Redraft from the concept" button (parity with text; new `script-draft` route). Fixes "it doesn't take the template and mash it with the core concept" and "short-form video generates generic / nothing". |
| 2026-07-21 | D29 assembly PROVEN against real test footage (`docs/pam-console/split-screen-assembly.md`). Rig measured: front = iPhone 17 Pro, overhead = iPhone 13 Pro, both 4K HEVC `rotation=-90` (display 2160x3840 vertical), 25fps, PCM 48kHz stereo. Timecode present but NOT jam-synced, so **audio is the sync source**: cross-correlation found a 383ms offset, corroborated by the 400ms duration difference, no slate needed. The 9:16 capture choice is validated by the maths (a 2160x1920 crop is exactly 9:8, scaling into half a 1080x1920 frame at a clean 2x downsample). **Locked framing: 50/50 split with the overhead crop taking the BOTTOM half of its source, so the display's top edge sits ON the cut line** — Marrs frames it that way deliberately so the content lands just below frame centre and the desk/hands absorb the social UI strip; do NOT centre the display in its half. Full end-to-end render in ~3s. Two measured facts fed back into the Screen Prompt: the whole display is in shot (no crop safe area, my earlier 9:8 derivation was wrong), and the HAND enters from the RIGHT so the payoff belongs left-of-centre and high. |
| 2026-07-21 | D29 amended twice, same day (both from Marrs's live use): (1) the screen plan is a SEPARATE artifact from the script, because the teleprompter renders `piece.script` verbatim and would have had him reading screen directions aloud; script is now spoken-only and the plan got its own PRE-record stage (filling the `treatment_map` slot that already existed between Script and Record). (2) That stage is named the **SCREEN PROMPT** (it prompts the presenter's gestures AND is the animator's build prompt; route `screen-prompt`, delimiter `===SCREEN PROMPT===`, stored field stays `piece.treatment` so drafted pieces are not orphaned), and it became a full **HTML build brief**: global BUILD BRIEF + DESIGN SYSTEM (tactile depth language, real palette, Space Grotesk, decisive motion) + OPERATOR STRIP (the presenter's faint bottom-edge gesture cue, ~14px cream at 6-8% opacity, invisible on camera), then six enforced fields per state (COMPOSITION/TYPE/COLOUR/MATERIAL/MOTION/GESTURE/CUE). Safe area is format-specific (split-screen bottom half = 1080x960 near-square 9:8, centre-weighted; 16:9 full width, PIP corner clear). Capture decision: shoot BOTH angles 9:16 framed-as-final (each half only needs 1080x960, so iPhone 4K vertical oversamples 2x; monitoring + deterministic post beat the marginal sensor gain), framing ~10-15% wide for latitude. Video draft ceiling 16000. |
| 2026-07-21 | D29 (SUPERSEDES D19's "shoot once, cut many"): two purpose-built hero video formats instead of one shared 16:9 recording — **9:16 split-screen** (`split_screen_short`, HERO, built first: front mid-shot top half + bird's-eye of the 32in touchscreen bottom half, 45-75s) and **16:9 screen-record** (`screen_record_long`: full-screen intro then screen recording with a PIP head, overhead when the touch is the point, 4-8 min). The touchscreen IS the visual layer (captured live, not composited per piece) which is what unlocks volume off one setup. Scripts are now TWO-TRACK (`SPOKEN:` + `SCREEN:` per beat) via the new `FormatDef.scriptShape` (format owns the physical shape; template recipes stay editorial); the SCREEN track doubles as the animation-build brief. Simple vertical kept as the lightweight option. Starter templates added: "Concept flip (split-screen short)" + "Walkthrough (screen-record long)". Assembly agreed for the next phase: local studio folder import (Box as backup), automatic audio sync, Descript cut, deterministic ffmpeg composite. |
| 2026-07-21 | Brand-standard text-on-image = DETERMINISTIC render, not the AI model. Lesson from live use: AI image models can't hit an exact font/colour/justification or highlight specific words. So brand text overlays are composited in code via `next/og` (Satori): fixed Space Grotesk 700 (fetched from jsdelivr, cached) + legibility shadow + centre justify; variable text, position (top/centre/bottom), base + highlight colours (defaults #ffffff / #69fccb mint), `*asterisk*`-highlighted words, line-break wrapping. `lib/marketing/text-overlay.tsx` + `media/overlay` route + `MediaTextOverlay` panel; output PNG hosted on the Higgsfield CDN; source dims via the new `image-size` dep. Visually verified in prod (pixel-perfect, CEO in mint). Separate from the AI "Edit an image" panel (kept for restyle). Rule: any precise text-on-media is a deterministic render, never an AI prompt. |
| 2026-07-21 | Text-on-image / image editing added via OpenRouter Nano Banana (Higgsfield has no image editor). Marrs's flow: pick a library image, describe the change (e.g. add words), apply, save back. Model `google/gemini-2.5-flash-image` (GA; 3.x previews 404 on this account) via chat completions with `modalities:['image','text']` + an image_url content part; returns a base64 data URI. Hosting reuses the Higgsfield CDN (`uploadReferenceImage`) so no Vercel Blob is needed. New `lib/marketing/image-edit.ts`, `media/edit` route, `MediaEdit` panel. Confirmed end-to-end in prod (returns a fetchable CloudFront PNG). Provider chosen by Marrs (OpenRouter, reusing the existing key) over Vercel AI Gateway / waiting on Higgsfield. |
| 2026-07-21 | Soul generation RESOLVED + WORKING (corrects the "account-gated" entry below). It was never a plan gate (account has credits + all Soul models). `/v1/text2image/soul` is retired and returns "Unavailable model". From the account's API reference (server platform.higgsfield.ai) the live endpoints are: Soul Standard `POST /higgsfield-ai/soul/standard`, Soul 2 `/higgsfield-ai/soul/v2/standard`, Soul Character `/higgsfield-ai/soul/character`, Popcorn `/higgsfield-ai/popcorn/auto` — all take a FLAT body (top-level prompt/width_and_height/quality/batch_size/custom_reference_id) polled via `/requests/{id}/status` = the v2 `subscribe` default. Fix: point the soul model at `/higgsfield-ai/soul/standard` and use plain `v2.subscribe` (flat); reverted the interim `{params}`/v1 detour. CONFIRMED in prod via the real `generateImages` (base + Soul ID both return completed CloudFront image URLs). Next: add Soul 2 / Character / Reference / Popcorn to the registry as selectable models (one entry each). |
| 2026-07-21 | Soul image generation fix + account-gate finding. `/v1/text2image/soul` needs the body wrapped as `{params}`; it was sent through the v2 `subscribe` client (flat body) → `body.params: Field required`. `generateImages` now routes `/v1/` endpoints through the v1 client's `generate()` (wraps params, JobSet-polls), keeping v2 for non-v1 models. Params validated against the SDK enums (quality 1080p, width_and_height 1152x2048, batch_size 1). REMAINING BLOCKER is external: the API returns "Unavailable model" for the Soul model on Marrs's account (confirmed by a 4-variant probe: base + Soul-ID + v1 + v2-with-params all "Unavailable model"; Soul-ID creation works because it is a different, ungated endpoint). This is a Higgsfield plan/API model-access gate, not a console bug (web-confirmed). The console now shows a clear "enable this model on your Higgsfield account" message. Marrs's action: enable Soul text2image on the Higgsfield plan/key. |
| 2026-07-21 | Template recipe = explicit parts + AI chat on all types + media UX (Marrs). (1) A Content Template's recipe is now three named, promptable fields — **Hook recipe** (an ordered opening formula), **Structure recipe** (the body beats), **CTA recipe** (the close; may say "no CTA") — plus a **Length** field prefilled from an industry-standard per-format default (`FormatDef.defaultLength`). `draft.ts` injects each as its own labelled section so none gets buried; legacy templates with only the old `recipe` still work (it maps to Structure). You bring / You get / Example stay display-only. (2) The on-screen **April chat now appears on the text (post) screen**, not just video: the chat route + ChatPanel were generalized to `{content, kind}` ('script'|'body'), recipe-aware for both; TextOutputScreen gained the two-column workspace + undo + drafting/chat mutual-exclusion. (3) Media "Generate with AI": clearer description, Soul-ID setup restyled as a button, an **Add images** button + guidance (10-20 varied photos) where the library is empty (scrolls to the add form), dead FLUX fallbacks cleaned. FLUX stays out until a real text-on-image endpoint is confirmed (noted in the UI: "more models coming"). |
| 2026-07-20 | Retired the Phase-1 `SEED_PIECES` scaffolding (`lib/marketing/seed.ts`, the hardcoded "Strip the AI out first" short-form piece). It was merged into the stream page + dashboard piece lists but NOT into the develop hub / delete path, so after its real pieces were deleted it lingered as an UNDELETABLE ghost card ("1 piece" on the stream card, "nothing in development" inside, no way to remove it, re-seeded every render). Now that April + the concept bank are live, real content replaces it. Removed the seed + all four usages (dashboard, stream page, piece page, teleprompter); the piece/teleprompter storage-down fallback now degrades to "not found" instead of the stale seed. |
| 2026-07-20 | Recipe master-prompt upgrade (the "recipe" = brand voice + core concept + content template fused into one master prompt, per Marrs). Rewrote `lib/marketing/draft.ts` textSystemPrompt + scriptSystemPrompt from a multi-agent design pass (4 designs → adversarial critique → synthesis): the three inputs are now NAMED with explicit PRECEDENCE (concept = source of truth, recipe = binding structure/house style, brand voice = sound, hard constraints above all), a HOW-TO-FUSE step, hook built from the concept's sharpest fact, brand voice OVERRIDES the default Polynize register (fixes client-stream drafts sounding like Polynize), and the video script now follows the recipe's OWN beats + ending (no forced CTA) with a short-form ON-SCREEN TEXT hook. Validated via a temporary A/B probe against a representative Polynize fixture (Capability Mapping + Contrarian Post): decisive win on the video path (new followed OPEN/TURN/PROVE/LAND; old fell back to generic HOOK/BEAT/CTA + a forced CTA), marginal gain on text. Cost: the editor-style prompt reasons harder (~2000-2300 reasoning tokens), so draft ceilings raised text 4000→6000, video 6000→8000. Probe removed after decision. |
| 2026-07-20 | "Use this template" now forces a FRESH piece + draft each time (`createOutputs` gains `forceNew`, passed by the create/go route). Before, template creation was idempotent per (concept, format, template_ref), so a second use silently reopened the prior piece and the auto-draft skipped it as already-filled — reading as "it just gives me the same post, stuck in a cache". Variations now accumulate in the concept's dev hub (deletable there); the custom Output-plan path stays idempotent. Root cause was reuse, not caching (the piece store does direct Supabase reads, no cache layer). |
| 2026-07-20 | More test-feedback fixes: (1) Undeletable in-development items — the stream page and the develop hub/delete used different grouping predicates, so a card could show with an empty hub and a no-op Delete; unified onto one shared `groupKeyOf` (`lib/marketing/dev-group`). (2) Dashboard button now targets the CURRENT stream's home (Marrs's "dashboard" = the brand page), via a `BackLink` `dashboardHref` prop; non-stream pages keep the all-brands default. (3) Draft truncation ROOT CAUSE (confirmed via a temporary probe against prod): `google/gemini-3.5-flash` is a thinking model whose `reasoning_tokens` (~800-950, and NOT disableable — "Reasoning is mandatory for this endpoint" — nor reliably cappable) count against `max_tokens`; at 1800 a rich recipe prompt spent the budget on reasoning and truncated the visible draft mid-sentence. Fix = generous `max_tokens` (text 4000, video 6000) leaving ample room for reasoning + full output (verified `finish_reason:stop`, complete posts). |

---

## D39 — A video script is BUILT IN STAGES: agree the hooks, agree the arc, then write. Replaces the one-shot angle box

**The complaint.** Marrs, on the angle screen: *"I get to this page, I'm a little ambiguous on what to do. What angle do I want to take is a little weird."* And on what the concept was failing to do: *"My assumption was that putting a whole bunch of information into a core concept would actually help the AI to choose out of what's good and what's not, but that's not currently happening."*

**The measurement.** The angle he typed for a real piece was ~49 tokens. The fixed instruction April reads around it is ~4,940 tokens: the system frame, the hook pattern library, the house hook rules, the format's output shape, the template recipe, the brand voice, the exemplars. So the operator's brief was about 1% of the input, and from it April produced 100% of the piece in a single call.

That is the actual fault, and it is structural rather than a prompt-quality problem. The first artifact he could review was also the last one produced, so the only way to say "you picked the wrong part of the concept" was to rewrite the angle and regenerate everything. His own diagnosis of the remedy: *"a collaborative process to excavate the good stuff out of me."*

**The decision.** Two cheap checkpoints now sit in front of the expensive one.

1. **Hooks.** April reports what is USABLE in the concept, then proposes six hooks, each carrying the pattern it uses and the concept material it stands on. He ticks, edits, or asks for six more, and anything he supplies himself is used verbatim. Six because he asked for *"five or six to select from"* and said the range is what helps him choose.
2. **The arc.** Given the agreed hooks, April proposes the beats, and for each one states what it argues and what it stands on. That second line is the point of the whole stage: it is the first time her selection from the concept is visible while it is still two lines of text.
3. **The script.** Bound by both. Agreed hooks are reproduced word for word, and the arc outranks the recipe's default beat structure, because it *is* that structure already applied to this concept.

All three stages read the same materials through one `gather()`. Agreement about hooks guarantees nothing if the script stage is looking at a different concept.

**What follows from it:**
- Video no longer auto-drafts on "Use this template", and video skips the angle screen. Landing on a finished script was what made the angle the only decision in the process.
- Text keeps the angle box and keeps auto-drafting. A post is short and cheap to redraft; the staging exists to make an expensive one-shot cheap.
- `hooks`, `outline` and `concept_read` live on the piece, all optional. `isValidPiece` is unchanged, so pieces from before this stay valid and fall back to the one-shot path.
- Skipping the arc is allowed and says so on screen: April will build one herself, which is the old behaviour.

**Deliberately NOT done yet.** The concept document itself is the deeper problem, and Marrs named it: *"we definitely have to refine the process of writing the core concept... it's kind of a big document. I'm not really taking note of what's in that."* It is second, not first, because stage one shows what April can actually use out of a concept. Watching that repeatedly is what will tell us what a good concept must contain. Fixing the concept first would be guessing.

---

## D40: The Gates. the console's marketing flow is a linear pipeline of five gates over one Narrative

**Adopted 18 August 2026, the same day D39 shipped, and superseding most of it.** Marrs reset the console's direction ("in the attempt to make it the everything platform for my content, it is now the nothing platform") and the redesign was workshopped through a clickable mockup to a build plan he answered five decisions on, verbatim: "1 yes 2 draft-first 3 yes 4 yes 5 yes".

**The shape.** One Narrative moves through five gates, one screen per gate, one mint decision bar per screen, back goes back, and you advance only by deciding:

1. **Idea.** The inbox plus a fresh-idea box. Two decisions: which idea, which lane. The lane (Marrs = opinion in his own voice, Polynize = educational; labelled from streamLabel, renamed from "Marrs Attacks" on 19 August) is the fork that sets channels, voice and CTA, and lane ids deliberately equal stream ids so brand voice and Metricool mappings resolve with no translation.
2. **Article.** The long form, 300 to 450 words, drafted by April the moment the gate is first seen and refined by direct edit or one instruction at a time in a docked chat. **The interview is dead** (decision 1). The article is the source of truth for everything downstream and publishes as-is.
3. **Kit.** Per-platform tick list (LinkedIn, Instagram, TikTok, YouTube: decision 3), counts in "pieces of content", never "placements". Confirming creates MASTER pieces: one per master asset (article, texts, shorts, long, carousel, images), not one per post.
4. **Create.** The masters, video first because it is the long pole. V1 links to the existing editors; the one-card-at-a-time flow is the next build.
5. **Ship.** The kit expands into per-channel calendar entries as DRAFTS at each channel's next open slot (decision 2: draft-first), and one button flips the whole wave live through the existing publishEntry path.

**The cadence layer.** Ultimate state, Marrs's words: "at least two posts a day per channel per platform". Slots are per channel (channel-schedule.ts), two a day, morning and early afternoon, staggered across networks. The times shipped as placeholders pending the Metricool best-times spike. The channel's queue is one queue across all narratives, so two narratives in the same week interleave rather than collide.

**What this supersedes and what it keeps.** The board replaces the stream-cards dashboard as the marketing home (decision 4); the old dashboard moved intact to /console/marketing/streams because Marrs was explicit that the prior design is set aside, not deleted: "we're going to have to repurpose some things from there. The image things, there are some interfaces we're going to have to repurpose." Concepts migrate to Narratives only when picked up, never in bulk (decision 5). D39's staged build survives inside Gate 4's script editor. The template picker as a user-facing choice is gone from this flow; recipes survive as kit internals.

**Deliberately not in v1:** the one-card Create flow, per-channel caption generation (drafts carry the master's own text until then, hand-tuned on the calendar screens that already exist), prezie frame export, the Learn loop (Metricool analytics pull: built during the four-narrative hold, since it needs published data to pull).

---

## D41: Not everything ships through the scheduler. Marrs's own LinkedIn is hand-posted

**Adopted 19 August 2026**, from Marrs's own measurement rather than from any published evidence: *"posting content via platforms like Metricool severely restricts reach... for my personal LinkedIn posts, we have to have a way to alert me with the content. I'll do that on my own via my phone, which just supercharges reach in my experience."* And the boundary he drew: *"I don't actually mind it for the Polynize stream because those ones I usually share with a comment on my own personal page."*

**The decision.** A lane's schedule now carries a **publish mode per channel**, alongside its time slots:

- **`auto`** the wave schedules through Metricool, hands off. Everything except the one case below.
- **`manual`** the console prepares the post and **emails it to him to publish himself**. Default for **marrs + linkedin only**.

Gate 5's button stops claiming to do one thing. It reads "schedule 16, send me 3", the hand-posts are marked in the week grid, and a wave that is entirely hand-posted no longer requires Metricool to be connected at all.

**Why the mode is stamped at PLAN time, not read at ship time.** Changing a lane's setting later must not silently rewrite how an already-planned wave goes out. The stamp lives on the calendar entry (`publish_mode`), and an entry planned before this existed has no stamp and is treated as `auto`, which is how it was already behaving.

**Why the migration is lane-aware.** `normalizeChannelSchedule` takes the lane, so a config file written before modes existed falls back to that lane's default rather than to a global `auto`. Without it, the first read of any existing file would have quietly started pushing his personal LinkedIn through Metricool, which is the exact behaviour the setting exists to prevent. Nine tests cover this, including the legacy-file case in both directions.

**The hand-post brief is a deliverable, not a notification.** One email per wave, not per post. The copy sits in a single selectable block so a long-press on a phone selects the whole post and nothing else; the first comment is separate because the link belongs there rather than in the body; media are plain links he can open and save to the camera roll. Best effort by contract, like the CRM ping: it never throws, because a prepared-but-unannounced post is recoverable from the calendar while an exception would abort the rest of an otherwise fine wave.

**The evidence position, stated honestly.** There is no public study comparing native posting against scheduler posting on LinkedIn, and LinkedIn does not comment on it. His own observation is therefore the best evidence available. That makes it exactly the sort of claim a **setting** should encode rather than an argument should settle, and it is why the mode is configurable per channel instead of hardcoded.

**Follows from this, and still to build:** the LinkedIn document carousel is a hand-post by nature, since we cannot schedule a document through Metricool anyway (see `output-spec.md` section 0), so the PDF has to reach his phone. Marrs: *"we'll find a way to create the PDFs in the console and then present them to me to post organically myself via the mobile app."*

---

## D42: The kit stops counting posts and starts naming them

**Adopted 19 August 2026.** Marrs asked the question v1's kit could not answer: *"Is it a contrarian post? Is it an informative post?"* A count cannot answer it. And the question that follows: *"they need to express the idea in slightly different frames. Maybe four is too much."*

**What changed.** Every Gate 3 tick now names a real END STATE from `output-spec.md`, and the frame reaches April as a different instruction. The screen went from 9 rows to 11 per lane; the default kit went from 19 posts to 15.

| v1 | v2 |
|---|---|
| `4 posts / text, one per beat` | **Contrarian post**, **Hard moment** (marrs) or **Field report** (polynize), **Numbered rules**, one post each |
| `3 images / hook lines on prezie stills` | **Image**, one 4:5 card |
| `Article` | **Article**, plus its cutdown, which IS the contrarian post rather than a fourth item |
| A count pill on every row | A pill only on the three series rows, reading `x3` |
| `Confirm · 19 pieces of content` | `Confirm · 15 posts`, which is literally the number of calendar entries |

### The four rules the file now enforces, each one a thing that was wrong

**1. One output, one piece, for anything with its own words.** This is the load-bearing decision and the one three independent reviews converged on. `piece.master` is used as a unique key per narrative in both the build route and the wave route, so two outputs sharing a master collapse to one piece, last write wins, and the loser keeps its draft while being invisible and never planned. v1 had exactly that shape: four LinkedIn text posts on one piece with one body, so the wave copied the same text onto four calendar entries. **Naming the frames without splitting the pieces would have shipped three identical posts under three different labels**, which is worse than v1's vagueness because it looks like it worked.

So `MasterAsset` gained `texts_hard`, `texts_list` and `texts_field`. The six v1 values are frozen and `texts` now means the **contrarian** frame specifically, which is why an in-flight narrative's existing text piece is adopted (and retitled) rather than orphaned. Every text placement count is therefore 1, which makes Gate 5's existing `missing = count - have` guard exact rather than approximate, and means **no new persisted field was needed on the piece or the entry**.

**2. Every post carries an image**, per Marrs. `visual` is required on every artifact with no optional escape, so an output that forgets one does not compile.

**3. Source strength is part of the data.** Every number is wrapped in `Sourced<T>` with one of `official`, `large_study`, `practitioner`, `ad_data`, `ours`, because a figure with no provenance reads identically whether it came from LinkedIn's API reference or an SEO blog. Where the spec says NO DATA there is **no field**, and `doNotAssert` carries the gap forward as an instruction so the model cannot fill it either. There is deliberately **no target-duration field anywhere**: not one of the three platforms publishes an optimal length, and a field would invite the circulating figures (watch time, or TikTok's five-year-old ad conversion data) to become instructions.

**4. The spec reaches the writer.** `promptFragment(master)` is read by `draft.ts`. Without it the frames are labels: every LinkedIn frame writes format `linkedin_text`, so a contrarian post and a numbered list arrived at the model as the same instruction. Three separate reviews made this the condition on the whole design and they were right.

### Numbers this corrected on the way

**The format registry contradicted the spec, and the registry was the one writing the post.** `linkedin_text.defaultLength` said "150 to 250 words. A quick post is 50 to 100 words" against the spec's sourced 1,300 to 2,500 characters, and that quick-post floor sat **under the ~400 character floor every study agrees on**. `pdf_carousel` said 6 to 10 pages against 7 to 12; `image_carousel` said 5 to 8 slides when the API caps a carousel at 10. All three now match the spec and carry their strength, and for a piece cut from a Narrative the kit's own spec is preferred, because two length authorities in one prompt means the model follows whichever it read last.

**The blanket 4,000 character trim was above every platform's cap.** LinkedIn is 3,000 and Instagram and TikTok are 2,200, so `capCopy` now trims in the platform's own unit. Those units are three different things: characters, UTF-16 code units (TikTok's "runes") and bytes (YouTube's description, where an emoji costs three or four).

**The Gate 5 week grid held a second copy of the master vocabulary** and defaulted anything unknown to "Post", so it would have shown "Post 1 Post 2 Post 3" against a Gate 3 that promised Contrarian, Hard moment and Rules. It reads the catalogue now.

**The first comment was documented and inert.** The Metricool client has always accepted `firstCommentText` and `publishEntry` never sent it; the hand-post brief has always had a place to print it and never had one to read. `CalendarEntry.first_comment` closes both. **Nothing writes it yet** and it is deliberately empty rather than filled with a guessed url: the Gate 4 caption card is what will write it.

### Manual-ness moved onto the output

D41 stores publish mode per lane per channel, and `MANUAL_BY_DEFAULT` only covers marrs. A LinkedIn document cannot be scheduled through Metricool at all, so it is a hand-post **by nature**, not by channel setting: without `handPost` on the output, the polynize lane would have planned it as an auto entry and posted a flat image instead of a swipeable document.

### Which frames, and why not four posts

Three text posts, three different frames, never the same one twice. The count is decided by supply and capacity rather than taste: the Gate 2 article is 300 to 450 words, about **one** text post's worth of material at the spec's character band, so four posts is not a cut, it is a thousand words of invention. Different frames rather than one repeated because the types differ in **which** engagement they produce (the listicle is a comment machine with ordinary ER, the hard moment is the reverse), the ranking behind them is classifier-assigned on somebody else's audience, and three frames on one idea with the idea held constant is the only shape the Learn loop can ever learn from.

Four frames are in the vocabulary and deliberately **off** the screen (win, challenge, recap, explainer). A row he has to decide about every week to serve the rare week he has the material is exactly the overload he named. Explainer is not a default on either lane, because the article and the carousel are already explainers.

**Two risks recorded rather than solved.** The hard moment needs a real cost actually paid, and a 400-word article about an idea usually contains none, so its `doNotAssert` forbids inventing one and it must degrade to the field report. And contrarian fires on both lanes every week, so a narrative with no actual position must say so rather than manufacture a disagreement.

### Flagged, NOT changed: the cadence arithmetic is wrong and it is Marrs's call

The build plan says 56 weekly slots divided by a 19-post kit is "roughly 3 narratives a week". **Slots are not fungible across networks**: a LinkedIn post cannot fill an idle TikTok slot. The honest figure is the per-network floor, which for v1 was **2** (set by Instagram at exactly 14 of 14), and for the typed kit is 1 if LinkedIn respects its own evidence. Section 4 of the output spec measures **4 to 5 LinkedIn posts a week** as the sweet spot; the target of 2 a day is 14. Nothing enforces capacity either: `nextOpenSlots` walks 60 days forward and always finds something, so an oversubscribed channel silently slides posts into future weeks, and past the 60-day walk an entry is created with no `scheduled_at` and is dropped from every wave forever.

Marrs set the 2-a-day target explicitly, so this is flagged rather than changed. The recommendation is LinkedIn at 1 slot a day on weekdays.

### The known migration edge, stated plainly

A narrative that already **planned a wave** under v1 keeps its v1 entries and gains the new typed ones on top, because the wave never deletes a draft the operator did not ask to delete. The plan response returns `extra` so Gate 5 can say so rather than the operator finding out on the grid. A narrative at Gate 3 or Gate 4 migrates cleanly: its ticks resolve, its pieces are adopted and retitled, and only the two new text masters are created.

---

## D43: A Story is now a Narrative

**Adopted 19 August 2026.** Marrs, reading his own board: *"I'm not sure what you mean by three stories a week. Are you saying three we were calling stories? I thought you were referring to Instagram stories... Maybe stories is a weird word."*

He was right, and the collision is the worst kind: **the word already means something specific on three of the four platforms we publish to.** "Three stories a week" reads as three Instagram Stories, which would be nothing, when it meant three whole weeks of content in flight. A unit name that inverts its own scale to a reader is not a naming quibble.

**His choice: Narrative.** *"That implies story and movement through time."* Which is exactly what the five gates are.

**What it is, stated once so it stops needing restating.** A Narrative is one idea, committed to a lane, walked through Idea, Article, Kit, Create, Ship, and coming out as a week of posts across all four platforms. Currently 15 by default. An **Idea** is a note in the inbox; a Narrative is that note in the pipeline.

**Done all the way, on purpose, because it was cheap exactly once.** The word was only on screen in two places, so screens-only would have been faster. But the code and the conversation would then have drifted permanently, and the storage path would have been the expensive part later. Today there are a handful of these saved. `Story` to `Narrative` throughout: the type, the store file, the routes, the components, and `pam/stories/` to `pam/narratives/`.

**Nothing saved is lost, and here is exactly how.** Reads fall back to the old path (`pam/stories/{id}.json`, and its index), writes only ever go to the new one, so a narrative saved before the rename opens and heals permanently the first time it is saved. Deletes clear **both** paths, because clearing only the new one would let the old file resurrect the narrative on the next read. On pieces, `story_ref` is adopted into `narrative_ref` at read time: without that adoption, a saved piece silently loses its source article and Gate 4 reports "No concept to work from", which is the bug that cost a walkthrough once already. And `/console/marketing/story/...` redirects to the new path, because an open tab pointed at a narrative mid-gate should not 404.

**Two things the rename broke on the way, both caught before shipping, both worth recording because the failure mode is generic.** A blanket search and replace is not safe on a word this common.

1. **It leaked into April's prompts.** "Every fact, name, figure, claim, and story in your draft must come from the concept" became "and narrative", and `Proof or story`, which is a **literal section heading in the concept doc**, became `Proof or narrative` and stopped matching anything. Both reverted. The rule going in: rename identifiers, never prompt prose.
2. **"history" contains "story".** Five places in the decision log became "hinarrative", and one "pastel storybook" became "pastel narrativebook". Fixed. A rename script that matches inside words will find words you were not thinking about.

It also reached well outside the marketing module on the first pass, into the landing page's story-scroll components (`StoryPath`, `StoryMotion`, `StoryLanding`) and the agents prompts, where "story" means a story. All of that was reverted and the rename was rerun scoped to the unit.

**One vocabulary collision accepted rather than solved.** The output spec calls the top family of LinkedIn post types "narrative posts", first-person-with-stakes. So "narrative" now has two senses in the docs. The spec says which is which in its header, and the code uses **frame** for the post-type sense (`contrarian`, `hard_moment`, `listicle`, `field_report`), which keeps them apart where it matters.

---

## D44: LinkedIn stays at two posts a day, and the slots get a type

**Adopted 19 August 2026, reaffirming a decision after I argued against it.**

D42 flagged that the output spec's only cadence evidence measures **4 to 5 LinkedIn posts a week** as the sweet spot, against the console's target of 2 a day, which is 14. Marrs read the argument and rejected it:

> *"I'm going to keep the LinkedIn to two posts a day: video, then text and images. That's fine, that's what morning and afternoon covered. I've seen plenty of people do that. Four to five, I don't really care about that being a sweet spot. I'm going with the Gary V school of thinking, which is that he posts like 350 pieces of content a day across all platforms, so I'm taking a bit of a maximalist view."*

**That is the decision. 2 a day on LinkedIn stands.** The evidence is recorded in the build plan and the spec and does not need relitigating: it measures one thing (median ER per post at a given weekly volume) and he is optimising a different one (total reach and surface area). Both can be true. The honest position is that we do not have his own numbers yet, which is what the Learn loop is for, and until we do this is a strategy choice rather than a factual dispute.

**But his sentence carried a build requirement I had not noticed.** The two slots are not interchangeable to him: **morning is video, afternoon is text and images.** The slot table cannot express that. `ChannelSlots` is `Record<Network, string[]>`, just times, and `nextOpenSlots` fills them in order, so whichever output the plan reaches first takes 08:30. A narrative would routinely put a text post in the morning slot and a video in the afternoon, which is not what he asked for and he would have found out by looking at the week.

**So slots get a kind**, and the wave matches an output to a slot that will take it. That is the next build.

**Capacity, with the typed kit at 2 a day.** LinkedIn is 4 posts per narrative into 14 slots, so 3 narratives a week fits with room. Instagram is 5 into 14, so 2 fit comfortably and a third overflows by one. So roughly **2 to 3 narratives a week** is what the current shape actually carries, and Instagram binds it, not LinkedIn.

> **Updated 19 August 2026 by D46.** LinkedIn gained a fifth post per narrative (the video, added because this decision's own slot structure had nothing to put in the morning slot), so LinkedIn is now 5 into 14 and matches Instagram exactly. Both floor at 2.8, so the carry is unchanged at **2 to 3 narratives a week** and the two now bind together. Typed slots do **not** reduce it, because the preference is a preference and not a filter: see D46.

**Still true and still unfixed:** nothing enforces capacity. `nextOpenSlots` walks 60 days forward and always finds something, so an oversubscribed channel silently slides posts into future weeks. Past that walk it creates an entry with no `scheduled_at`, which the ship path filters out, so a sustained overrun manufactures posts that can never ship and reports no error. With a maximalist posting strategy this stops being theoretical, so it should be built alongside the typed slots.

---

## D45: The front page is whose content, and every stream has its own board

**Adopted 19 August 2026.** Marrs: *"I've decided that I want this to be for everyone in the team, so we need that first page to come back where it has Polynize, Marrs, Shourov, Kristin and Julian as the opening. When you click on anyone's individual stream, you have the narratives as the board. I think that's better."*

**This reverses part of D40**, which made the flat board the marketing home on the reasoning that the unit of work is a narrative rather than a stream. That reasoning was right and incomplete: a narrative belongs to exactly one person or brand, and with five of them a single flat board mixes five people's work into one list where nobody can find their own. The board did not go away. It moved down a level. **Whose work, then which narrative.**

**The shape now:**

| Screen | What it is |
|---|---|
| `/console/marketing` | Five cards: Polynize, Marrs, Shourov, Kristin, Julian. Counts are **narratives** now, in flight and shipped, not concepts and pieces |
| `/console/marketing/stream/{id}` | That person's board, narratives at their gates, **New narrative** as the primary action. Below it the setup that shapes them |
| `/console/marketing/streams` | Redirects to the front page, since that page IS this screen again |

### The lane is now literally the stream

`NarrativeLane` was `'marrs' | 'polynize'`. It is now `StreamId`, all five. It was already declared that lane ids equal stream ids on purpose so brand voice and Metricool mappings resolve with no translation; this makes that identity literal instead of a coincidence two files have to keep agreeing on. **A narrative saved with either old value is unaffected**, because both are still stream ids.

### The kit keys on the KIND of lane, not on named lanes

This is the part that would have rotted first. The kit had `shown: ['marrs']` on the hard-moment frame and `shown: ['polynize']` on the field report. With five lanes that is either four copies of the same list or a branch per teammate.

So streams gained a **kind**: Polynize is `company`, the four people are `person`. The frames key on that:

- **Hard moment** (a real cost paid, first person) is available to a **person** and not to a brand.
- **Field report** (the pattern across client work, nobody's sign off needed) is the **company's** version of the same job.
- Everything else is both.

Adding a teammate now adds a board and **no branches**. The kit's own invariant check runs over every stream rather than the original two, so a lane whose defaults resolve to nothing is a test failure.

The same rule covers the article's lane register: a stream with no hand-written register falls back to its kind. Writing a paragraph per teammate would be inventing four people's voices for them, and their real voice belongs in their own brand-voice doc, which that block only frames.

**And the measured reason the kinds must stay apart:** a personal profile takes 63% higher engagement than a company page at similar impressions (Metricool 2026). Not a reason to stop posting as the brand, a reason never to judge the two by one number.

### Gate 1 lost a decision

Arriving from a stream means the lane is already answered, so **the lane picker is gone** and the ideas inbox is scoped to that stream: an idea caught for one person is not a candidate for another's narrative. The picker still appears when there is no stream in the url, so the screen cannot become unreachable.

### Core concepts: demoted, not deleted

Marrs: *"Don't worry about the core concept or get rid of that screen."* The narrative's own article replaced the concept as the source of truth at Gate 2 (D40), so concepts are no longer the way in, and the section now sits below the board and the setup instead of leading the page.

**Not deleted, and deliberately so.** There are real imported concepts behind that section, and removing a screen with data behind it on an inference from a sentence that reads two ways is the kind of thing that cannot be undone by clicking. It is one line to remove when he confirms.

### One thing to check with him

He wrote **"Kristen"** and **"Julien"**; the console has **Kristin** and **Julian**, and has since they were added. Kept as they are rather than silently changed, because it is a person's own name on their own board and dictation is the likelier explanation. Worth a yes or no.

---

## D46: The slots get a type, and a preference is not a filter

**Adopted 19 August 2026**, building what D44 named. Marrs: *"I'm going to keep the LinkedIn to two posts a day: video, text and images. That's fine, that's what morning and afternoon covered."*

He thought it already worked. It did not: the slot table was a list of times filled in order, so whichever post the wave reached first took 08:30. A narrative would routinely put a text post in the morning and the video in the afternoon.

**Now:** LinkedIn's morning slot is the **video** slot and its afternoon slot is the **text and images** slot. The other three networks state no preference, because he said nothing about them.

### The finding that nearly made this inert

**The kit produced no video on LinkedIn at all.** Every LinkedIn output was a text master or the blocked document. So a video-preferring morning slot had nothing it could ever draw from, and the visible result would not have been an error: it would have been a LinkedIn week at half cadence, 7 usable slots instead of 14, with the morning permanently empty. He would have found out by looking at the grid.

Worse, the format registry disagreed with the kit and the registry was the misleading one: `output-plan.ts` already lists `linkedin` among `split_screen_short`'s channels, so anyone checking whether LinkedIn video existed by reading that file concluded yes.

**So the kit gained `li_short`**, one cut on LinkedIn on the existing shorts master, and this is recorded as **a bet, not a gap being filled.** The only LinkedIn video figure in the output spec is negative: median reach down 36% year on year, the steepest fall of any format in the document, and the spec has no LinkedIn video section at all. Adding it is a maximalist bet against the only evidence there is, which is exactly consistent with D44, and it should be judged on his own numbers when the Learn loop can produce them. One cut, not three, because three near-identical videos on the channel whose video reach is falling is volume with no argument behind it.

### Preference, not filter, and the argument is arithmetic

A hard filter would honour his shape exactly and go quiet when nothing matched. Under it, a narrative's 4 LinkedIn stills would queue one per day into the afternoon while every morning sat empty: **the only version of this build that reduces total surface area**, on the channel where he asked for more of it. He is a self-described maximalist. So a slot declares what it is **for**, takes that first, and takes something else rather than going empty.

The invariant that makes it safe is arithmetic rather than argument: **the slots consumed are exactly the ones the untyped fill consumed.** `nextOpenSlots` is not touched, so "never a past time", "never a duplicate" and the 60-day guard are inherited rather than re-earned, and the matcher only decides which post sits in which of those slots. Preference reorders. It never delays and it never drops. A test asserts it per network at five demand sizes.

**The cost, stated because he will see it:** on a quiet week two of his LinkedIn mornings will carry a text post. That is the failure that keeps posting, chosen over the failure that goes quiet.

**So the fallback is visible.** The Gate 5 grid had no time-of-day dimension at all before this, which would have made the whole feature invisible on the only screen he looks at. Every chip now carries its time, a fallback placement is marked `*` in coral with a dashed edge, and a line under the grid says how many and why. A Rules post at 08:30 with no explanation reads as a feature that did not work.

### Five things the adversarial pass caught, all of which would have shipped

1. **A slot preference keyed to `'08:30'` would have evaporated.** The default times are documented as placeholders pending the Metricool best-times spike, so the preference is derived from **time of day** (before or after noon) rather than from a literal time.
2. **Keying by position instead of by time** would have moved the video preference onto any earlier slot added later, because `normalizeSlots` sorts. Keyed by the time string.
3. **Turning `ChannelSlots` into objects** would have broken the tolerant parse in both directions: `normalizeSlots` filters on `typeof s === 'string'`, so a new-shape file read by old code drops every slot and falls back to the placeholder times **silently**. `prefers` is a sibling key instead, exactly as `modes` was in D41. Worst case it is ignored.
4. **`'text and images'` is not `masterKind: 'image'`.** Every LinkedIn still post is a **text** master carrying a mandatory image (D42 rule 2). A slot typed `image` would have matched nothing on LinkedIn and killed the afternoon as well as the morning. The vocabulary is two values, video and still, which is how he said it.
5. **Matching per master rather than per network** puts a video in an afternoon. The video master asks first, sees a three-slot window on Instagram, and is forced into a still slot while the carousel later takes a morning. Demand is now gathered for a whole network before anything is placed.

### Two latent bugs fixed on the way, both of which could double-post

**`have` now means timed OR already live.** Counting every row let a dateless draft block its own replacement forever, because ship filters on `scheduled_at`. Counting only timed rows fixes that and opens something worse: the calendar's PUT route clears `scheduled_at` without touching `status`, so a **scheduled** entry holding a live Metricool id can exist with no date, and treating it as absent creates a second draft that ship then publishes to a real channel. A non-draft row counts as present whatever its date, and only drafts are repaired.

**Orphan drafts are repaired in place, sorted by `created_at`.** `listEntries` has no ORDER BY, so without the sort which orphan gets which slot differed between two runs over identical state, which is a schedule that changes on replan.

Also: an entry is **never saved without a time** any more. It used to be, which manufactured a post that could never ship and never errored; it is now reported on screen and retried next run. The wave lock went from 2 minutes to 6, because `maxDuration` is 300 seconds and a run that outlived its own lock could be joined by a second run computing `have` from a pre-write snapshot.

### Weekends: all seven days, and that is an answer rather than a shrug

He asked. **There is no day-of-week evidence to build on.** Section 4 of the output spec is the only cadence section and not one of its rows is a day; nothing else in the docs or the code carries day-of-week data; the only intended source is the Metricool best-times endpoint, still an unrun spike. A weekday-only default would be a guess wearing the clothes of a rule, and an expensive one: cutting to weekdays drops LinkedIn from 14 slots a week to 10.

The one narrow version that was considered and rejected: default **manual** channels to weekdays, since a Saturday slot on his own LinkedIn is an email asking him to work on a Saturday. It buys nothing, because the hand-post brief is **one email per wave sent at ship time**, not a notification per slot. So a Saturday slot generates no Saturday interruption, and the rule would cost his own lane two slots a week for no benefit.

### Flagged, not built

- **The wave lock is per narrative, not per lane.** Open two narratives on one lane and both read the calendar before either writes, so both can take the same slot. Typed slots neither cause nor worsen it. The precedent for the fix is in the same file: the ship branch already re-reads each entry fresh for exactly this reason.
- **Two timezone sources, and they are different stores.** The wave picks a time using `getChannelSchedule(lane).timezone`; `publishEntry` sends it paired with `getPostingSchedule()[stream].timezone`. Both default to Sydney so it is invisible today. Typed slots make it categorical rather than cosmetic: the post the grid labels the morning video would go out in the afternoon.
- **A calendar entry still has no output identity.** The master `texts_list` serves both the listicle and the explainer, so unticking one and ticking the other leaves `missing` at 0 and the wrong draft stands in. The slot is always right, because the kind comes from the master; the copy can still be wrong.
- **Nothing enforces capacity.** Improved but not solved: the console no longer manufactures unshippable posts at the 60-day cliff, it reports them. It still does not warn that a lane is oversubscribed.

---

## D47: Gate 4 gets an image editor, and four traps in front of a walkthrough get closed

**Adopted 25 August 2026.** Marrs: *"I wanna fix the gate four editors. That's the blocker for me not going through the entire process... I need the video editor working, the image editor working. Once the images are created, we can work out how to turn the images into a LinkedIn document carousel."*

### The video editor was not the blocker

Worth recording because he believed it was. `ScriptScreen` and everything it calls work for a Gates piece: the article loads through `narrative_ref`, the staged build runs, the split-screen shape comes back, the teleprompter reads it, Ready-to-record queues it. What he was actually hitting is that `piece/[id]/page.tsx` sent **every non-text kind** to `ScriptScreen`, so the carousel and the quote card opened the **video teleprompter** and offered to draft a spoken script for a post nobody says out loud. Fixing the image editor fixes the video complaint.

What the video card still cannot do is **finish**, and that is a deliberate boundary rather than a defect: there is no cut, render or export in the console, and no upload. The mp4 has to reach Box by hand and be registered in the stream library before it can be attached. Nothing on screen says so, which is worth fixing next.

### The image editor: one slide at a time

A carousel is ten self-contained slides and a quote card is one, so they are the same screen with a different count, and **the count comes from the master rather than being asked for**.

The run: April writes the whole plan from the article in one call (a shared visual **world**, the caption, and per slide a headline, a note and a **background** prompt). Then one slide fills the screen, he approves or remakes it, and the next arrives. A progress strip lets him jump back to slide three without losing his place, because the place is a number and not a scroll position.

**The words are composited, not generated.** The background comes from Higgsfield and the type is put on in code with the existing deterministic Space Grotesk overlay. That is not a preference: the only live image model is Soul, described as photoreal images of people, and a model that writes its own words ruins a slide. It is also what makes ten separately generated images read as one set.

**The crop is now exact.** `renderAndHostOverlay` gained a `frame` option, so every slide is composited onto exactly 1080 x 1350 with the source object-fit cover. Instagram crops every slide of a carousel to the **first** slide's dimensions, so a set generated at two sizes is a set with nine wrong crops. Soul offers no 4:5 size at all, so this is the only way the guarantee holds.

**Done means `piece.media` holds the right ids in the right order.** So media is **derived** from the plan on every save (`mediaFromPlan`), never accumulated from clicks: slide order is post order by construction, capped at the API's ten, and only slides with a real file and a real library id count. Unticking and reticking cannot silently move a slide to the end the way a picker can.

Reuse rather than reimplementation: generation is the media library's own Higgsfield call, the words are its overlay, registration is its `add` route, and its Generate and Add-text panels are mounted in a folded "by hand" drawer via a new `base` prop that leaves their existing behaviour untouched.

### Four traps closed, three of which would have ruined the walkthrough quietly

**1. Media was snapshotted at plan time and frozen forever.** This was the worst one. Press "Lay out the week" before the video or the carousel is attached and the entries were created with `media: []`, and nothing could ever fix them: an already-timed entry counts as present so the plan skipped it, the repair branch writes only the date, and the calendar's own PUT has no media field. The post shipped without its images and the only recovery was deleting every entry by hand. **Media now refreshes on every replan**, drafts only, media only, so attaching images later works. `post_copy` is deliberately left alone because it may have been hand-tuned.

**2. The hand-post brief emailed uuids.** `CalendarEntry.media` holds media ids and the email rendered each as a link, so every hand-post brief arrived on his phone as a list of dead uuids with nothing to save. It hit **every marrs-lane LinkedIn post**, which is every post on the one lane the hand-post path exists for. Resolved to real urls now.

**3. Every Gates prezie shared one bucket, and editing one overwrote another narrative's deck.** Prezies are filed by concept slug and a Gates piece has no concept, so all of them fell into `_unfiled`. Opening the Prezie stage on narrative B listed every unfiled prezie ever made and, with none of its own, opened narrative A's, where a hand edit then **saved back onto A's deck**. The studio queue keyed on the same bucket, so it showed a green "Prezie on the screen" pointing at an unrelated deck and suppressed the missing-prezie warning, which is the one thing meant to be checked before a room is set up. A narrative now gets its own bucket.

**4. April was briefed to the wrong artifact for the carousel.** `outputForMaster` returned the first catalogue entry on a master, and the blocked LinkedIn PDF sorts before the Instagram swipe, so the prompt said "7 to 12 pages, under 60 words each" for a set of ten 1080 x 1350 slides, and read the caption cap off a post nobody is making. Blocked outputs are skipped now, and a blocked sibling is left out of the brief entirely.

### Gate 4 now says what is done

Seven visually identical cards sat under a live "Lay out the week" button, so a card with no script and no media looked exactly like a finished one and the most likely thing to do on the screen was also the thing that laid out a wave of empty posts. Each card now reads `✓ ready`, `script written, no video attached`, `no images yet, needs 10`, and the footer counts them.

**Advisory, never a block.** Media refreshes on replan now, so the order is no longer destructive and he does not need protecting from it.

### One bug that only running it could find

The image screen is a client component and imported the slide module, which imported `draft.ts`, which imports `narrative-store`, which imports `node:crypto`. **`tsc` compiles that happily** and the piece page 500s with an `UnhandledSchemeError` from the bundler. The writing half now lives in `slide-propose.ts`, server only, and the client half imports nothing that reaches a store. Same class of hazard as the kit's client-safety rule, and the reason it is worth actually loading a screen rather than trusting a typecheck.

### And a test runner, because the suites kept disappearing

`npm run test:marketing`. 100 assertions over the slide plan, the order guarantee, the card state and all four regressions above. Written into the repo because every suite written outside it has been lost between sessions, which is the wrong property for the week the flow is walked end to end for the first time.

### Still open, and named rather than left to be discovered

- **No upload.** A media asset is a url reference, so a recorded file reaches the console only via Box by hand. Nothing on screen says so.
- **The LinkedIn document carousel** is still blocked and deferred, as he asked. The slides exist now, so turning them into a PDF is the next question.
- **Only one image model is live.** Soul, photoreal people. No diagram, no chart. Every slide background is a photograph, and the fix is a second model in the registry rather than a change to the screen.
- **A calendar entry still has no output identity**, so the slot is always right and the copy can still be wrong.
- **Two competing routes into the calendar**: the wave, and "Prepare posts" on the text screen, which creates dateless entries the wave then has to repair.

---

## D48: A stream's page is setup, then a funnel of gate lanes

**Adopted 25 August 2026.** Marrs, after seeing the board: *"we need to get rid of the Core Concepts section, the In-Development section, and the Podcasts section from the Content Stream Dashboards. That's the old way of thinking."*

### The three sections are gone from this page, and nothing is deleted

Core concepts, In development and Podcasts no longer appear on a stream's page. Every one of those screens still exists, is reachable by url, and its data is untouched. What changed is that the stream page stops leading with them, and stops paying for **three full store reads** on the way to first byte to render sections nobody uses.

The narrative's article replaced the concept as the source of truth at Gate 2 (D40), so a concept has not been the way in for some time. This is the layout catching up with that.

**Stream setup moved above the narratives**, his call.

### The lanes, which are the actual idea

> *"I like this kind of idea of them being lanes, and each idea is going through gates. If there's a concept that's a gate 3, there are three squares: two of them are filled in, and the third one says Emergent AI. It's all in line, so we can see over time which narratives are further down into the funnel."*

One row per narrative on a shared scale. A gate already passed is a small filled square; the gate it is **at** is the title itself, taking the rest of the row. So the horizontal position of a headline IS its progress, and a column of rows reads as a funnel without a legend:

```
[■][■][■][■][■] The 40 hour week is a rounding error      SHIPPED
[■][■][■][■] Strip the AI out first                  GATE 5 · SHIP
[■][■] Emergent AI                                    GATE 3 · KIT
[■] Why your ops team is the bottleneck            GATE 2 · ARTICLE
Nobody wants another dashboard                       GATE 1 · IDEA
```

**Sorted most advanced first**, his call, with the most recently touched breaking ties.

### This is what absorbs the idea list

> *"This also allows us to integrate the ideas concept in there. If we're writing an idea and it's only a gate one, it goes to the bottom. It's still an idea, and still there."*

A gate 1 narrative has nothing behind it, so it starts hard left at the bottom of the funnel. It is an idea, it is visibly still there, and it needs no separate section. When it moves it climbs on its own.

**The idea capture box survives, moved rather than removed.** It lived inside the Core concepts panel purely by accident of layout, and it is the only place in the console an idea can be caught, so removing that panel would have removed idea capture entirely. It now sits under the lanes.

### Two things worth recording about the build

**No scale along the top, and that was deliberate after trying it.** A five-column header implies the titles line up with it. They do not: a completed gate is a fixed-width square so the rows stay readable at 375px, which means a gate 3 title starts two square-widths in rather than two fifths of the page in. The header promised an alignment the layout does not have, so it went, and each row names its own gate on the right instead.

**The CSS module checker earned its keep.** The first version imported `../lanes.module.css` from a file sitting beside it, so every class resolved to `undefined` and the lanes would have painted unstyled with no error anywhere. `scripts/check-css-modules.mjs` caught it before it shipped. Run it.

---

## D51: A narrative has a look, and the look is one image

**Adopted 25 August 2026.** Marrs: *"we need a 'Hero Image' as an option, so a main hero image gets created that can then set the style for the rest of the images."*

### What it replaces is a guess

The reference plumbing already existed: the slide render route passes `referenceUrl` to Soul as `image_reference`, so a later slide can be generated in the same world as an earlier one. But the slide screen was **inferring** that reference from whichever slide happened to be approved first. So the look of a ten slide set was decided by approval order, which is not a decision anybody made.

The hero replaces that with one image he chose. And settling the look on **one** generation before spending ten is the whole economy of it.

### It belongs to the NARRATIVE, not to a piece

`Narrative` gained `hero_url`, `hero_media_id` and `hero_prompt`. A piece could not own this: the look has to outlive any one piece and be the same across all of them, since the carousel slides, the quote card and the image on every text post are all the same narrative's images.

**Set together or cleared together.** A url with no library id is a preview nobody blessed, and storing one without the other would make "made but not saved" read as saved to every screen downstream.

### The panel sits above the Gate 4 cards

Because it is upstream of every image made below it. Write a line about the look, make it, and it appears as a preview marked "Not saved yet". Blessing it does the same two steps approving a slide does: register it in the stream library for a real media id, then pin it on the narrative. Until then it is a preview, so **a rejected hero leaves no litter in the library and no half state on the narrative.**

Optional by design and the panel says so: a narrative with no hero behaves exactly as it did, and the slide screen falls back to the old inference.

### Reuse, and the one reuse worth naming

Generation is the same `generateImages` call the media library makes. The crop is `renderAndHostOverlay` with **empty text**, which is the compositor the slide route already proved: `frame` forces exactly 1080 x 1350 with the source object-fit cover. That is what makes the hero usable directly as the image on a text post rather than only as a style reference, which matters because text plus image is now the highest priority flow.

### One bug caught in review

`makeSlide` reads the hero and is a `useCallback`, so without `heroUrl` in its dependency array the closure would keep whatever the hero was at mount, and a hero set during the same session would be ignored until a reload. Added.

### Priorities recorded at the same time

Marrs set both a build order and a flow priority, and they are different axes: build order is hero, then the narrative image pool, then the template picker; flow priority is **text plus image first**, then video, then pdf, with the LinkedIn carousel low.

That reordering is worth stating plainly because it changes what the carousel work is for. The template picker serves priority 3 and low. The hero and the narrative image pool serve **priority 1**, because the image on a text post has no generation path at all today: `TextOutputScreen` offers only the media picker. They are text-plus-image features that happen to have arrived through the carousel.

---

## D52: A narrative's own images come first

**Adopted 25 August 2026.** Marrs: *"on the text options within a narrative stream, the image selection should be a contextual, narrative specific image pool. As the images would be created for this narrative, then we can have a hidden section at the bottom which with a click you can open the media library."*

Right, and it degrades fast: every approved slide and every hero registers into the stream library, so ten slides per carousel per narrative floods it inside a week and a text post's picker becomes a wall of other narratives' slides. That matters more now that text plus image is priority 1.

`MediaAsset` gained an optional `narrative_ref`, stamped at both points where an image is generated **inside** a narrative: the hero panel and slide approval. The picker shows that narrative's pool open and folds everything else behind one "the whole library" toggle with a count.

**An unstamped asset is not wrong.** It belongs to the whole library, which is exactly where a hand-pasted Box link belongs, and where everything registered before today sits.

### The hero is a scene, not a face, and it was right by accident

Marrs: *"the hero image is not always going to be someone's face... for the AI emergent article they want to generate a hero image, which may be 1882, New York... it's less likely people are going to use the Soul image reference."*

The hero route already sends a **prompt only**, with no Soul ID and no reference image, so it is scene generation from the first line, and the panel asks for "a scene, the light, the mood". Nothing to change. Recorded so nobody later "fixes" it into a portrait tool.

What it does sharpen is the second-image-model item: Soul is a photoreal **people** model being asked for 1882 New York, which it will do passably and not well. Nano Banana Pro or GPT Image 2 matters more for the hero than for anything else in the kit, because the hero is the one image the whole narrative inherits from.

---

## D53: April writes like a person, which mostly means varying the sentence length

**Adopted 25 August 2026.** Marrs: *"a note for April to adjust her writing style to be more human. Not super precise, a bit more human to human, conversational for direct."*

**The diagnosis, because it decides the fix.** The house voice block said "Direct, contrarian, concrete" and "Short sentences. Say the sharp thing plainly", and nothing at all about rhythm. A model optimising for that produces a run of clipped declaratives of near identical length, and **every sentence landing with the same weight is the single most machine-sounding thing prose can do.** It reads as precise rather than as spoken, which is exactly what he described.

So the correction is about **variance, not softening**. The directness stays. What was added is the set of things a person does and a model does not do unprompted:

- One person talking to another, not a document about the subject.
- **Vary the sentence length**, and this is flagged as mattering more than any other line: three sentences of the same length in a row is the sound of a machine.
- Contractions are normal, and so is opening on And, But or So when that is how the thought actually joins.
- **Conversational rather than exact.** Where the natural phrase and the technically precise phrase differ, take the natural one. Precision that costs the rhythm is not worth it.
- Stop hedging every sentence. One qualified claim reads as careful, five in a row reads as a committee.

Applied to the shared voice block in `draft.ts`, so it reaches every text post, every script and every chat rewrite, and separately to the article's own register line, which had its own "told plainly" phrasing.

**Deliberately NOT applied to the slide writer.** A slide headline is a fragment under 14 words, so the sentence-variance rule has nothing to act on, and that prompt is the one that has been truncating: adding two hundred tokens of voice guidance to the call that already fails on payload would trade a real problem for a cosmetic one.

---

## D54: One name per thing, and the platform mark on the card

**Adopted 25 August 2026.** Marrs: *"the item labelled on Gate 3 has to be similar to the one on Gate 4. For example, the Instagram image on Gate 4 says 'card'. That doesn't make sense. There has to be some continuity between the two."*

### There were three vocabularies and nobody had lined them up

| Master | Gate 3 row | Gate 4 card | Gate 5 chip |
|---|---|---|---|
| images | Image | **Quote card** | **Card** |
| article | Article | The article | Article |
| texts_list | Numbered rules | Numbered rules post | **Rules** |
| shorts | Video / Reels / TikToks / Shorts | Script, 3 hooks one body | Video / Reel / TikTok / Short |

The single image was the worst: three words for one thing. He was right that "card" is not Instagram's word for anything.

**The rule now.** The master's canonical name matches its Gate 3 row exactly, and the detail about how the thing is made moved out of the name into its own line, so `Script, 3 hooks one body` became **Video** with *one script, 3 hooks and one body* underneath. The name says what it is; the line says how it is made.

**The one exception, and it is not an inconsistency.** A video is a **Reel** on Instagram, a **Short** on YouTube and a **TikTok** on TikTok. That is each platform's own vocabulary, and a per-network chip should use it. The test allows a chip to be the singular of a Gate 3 row for exactly that reason, and allows nothing else.

**The card reads its name off the master, not off `piece.title`.** A piece created before today has "Quote card" baked into its stored title, and it would have kept showing that until its kit was re-confirmed. Reading the name off the master makes every card right immediately with no migration. The narrative's headline is already at the top of the screen, so repeating it on every card was noise.

### The platform marks

Marrs: *"the sectioning and branding that is linked to Instagram should be carried across to Gate 4 as well, but not necessarily hierarchical... just make that a little more pronounced so the LinkedIn logo is sitting in there so I can see what's Instagram and what's LinkedIn. You can keep it in whatever order you see fit."*

The text line D49 added ("LinkedIn · Instagram · TikTok · YouTube · 10 posts") became the actual glyphs, using **the same `PlatformIcon` component the calendar already uses**, so there is one glyph set across the console rather than Gate 3's text marks in one place and something else in another.

**Not hierarchical, as he allowed.** The cards stay in production order, video first because it is the long pole, and the marks say where each one goes. Grouping by platform would have buried the ordering that actually matters, which is what to make first.

So the video card carries four logos and a `10`, the carousel and the image carry Instagram, and the article and the three text frames carry LinkedIn. Which also makes the carousel's Instagram-only state visible at a glance, since the LinkedIn document is still blocked.

Locked with 103 new assertions: for every lane and every master, the Gate 4 name must be one of that master's Gate 3 rows, and every chip must be a known name or the singular of one.

---

## D55: Three looks, and the picker that makes them reachable

**Adopted 26 August 2026.** Marrs: *"What I realised that's missing from here is some templates, some stylistic templates, so the user can choose out of three different styles... Each needs to be on-brand graphically, with minimal text and a small image. One of them can be sort of full-image generation."*

### All three already existed and all three were unreachable

The plan carried a `template`, the generation prompt branched on it, and the compositor had three separate compositions written for it. **No screen ever set it.** So every set ever made fell back to `LEGACY_TEMPLATE`, which is the full frame, and the other two were dead code that typechecked.

It was worse than one missing field. The render call was sending the slide's own fields and **none of the plan's**: no `template`, no `accent`, no `kicker`, and no `total`. So `total` defaulted to 1 and every slide ever rendered came out with no `03 / 10` index and no standing label. The footer the compositor draws had never appeared in production.

### The three

Proved by rendering, not by reading, because Satori fails silently on CSS it does not support: an unsupported property does not throw, it stops drawing, so a template can typecheck and come out with no accent seam and no footer. `npm run proof:slides` writes one PNG per look and all three draw.

| Look | Photo | Generations for ten slides |
|---|---|---|
| **Statement plate** | none | 0 |
| **Split card** | in a window up top | 5 |
| **Full frame** | edge to edge | 10 |

**Split card is the default for a new set.** It is what he described as the requirement, minimal text with a small image; the full frame was the thing he allowed as one of the three, not the thing he asked for. `LEGACY_TEMPLATE` stays `full` and that is not a contradiction: it is what plans written before templates existed were actually drawn as, and reading one back as anything else would redraw finished work.

### The picker draws the layout instead of describing it

"Statement plate", "Split card" and "Full frame" mean nothing until you have seen one, and Marrs has said plainly that he cannot pick from prose: *"I can't imagine this, so just build me a simple clickable version."* So each option carries a 4:5 schematic of its own layout in brand colours at the real slide ratio.

A schematic and not a rendered sample: a sample is one headline at one length, it weighs a megabyte in the repo, and it goes stale the moment the compositor changes. The diagram is drawn from the same facts the compositor uses, so it cannot promise a small photo and deliver a full bleed one.

Each option also says what it costs, because ten generations is a coffee break and that is worth knowing before the choice rather than after.

### Changing the look later is usually free, and says so when it is not

The template decides what April was asked for, so switching is not symmetric, and the asymmetry is real rather than a limitation:

- **Free (`reset`)**: the words and photographs the set already has carry the new look. Every made slide is redrawn from the background it already has, which spends no generations and takes seconds. The fitter resizes type that no longer fits, which is what it is for.
- **Costly (`rewrite`)**: a statement plate has no picture briefs in it at all, so it cannot become a photo look without someone writing the scenes. The option itself says *April writes the set again* in amber, and it asks before it throws the words away.

A full frame needs a brief on **every** slide, since it generates for every slide and a slide with no subject generates something arbitrary. A split needs only one anywhere, because a split slide with no prompt is a deliberate type-only slide and draws as a plate.

One predicate decides both the count on the screen and the loop that does the work, so the button cannot promise "nothing is generated" and then spend ten generations.

### Two controls removed for lying

The **Size** select did nothing: the fitter sizes type to the words it was given, and it cannot honour a fixed size and still fit. **Where the words sit** is honoured by the full frame alone, so it now appears only on a full frame set. A control that does nothing is worse than no control.

29 new assertions, 243 total: the specs and the ids are the same three, the cost maths, the full switch matrix in both directions, and the template surviving a save and reload.

---

## D56: Four heroes at 4:3, big enough to see, and one of them is the look

**Adopted 26 August 2026.** Marrs, on the D51 hero panel: *"I like on gate four how it starts with the look. I think that's cool. What I would like there is that the prompt generates four images, and then you choose the one you want. Make those 4:3 ratio for the prompt, and I've done this, and it comes up very small. I can't see the image or click on it. I can't interact with that image. It just says 'not saved' at all. I need the images to come up clearly, and if I click, it enlarges them so I can see them properly, and then I select one."*

Three separate complaints, and all three were true: one candidate where he wanted four, the wrong shape, and a 64 by 80 thumbnail with the words "Not saved yet" beside it and nothing to click.

### 4:3 was available the whole time

The obvious read was that Soul could not do 4:3, because `SOUL_SIZES` in this repo lists four sizes and none of them is 4:3, under a comment saying values **must** come from Higgsfield's allow-list. That comment is true and the list is not the allow-list: **the SDK's `SoulSize` has 13 entries**, and two of them are 4:3. `2048x1536` is `SoulSize.LANDSCAPE_2048x1536`.

So this needed no crop, which is the part that matters: a crop would mean the photograph he picked is not quite the photograph he gets. The repo's list is now labelled as the curated subset it is, with 4:3 added, and a test asserts every offered size against the SDK's enum rather than against a list in this repo. **That assertion cannot be made by reading.** A size Soul does not recognise is a 400 minutes into a wait, and it typechecks, lints and deploys on the way there.

### The hero is no longer cropped to the post frame

D51 ran the hero through `renderAndHostOverlay` with empty text, which forced it to exactly 1080 x 1350 so it could be used directly as the image on a post rather than only as a style reference. At 4:3 there is nothing to force, so that step is gone and the hero is stored byte for byte as the model made it.

**What that costs:** the hero is landscape now, so it is not a ready made Instagram 4:5 image. That is the right trade. The priority 1 flow is text plus image on LinkedIn, where 4:3 is the better shape anyway, and it is still a real library asset attachable to anything. What it loses is being pre-cropped for Instagram, which nothing was relying on yet.

### All four are copied into our bucket before they are shown

A Higgsfield url is temporary, and `/media/add` stores a url and nothing else, so anything registered straight off their CDN is a library entry that works today and 404s later.

The alternative shape, hosting only the one he picks, means the client hands the server a url and asks it to go and fetch it, which is a request forgery hole for the sake of not storing three small files. So all four are mirrored on the way back, the candidates he judges are the files that get used, and the three he rejects are unregistered bytes in a bucket that nothing points at.

Byte for byte, through a new `mirrorImageToHost`, not through the compositor: `renderAndHostOverlay` re-encodes to PNG at a frame you give it, which is right when the point is to compose something and wrong when the point is to keep exactly what the model made. It sniffs the type from the bytes when the CDN does not declare one, because refusing a good JPEG over a missing header reads as "the image could not be saved" and sends someone hunting through the generation code.

**Known and separate:** the media library has the same durability problem and this does not fix it. Images generated there are registered as raw Higgsfield urls. Logged as its own item.

### The interaction he described, exactly

Four candidates, two across, each at 4:3 and roughly 290px wide in the gate's 620px column. Clicking one opens it full size, up to 1200px, where the choice is actually made. Nothing about a click is irreversible: the tile enlarges, the viewer commits.

- Each tile also carries its own `Use this one`, so an obvious winner does not need the round trip.
- The hero that is already set gets the same treatment at 260px and opens in the same viewer, because "is this still the right look" is a question you answer by looking at it.
- That viewer shows `Use this one` only for a candidate. The one already set has nothing to choose.
- Escape closes it, the backdrop closes it, and the close button takes focus, matching the console's other modals.
- One across at 375px, because two 4:3 pictures on a phone is two small pictures, which is the complaint again.

"Not saved yet" is gone. It was answering a question nobody asked; what he needed to know was that there were four and that he had to pick one, which is what the line says now.

### The cost, said out loud

Four generations per attempt instead of one. That is the right trade here and only here, because this is the ONE image the whole narrative is generated against, so the minutes spent settling it are paid back across every slide and post that follows. Nothing else in the console generates a batch.

### Amended the same day, on the first real run: the white was generated

Marrs, with four candidates on screen: *"they're all in really weird aspect ratios for some reason. There's this white space, which I don't like. But the images are coming out good."*

Every file came back at the 4:3 that was asked for, so the canvas was never wrong and neither was the layout: each photograph was floated on a white field INSIDE a correct 4:3 frame, at a different size and shape each time, which is why the aspect looked random.

**The prompt asked for it.** The tail said *"leave clear negative space with low detail and low contrast where a caption could sit"*, and his own prompt opened with *"a hyper realistic, historically accurate black and white photo"*. Those two together are a fair description of an archival PRINT: a photograph mounted on white card. So the model drew the mount, correctly.

That instruction was inherited from the slide path, where type is composited over the image and quiet space is the entire point. **A hero carries no type** now that it is not cropped to the post frame, so the rule is inverted here rather than softened, and it names the failure mode explicitly, because "fill the frame" on its own does not rule out a picture of a picture: no border, no margin, no mount, no paper edge, no vignette, *this IS the photograph, not a print or a scan of one sitting on a page*.

The lesson worth keeping: an image prompt inherited from a different composition is a prompt written for a different job. The no-words rule travelled correctly because Soul cannot spell anywhere. The negative-space rule did not.

**Four is not a number that can be tuned either.** Soul's `BatchSize` is exactly `{SINGLE: 1, QUAD: 4}`, so a 2 or a 6 would be another 400 minutes into a wait. Asserted against the SDK enum alongside the size.

13 new assertions, 256 total.

---

## D57: Post copy is plain text, and the asterisks are stripped as well as forbidden

**Adopted 26 August 2026.** Marrs: *"in the written pieces, don't use any star symbols for bolding because that doesn't work here."* His article opened with `**The Future nobody Can See**`, asterisks and all.

### The article was markdown on purpose, and nothing ever rendered it

This was not April going off script. The article prompt said, in as many words: *"SHAPE. Markdown. The first line is a bold title (**like this**)"*. She was doing what she was told.

Nothing in the pipeline renders it. The article sits in a textarea at Gate 2, it is fed to April as source material for every piece cut from it, and it publishes as written. `ReactMarkdown` exists in this codebase and is pointed at exactly one thing, concept docs, which are freeform markdown by design and are never posted. So the article's asterisks were only ever four characters wrapped around a headline on their way into a post box.

He is right about the platforms too. LinkedIn, Instagram, TikTok and YouTube captions have no rich text: what goes in the box is what people read.

**So the article is plain text now.** First line is the bare title, then a blank line, then the article. To give a line weight: put it on its own line, or use caps for a short label.

### Both halves, like the em-dash rule

The instruction stops most of it and a model under a long prompt still reaches for a heading now and then, so the strip is what makes it never reach a post. `stripMarkdownEmphasis` sits beside `stripEmDashes` and runs in the same four places: the draft writer, the script writer, the article writer, and **April's chat edits**. That last one matters: without it the asterisks come straight back the first time he asks her to change a line, and the rule would only hold until he talked to her.

### Where it is deliberately NOT applied

`NO_EM_DASH_INSTRUCTION` is appended to every system prompt in the app from `lib/llm/index.ts`. The markdown rule is not, and must not be, because that would tell the **concept writer** to stop writing markdown, and concept docs are markdown that gets rendered.

The other exclusion is sharper: **a slide headline marks its accent phrase with `*single asterisks*`**, parsed by `parseLine` and set in the brand colour. Stripping that would silently kill every highlight in every carousel. Slide copy comes back through slide-propose's own `cleanField`, so it never touches this, and there is a test that spells out what would break if anyone wired it in.

### The stripper is tested on what must NOT change

The risk in a regex like this is never the marker it misses, it is the character it eats. Emphasis content must start and end with a non-space, and single underscores need word boundaries, which is what keeps all of these intact: `5 * 3 * 2`, `hero_url and hero_media_id`, a `* one / * two` bullet list, `ranked #1`, `#nofilter`, and the lone `(marked *)` this very console prints on a fallback slot.

24 new assertions, 278 total.

---

## D58: A narrative is at one gate. Its pieces are not.

**Adopted 26 August 2026.** Marrs: *"I'm just realising that, on the dashboard, the gate steps that we create are a little more nuanced. After gate four, you could have two or three pieces that are on gate five, but you still have some on gate four. Maybe we need a way to mark how many pieces are just little dots on step five and how many are in step four."*

He is right and the model could not say it. A narrative has one `gate` field, so the D50 bar shows one position, and after Gate 3 a narrative is not one thing any more: it is seven pieces that finish at different times. "Gate 4" on a row could mean one piece left or all seven.

### Dots, under the gate they belong to

One dot per piece, on the same five columns the bar uses, so the answer to "what is left" is read in the column named Create rather than in a summary line somewhere else.

- **Under Create**: a hollow dot for every piece still being made.
- **Under Ship**: a solid mint dot for every piece that has cleared it.

Two shapes rather than two shades, so the columns read differently out of the corner of your eye.

**`ready` is `cardState`'s own definition**, the same function the Gate 4 cards use: the words exist AND the media is attached. So the dots and the cards can never disagree about what is finished, which they would within a week if this had its own rule.

**Capped at ten, then a number.** The default kit makes seven pieces, so dots are right at this scale; past ten nobody counts them and the overflow would also crowd out the word beside them.

**A shipped narrative gets no dots at all.** Every piece is behind Gate 5, the bar already reads solid and the label already says shipped, so sixteen dots would be ink for nothing. It was also the only case that overflowed its column, which is how the redundancy got noticed.

**Nothing before Gate 4 gets them either**, because there are no pieces yet, and a row with an empty count line reads as missing data rather than as an early gate.

### The load that came back

D48 removed three store reads from this page, one of which was every saved piece, on the reasoning that three serial loads were paying for sections that render nothing. This adds one of them back, because the distribution genuinely lives on the pieces.

It is not a reversal of that reasoning: it starts before the existing parallel block so it overlaps rather than adding a round trip, and it degrades on its own. If the piece list fails, the bars render exactly as they did and only the dots go missing.

---

## D59: What it looks like on the platform, on the right, while you type

**Adopted 26 August 2026.** Marrs: *"What I would like here is a preview of what it would look like on the actual platform. I know that Metricool offers this in the platform. Down the right-hand side, when you change stuff, you can actually see what it's going to look like at the end... as an individual, I'd want to see how that's going to look on the actual platform. It probably should be in the place where I'm editing the piece, so if I'm editing on the left, I can see on the right what it's going to look like."*

And on the layout: *"We could possibly move the context chat down to the bottom left, like most AI platforms now, like Replit... I would say move the context chat to the far left side. You have what you're editing in the middle, and then what it looks like on the right. I think that's a better layout."*

### The Metricool question, answered: no, and it does not matter

He asked whether we could pull it from them. **We cannot.** Their preview is a feature of their own web app, not something the API renders. Their OpenAPI spec at `app.metricool.com/api/swagger.json` has 527 paths covering scheduling, analytics, timelines and best times, and nothing that returns a rendered post. No social API offers this, because a preview is a view and not data.

That is the better answer anyway. Ours can show the fold against figures **this console already holds sources for**, it works before anything is connected to Metricool at all, and it cannot drift out of sync with what we are about to publish, because it renders the same fields the publisher sends.

### The fold is the whole point

A preview that only restates the words is a second textarea. The one fact it carries that nothing else on the screen does is **where the post folds**, because everything past the "see more" is read only by people who already decided to read on.

Every number traces to `docs/pam-console/output-spec.md`, and the sourcing goes with it:

| | Fold | Source |
|---|---|---|
| LinkedIn | 140 characters **or three lines**, whichever comes first | Third-party consensus, no official figure |
| Instagram | 125 characters | Third-party, matching Meta's own ads guide |
| TikTok | **none drawn** | The spec says NO DATA, claims span 55 to 150 |

**The line rule is the part that earns its keep.** A post written in the LinkedIn house style, short lines one idea each, can be 120 characters and still fold after the third line. A character-only preview would have told him the whole thing was visible. The panel says which limit bit: *"120 characters before the fold, cut by the line breaks rather than the length."*

**TikTok gets no fold line, and that is the decision rather than an omission.** An invented figure would be worse than none, because he would write to it.

The stricter of LinkedIn's two figures is the one previewed. A hook that survives the mobile fold survives desktop; the reverse is not true, and the panel says so underneath: *"Desktop shows about 210 characters."*

### Deliberately not a pixel copy

It is the platform's SHAPE: who posted, the copy with its fold, the image at its real aspect, the furniture underneath. Chasing LinkedIn's exact type stack would go stale the next time they reskin and would tell him nothing this does not.

Two things it does get exactly right, because they change the answer:

- **The card is light while the console is dark.** Both feeds are light surfaces, and previewing light-on-dark would misrepresent the one thing the panel is for.
- **Instagram is image led**: the picture comes first and the caption sits under it, because that is the actual difference in how the two feeds read. Behind the fold is faded almost out rather than cut, so the shape of what is being hidden stays visible.

The images resolve **by walking the selected ids**, not by filtering the library, because `publish.ts` resolves ids in array order: filtering would show him a different first image than the one that ships.

### Three columns, and DOM order is not column order

Chat far left, the editor in the middle, the preview on the right, exactly as he described.

The document order is **editor, preview, chat**, which is the right order on a phone and the right tab order anywhere: you write, you check it, then you talk about it. Only the wide layout moves the chat left, with `order`, because the middle column is where your eyes should land when three are open.

Three breakpoints rather than two, because three columns under about 1240px are all too narrow to be worth having:

- **Under 1040**: one column, stacked in document order.
- **1040 to 1239**: two columns, and document order decides which two: the editor and the **preview**, with the chat wrapping underneath. The preview is the panel that has to stay beside what you are typing; a docked conversation reads perfectly well below it.
- **1240 and up**: the three columns.

### Only the text screen, on purpose

Text plus image is his stated priority 1, and it is the flow where the fold decides whether the post works. The slide run already shows the finished slide full size, which IS its preview, and a video piece has nothing to preview until it is cut. `workspace3` is applied on one screen; every other screen keeps the two-column rule untouched.

23 new assertions, 301 total.

---

## D60: A generation goes into our bucket before it is registered anywhere

**Adopted 26 August 2026.** Found while building D56, fixed overnight with his approval.

Images generated in the media library were being registered as **raw Higgsfield urls**. Those expire. Every one of them was a library entry that worked the day it was made and would 404 later, with nothing to say why.

### Why the fix is in `/generate` and not in `/add`

The instinct is to fix it at the door, in `/media/add`, since that is where an asset becomes real. That would be wrong. `/add` storing a url and nothing else is a deliberate decision (D2, amended 2026-07-14): an asset is a **reference** to a file hosted somewhere, which is exactly right for the Box links this console was built to accept.

Auditing all four routes that hand a url to the library found exactly one hole:

| Route | What it returned |
|---|---|
| `/media/edit` | `hostGeneratedImage`'s url, ours |
| `/media/overlay` | `renderAndHostOverlay`'s url, ours |
| `/media/generate` | **a raw vendor url** |
| hand-pasted in the library | a reference, by design |

So one route was out of step with its own two siblings, and fixing it there keeps `/add`'s contract intact and needs no `mirror: true` flag from a client that might forget to send one. A rule enforced by the route that creates the file cannot be forgotten by a caller.

Mirrored through `mirrorImageToHost`, the helper D56 added: byte for byte, in parallel, and a failure loses one image out of a batch rather than the batch. When every copy fails the error says so, because the images do exist and the storing is what broke, and a message that only says generation failed sends the next reader into the model code.

### What this does not do

**Nothing repairs the entries already saved.** Anything registered before today is still a temporary url, and there is no scan or migration. A library image that has stopped loading has to be regenerated, and that is recorded in the todo so nobody goes looking for a bug in the picker.

---

## D61: A time and its timezone are one fact, so they travel together

**Adopted 26 August 2026.** Todo item 11, fixed overnight with his approval.

`scheduled_at` is **local wall-clock, never UTC**, because that is what Metricool takes: a `YYYY-MM-DDTHH:mm:ss` paired with a separate IANA zone. A wall-clock time without its zone is not a time.

The console held two zones for one post:

- The wave picked the slot from **the lane's channel schedule**, whose `nextOpenSlots` has always returned `{ dateTime, timezone }` pairs, described in its own comment as "ready for the create call".
- `publishEntry` then read the zone off **the stream's posting schedule**, a different setting stored under a different key for a different feature (Add to queue).

The wave kept `slot.dateTime` and threw `slot.timezone` away. Both settings default to `Australia/Sydney`, which is the only reason this never showed: change one and not the other and the post the grid labels the morning video goes out in the afternoon. Typed slots (D46) made that categorical rather than cosmetic, because a slot now means "the morning video slot" and not just a time.

### The fix is a stamp, not a lookup

`CalendarEntry.timezone` is set when the time is set, and publish sends that. Not "read the right config at ship time", because config read late is the whole class of bug: it also means changing a lane's zone silently reinterprets every wave already planned.

**This is the same discipline `publish_mode` already had**, whose comment says it in as many words: *"Stamped now, not read at ship time: changing the lane's setting later must not silently rewrite how an already-planned wave goes out."* The timezone deserved identical treatment and was simply missed.

Stamped in all three places a time is chosen: the wave on create, the wave on **repair** (the date moved, so the zone that chose it moves with it), and Add to queue, which stamps the posting schedule's zone because that is the one that produced its time.

### The fallback is deliberate and conservative

An entry planned before today has no stamp, and falls back to exactly the config it would have used. Their behaviour is unchanged rather than reinterpreted, which matters because some of them are already live in Metricool.

The resolution rule is one line, so it lives in `posting-schedule.ts` as `timezoneForEntry` rather than inline in the publish path where no test can reach it. A blank stamp counts as absent, since a stored empty string would otherwise be sent to Metricool as the zone.

10 new assertions, 308 total.

---

## D62: Two image providers, because Soul cannot spell

**Adopted 26 August 2026.** Marrs: *"What image model is being used for the images in the gate for the look section? It's very inconsistent, especially in the text. I'd rather use Nano Banana Pro. Actually, that's the model I want to use, but let me know what model is being used at the moment."* Then: *"there is a Nano Banana too, and in OpenRouter, its Model ID is: google/gemini-3.1-flash-image"*

### The answer to his question

**Higgsfield Soul, and it was the only image model in the console.** One entry in `IMAGE_MODELS`. Every image in PAM came from it: the hero, every carousel slide, everything in the media library.

**The text is not inconsistency, it is a hard limit.** Soul is photoreal-people-focused and cannot render legible type. That is so settled in this codebase that every image prompt ends with *"no text, no words, no letters, no numbers, no logos and no signage"*, the entire slide compositor exists to draw brand type in code instead, and the registry has a `goodForText` flag that no model set to true. An 1882 New York street is the worst case for that instruction, because the reference material is covered in signage, so the model paints lettering anyway and it comes out as gibberish.

### Both ids were verified, not remembered

`image-edit.ts` carries a note saying *"The 3.x image previews 404 on this account's OpenRouter access"*, which is exactly the kind of thing that turns into a wrong string shipped. So both ids were checked against OpenRouter's public model list, which needs no key and costs nothing:

| id | Their name for it | Per image out |
|---|---|---|
| `google/gemini-3.1-flash-image` | **Nano Banana 2** (Gemini 3.1 Flash Image) | $0.00006 |
| `google/gemini-3-pro-image` | **Nano Banana Pro** (Gemini 3 Pro Image) | $0.00012 |

His id is real, and their own name for it is Nano Banana 2. The stale note was about the **preview** ids, which are separate strings; these are GA. Both are registered, because his two messages named both and one line of registry each is cheaper than a second conversation.

### The providers are not one shape, and that decided the design

The same public list settled the parameter question, which is the load-bearing fact here: **`supported_parameters` for both Gemini image models is seed, temperature, top_p, max_tokens, reasoning and response_format. Nothing about dimensions.**

| | Higgsfield Soul | OpenRouter Gemini |
|---|---|---|
| Size | exact, from a 13 value allow-list | **no parameter at all** |
| Four candidates | one request, `batch_size: 4` | four requests |
| Aspect guarantee | the API | prompted, then cropped in code |

So a flag on one interface would have been a lie. `image-generate.ts` is the one place that knows there are two, and every caller asks it for a **frame in pixels**: Soul gets the nearest native size by aspect, and an OpenRouter result gets cropped to exactly the frame through the overlay compositor's crop path, which is already in production on the media library's overlay route. That keeps the promise D56 made when it stopped cropping the hero: what he judges on screen is what is stored.

### It always returns urls we host

Which makes D60 structural rather than remembered. A caller **cannot** get an ephemeral vendor url out of `generateHostedImages`, so it cannot register one. The bug fixed this morning is now impossible to reintroduce by adding a fourth caller.

### The key check moved below the model

Both generation routes used to refuse before knowing which model was asked for, so a Gemini model, which needs only an OpenRouter key, would have been turned away for a missing Higgsfield one. Now each provider is checked for its own key, and the error names which key and offers the other model.

### Untested against a live call, deliberately

His overnight guardrail was no credits, and there is no OpenRouter key in this worktree, so **no image has been generated through this path**. Everything structural is asserted (27 new assertions, 335 total) and the request shape is copied from `image-edit.ts`, which is proven against production against the same endpoint with the same `modalities` field. What remains unproven is whether his OpenRouter key has access to these two models, which is one click to find out and returns a named error rather than a silent failure if it does not.

The carousel slide route stays on Soul for now. Its type is composited in code anyway, so text rendering buys it nothing, and switching it would change the look of every slide already made.

---

## D63: An autosave that checks two of its seven fields is an autosave that lies

**Adopted 26 August 2026.** Todo item 14, fixed overnight with his approval.

The Script screen's save loop built its PUT body from **seven** refs and then re-checked **two** of them. A change to the title, the treatment, the hooks, the arc or the concept-read that landed while a PUT was in flight was never re-sent, and the indicator went to Saved anyway.

### The exact window, reproduced

The debounce hides most of it, which is why this survived: a mid-flight change usually re-arms the 1000ms timer and a second save runs after the first finishes. The hole is the path where **that nudge is swallowed**:

1. An edit starts a PUT.
2. Mid-flight, another field changes and the field is **blurred**, which is what clicking any button does.
3. Blur calls `flush()`, which **clears the debounce timer** and calls `save()`.
4. `save()` sees `inFlight` and returns early. The timer is now gone, so nothing will re-arm it.
5. The loop's own re-check is the only rescue left, and it was looking at the wrong two fields.

Which is exactly the symptom recorded in the todo: agree a hook, press "Propose the arc", and the arc call refuses with the hooks visibly ticked on screen, because the server was never told.

Reproduced against the real component with a stubbed slow PUT, then re-run after the fix:

| | PUTs | The title that landed | Indicator |
|---|---|---|---|
| Before | 1 | the stale one | Saved |
| After | 2 | the mid-flight change | Saved |

### The fix restores a property rather than adding a check

**The image screen never had this bug, for one reason: it holds its whole state in a single ref**, so its one comparison covers everything it can write. That is the property, and it was lost on the Script screen by having seven refs and remembering two.

So the seven are gathered into one `snapshot()`, **the PUT body is built from that snapshot**, and the snapshot is compared whole. A field cannot be sent without also being checked, which means adding an eighth field to this screen cannot reintroduce the bug. That is worth more than the fix itself.

Compared by **value**, not by reference, which is the second half: `hooks`, `media` and `concept_read` are arrays, so a setter that mutated one in place was invisible to the old `!==` while one that rebuilt it with identical contents caused a pointless resend. Stringifying a seven field object twice per save costs nothing measurable.

### The Text screen was audited, not assumed

It captures all three fields it writes and re-checks all three, so a mid-flight change to any of them is caught. Left alone.

---

## D64: The narrative lock guards the narrative. The calendar needed its own.

**Adopted 26 August 2026.** Todo item 10, fixed overnight with his approval.

The wave route already held a lock, on the **narrative**, and it stays: it was a real fix for a real double-publish, where a dropped browser fetch plus a retry click started a second full run and posted the same drafts twice.

It cannot stop the other collision. Two **different** narratives on the same stream, planned in two tabs inside the same run, each take their own narrative lock and then both do this:

```
read the calendar  ->  work out which slots are free  ->  write entries into them
```

Both reads happen before either write, so both see 07:00 free and both take it. The stream is double-booked with nothing on screen to say so, and the first signal is two posts going out at once, days later.

### The lock belongs on the thing being protected

Which is **the lane's calendar**, not the narrative. So the lane gets its own lock file, taken after the narrative lock and released before it, so the pair nests. Two narratives on different streams cannot collide and are not blocked; two on the same stream take turns, and the second one sees the first one's entries when its turn comes, which is exactly the read it needed.

**Why not optimistic re-checking**, which was the other candidate and what the todo suggested: re-reading the calendar before every save costs a store read per entry, up to sixteen on a default kit, and it still cannot make read-compute-write atomic. It narrows the window for more work. Taking turns closes it.

### Three ways to get a lock wrong, all three tested

- **It expires.** Two minutes, the same window the narrative lock uses, because a crashed run must not wedge a whole stream forever.
- **A run can re-enter its own.** The holder's narrative id is recorded, so a retry inside the window is not refused by the lock it set itself. That would have been a worse bug than the one being fixed.
- **A lock that cannot be read counts as free**, and a malformed one parses to nothing. Guessing "held" produces a stream nobody can ever plan; guessing "free" produces the rare collision this exists to reduce. The narrative lock is still underneath either way.

There is a fourth, and it is in the release rather than the acquire: **release only if it is still ours**, or a run whose lock expired would clear the lock of the run that has since taken over.

### It fails open on purpose

If the lock file cannot be written, the run **goes ahead unlocked** rather than refusing. This is a collision reducer, not a correctness gate, and turning a rare double-booking into a common outage would be the wrong trade. The one thing that must not happen is a narrative that cannot be laid out, so the narrative lock is released before the 409 as well, or a clash would wedge this narrative for two minutes over someone else's run.

12 new assertions, 347 total.

---

## D65: Upload an image, and be straight about why video still cannot

**Adopted 26 August 2026.** Todo item 1, the one it calls *"the last hard gap between Gate 4 and a published post"*, fixed overnight with his approval. Half of it.

A media asset is a url reference only (D2, amended 2026-07-14), so getting a picture into the library meant hosting it somewhere else and pasting the link. There is now an **Upload an image** button above the paste field.

### Presigned, because a phone photo breaks the alternative

Vercel caps a serverless request body at **4.5MB**. A photo off a phone clears that on its own, so a route that accepts the bytes would fail on a fraction of real files with a platform error nobody can act on.

So the browser asks for a short-lived presigned PUT and sends the bytes **straight to the bucket**. The size limit becomes ours to choose rather than the platform's to impose, and no Vercel function ever holds the file.

Three properties worth keeping:

- **The server owns the key.** It is a fresh uuid, because the filename is the whole security surface: nothing a caller sends can walk the path, collide with an existing object, or make the serving route emit something unexpected. The browser's filename is used for the **label** only, which is text.
- **The signature commits to the content type.** The browser must send exactly that header or the bucket rejects the PUT, so a url issued for a png cannot be used to store something else.
- **Registration is last.** The upload lands, and only then does `/add` record it, exactly as a generated image does. An abandoned upload leaves bytes nobody points at, never a library entry pointing at nothing.

### Video is refused, and this is the honest part

Uploading a video would work. **Serving it would not.** `/console/generated/[stream]/[file]` reads the whole object into memory and returns it, which is right for a 2MB picture and wrong for a 500MB video, and the bucket is private so there is no direct url to hand out instead.

**That is the actual reason this console uses Box for video**, and it took building the upload to see it clearly: the gap was never the upload, it was the delivery. So a video is refused at the file picker, before any network call, with the reason and the workaround in the message rather than accepted and later discovered to be unplayable.

**This needs a decision from Marrs, and it is an infrastructure one, not a code one.** Three options, in the order I would pick them:

1. **Vercel Blob.** Public urls by default, built for exactly this, and Metricool could fetch a video directly. New integration on his account.
2. **A public prefix on the existing bucket.** A bucket-policy change so `pam/public/` is world-readable, then hand out the direct url. Cheapest, and it means one of our prefixes is genuinely public.
3. **Stream through the route with Range support.** No infrastructure change, but fragile at Vercel's response limits and the worst of the three for a big file.

Until then Box stays the video path, which is what the hint under the paste field has always said.

### One new dependency

`@aws-sdk/s3-request-presigner`, the official companion to the `@aws-sdk/client-s3` already installed. Checked before and after: **`npm audit` reports the same 6 pre-existing high findings either way**, all in `ws` and unrelated, so this added nothing. Those six are worth a look at some point and were left alone tonight, because an `audit fix` unattended is how a build breaks.

24 new assertions, 371 total.

---

## D66: The analytics panel, at the bottom, honest about being a mock

**Adopted 26 August 2026.** Todo item 7, built overnight with his approval.

Marrs: *"on the main engine page, where it shows everyone, so it's an aggregation of all those stats. And when you go into each of the streams, each one of those streams has an analytics section also. I think it's always going to be the thing at the bottom, because you don't want to look at that first... I'd at least like a mock-up there at the moment, and we're talking about as much data as we can and making it as visual as possible."*

Both places, both at the bottom, below the ideas box on a stream board.

### Every field is one Metricool actually returns

That is the whole discipline of a mock: it is a **promise about what the real panel will show**, so inventing a metric their API cannot give us would be designing a screen we then have to take away. The four tiles and the two table columns map to documented per-post fields: LinkedIn impressions, clicks and engagement; Instagram reach and follows-gained-from-a-post.

What is still unsettled is named on the panel itself: whether `ProviderStatus.id`, which this console stores as `external_ref` when it schedules, is the same id the analytics endpoints take as `postId`. They are documented separately and nowhere stated to be the same, and that single question decides whether any of this can be tied to **our** posts. One authenticated call answers it (todo item 8).

### The form was picked before the colour

Which is the step that usually goes backwards:

- Four headline numbers are a **KPI row of stat tiles**, each with a 12 point sparkline. Not the grouped bar chart four numbers usually get turned into.
- Four networks compared is **horizontal bars**: magnitude against identity.
- Five posts with mixed measures is a **table**, which is also the panel's table view, so nothing is gated behind reading a chart.

**One hue, and identity comes from the logos.** Every mark is mint; the networks are told apart by their own `PlatformIcon` and their name, never by colour. That is stronger than a colour key, and it protects the one colour semantic the brand has: coral is human, amber is hybrid, mint is agent, so spending those four on LinkedIn, Instagram, TikTok and YouTube would quietly remap it.

The house mark specs are applied rather than approximated: a 4px rounded data-end square at the baseline, a 2px line with round caps, an end marker of at least 8px carrying a 2px surface ring, an area wash at 10%, hairline recessive furniture, the value labelled only at a bar's tip, and text always in text tokens with the coloured mark beside it. Proportional figures on the big tile values, tabular only in the table's number columns.

### Two things caught by looking at it rather than by reading it

**The numbers did not add up.** The first version generated the per-network split independently of the headline, so a tile said 95.3K beside four bars summing to 63K. For a mock that is not cosmetic, it is the mock failing at its only job: nobody trusts a panel that cannot add. The split is now a weighted division of the headline with the remainder going to the last bar, the five best posts are a fraction of the same total, and **a test asserts the sum on every scope**.

**The table pushed the page sideways** at 375px. It has a real minimum width, since two of its three columns are mono numerals that cannot wrap, so it scrolls inside its own container and the page does not. Dropping the third column on a phone was the other option and it drops data rather than just the view of it.

### Deterministic, not random

`Math.random` would produce a different number on the server than in the browser, which is a hydration mismatch rather than a cosmetic difference. Seeded off the scope name, so the Marrs panel also looks the same on every reload and a screenshot of it stays true.

The trend **wanders rather than climbs**, because a mock that only goes up teaches the wrong thing about what the panel is for, which is noticing when something stopped working.

47 new assertions, 418 total.

---

## D67: The first real Metricool call is a draft

**Adopted 27 August 2026.** Marrs: *"Let's fire Metricool for real, walk me through it."*

Todo item 2 has been the biggest thing on the board for weeks: the publish button has never been pressed against a real brand, so everything downstream of Gate 5 is theory. Walking him through it turned up the thing missing from the walkthrough.

### Every existing path publishes

Both routes into Metricool, `Add to queue` and `Schedule at set time`, call `publishEntry`, which hardcoded `draft: false` and therefore `autoPublish: true`. So the only way to find out whether the integration works was to put something on a real channel and watch.

**The client has always supported `draft`.** `schedulePost` takes it and sets `autoPublish: !draft`. Nothing ever passed it, so the capability was documented and inert, which is exactly the shape of gap D42 found with `firstCommentText`.

### What a draft proves, which is nearly everything

A draft lands in Metricool's own planner and publishes nowhere. It exercises the token, the brand id, the payload shape, the `providers` objects, the media urls being publicly fetchable, the date, and the timezone pairing. The only thing it does not exercise is Metricool actually pushing to the network.

**It also answers the analytics question for free.** The response id is stored as `external_ref`, and whether that id is the same one the analytics endpoints take as `postId` is the single unknown blocking the whole analytics panel (todo item 8). A draft produces one to compare, at no risk.

### Two decisions inside a small change

**A drafted entry keeps `draft` status.** It gets the `external_ref`, because the id is the point, but it must not read as `scheduled` or the calendar would claim something is live that is not, and every count downstream of it would be wrong.

**The default stays a real publish, and the flag has to be explicit.** A button that says Schedule has always meant schedule. Quietly drafting would be the more dangerous of the two mistakes: he would believe a wave had gone out when nothing had.

The two confirmations are deliberately different sentences. The draft one says where it will and will not appear, because knowing nothing went out is the entire value of it. The publish one names the channel and the date, because that is the part that cannot be taken back.

### One thing the walkthrough turned up about his own lane

On the `marrs` lane **LinkedIn is manual by default** (D41): he posts it by hand because scheduled LinkedIn posts lose reach. So a Metricool test on his own stream is Instagram, TikTok or YouTube, and a LinkedIn entry there will never be the thing that proves the pipe.

