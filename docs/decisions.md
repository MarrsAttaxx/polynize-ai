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

## How to add to this log

When you make a decision that future-you (or a cold agent) might be tempted to undo, add an entry: the decision, the context that forced it, why, and the consequence of violating it. The bar for inclusion: *would someone seeing this cold reasonably think it's wrong or improvable, when it's actually deliberate?* If yes, it belongs here.

---

## Change log

| Date | Change |
|---|---|
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
