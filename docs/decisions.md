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

## How to add to this log

When you make a decision that future-you (or a cold agent) might be tempted to undo, add an entry: the decision, the context that forced it, why, and the consequence of violating it. The bar for inclusion: *would someone seeing this cold reasonably think it's wrong or improvable, when it's actually deliberate?* If yes, it belongs here.

---

## Change log

| Date | Change |
|---|---|
| 2026-06-05 | Initial decision log: D1–D14 captured from the build history. |
| 2026-06-18 | D15: PAM → marketing engine; mapping/blueprinting to Cognitive Studio; Newkind/reMYnd/Roxbury repos hard-deleted (SOC 2 + off-boarding); EverStock retained. |
