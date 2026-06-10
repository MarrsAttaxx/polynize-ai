# PAM — Architecture

**What this doc is:** how PAM is built — the systems, the data flow, the repos, the conventions. Read this to understand the shape of the thing before changing it. Pair it with `decisions.md` (the *why* behind the choices here) and `glossary.md` (the vocabulary).

**Last updated:** 2026-06-05

---

## What PAM is, in three paragraphs

PAM (Polynize Agent Management) is the system that both *runs* Polynize as a business and *is* the delivery product for clients. It manages cognitive work units — teams of AI agents — across the engagement lifecycle. For each client engagement, PAM holds a **Blueprint** (the analysis of the client's business work, decomposed into capabilities and allocated across Human / Hybrid / Agent) and, once the engagement is ready, a **Statement of Works** (the commercial agreement, merged from the Blueprint data, that the client signs).

The human-facing surface is the **PAM Console**, a Next.js web app (the polynize-ai project, also serving the public polynize.ai website) deployed on Vercel. The Console renders each engagement's Blueprint and SoW, gated by role: the Polynize team sees and edits everything; a client sees only their own engagement, read-only, except for two narrow write paths (asking questions, and filling/signing their own SoW fields).

The data for each engagement lives as JSON + markdown files in a per-engagement GitHub repo. The Console reads those files live on each request and renders them. There is no separate database for blueprint content — **the repos are the source of truth**, and committing to a repo is how content changes. This is deliberate: it gives version history, auditability, and a clean contract for the eventual automated transform engine (Ben) to write into.

---

## The repos

All under the `polynize-agentic` GitHub org.

- **`polynize-ai`** — the website + the PAM Console, one Next.js app, one Vercel project. Deploys to production on push to `origin/main`. This is where all Console *code* lives.
- **Engagement repos** — one per client: `roxburys`, `everstock`, `newkind`, `remynd`. Each holds that engagement's Blueprint data and config. The Console reads these live.

### Engagement repo layout
```
modelling/
  capability-map.json      ← the capability decomposition + team
  engagement-model.json    ← per-capability current-state / benchmark / uplift + motions
  blueprint.md             ← the narrative sections (only 5 of these render in 2.0 — see below)
.polynize/
  client-config.yaml       ← engagement metadata (schema version, status, phase, RAG, etc.)
sow.json                   ← the Statement of Works data (generated + filled), once it exists
questions.json             ← the "Questions for Polynize" client-write section
timeline.json              ← project timeline (Build-phase engagements)
work-plans/                ← per-agent work plans (Build-phase engagements)
```

---

## The two-layer Blueprint model

A Blueprint has two conceptual layers that are **separate and not mapped 1:1**:

1. **The Engagement / analysis layer** (the capability map, benchmarking, uplift, next steps). This is **pre-agent business analysis**: it decomposes the client's business work into capabilities, each allocated Human / Hybrid / Agent, *before* any agents are designed. It answers "what work exists and where are the gaps."

2. **The Work Plan / team layer** (the agent team, the build sequence, the sprint stages). This is the **downstream** design that sits on top of the analysis — the agents that will do the agent-allocated work. It answers "what are we building and in what order."

These are distinct sections in the Console, deliberately. The capability map is *not* a list of agents; it's a list of business capabilities, some of which agents will eventually own.

### The data files
- **`capability-map.json`** holds: `scope_brief` (engagement name + statement + in/out scope), `interpretation` (the summary), `clusters` (groupings of capabilities), `capabilities[]` (each with allocation, work shape, failure cost, completeness, evidence, human_handoff, gaps), `allocation_summary` (the Human/Hybrid/Agent tally + percentages), `map_reflection`, `excluded_capabilities`, `delta_summary`, and `team` (the org chart).
- **`engagement-model.json`** holds: `rows` (one per capability — current_state, benchmark, uplift_needed, uplift_moves across people/process/AI, held flag) and `motions` (Training / Transform / Agent Deploy, each describing a class of work and which capabilities it covers).

### The team (CWU — Cognitive Work Unit)
Every engagement's team is **three tiers, always** (the CWU invariant — see `decisions.md`):
1. **Human accountable lead** — the client-side human who owns the engagement.
2. **Team leader agent** — coordinates the agent team, the connection point between Polynize / the client / the agent team, the reporting + escalation channel, the security layer (ACTA team-lead role). Auto-inserted on every team.
3. **Worker agents** — do the capability-allocated work.

In `capability-map.json`, the team is `{ human_owner: {name, role}, team_leader: "<exact agent name>", agents: [{name, role, short_desc}] }`. The `team_leader` string **must exactly match** one agent's `name`, or the org chart silently falls back to two tiers. The team leader is an *additional* agent on top of the workers (workers + 1 leader, within the 2–6 agent bound).

This 1 -> 1 -> N formation (human -> lead agent -> worker agents) renders in **both** the PAM Console blueprint and the **public `/agents` blueprint** (`app/blueprints/[id]/Team.tsx`) plus its in-flow Phase B reveal (`app/agents/PhaseB.tsx`). The public renderers read `team_leader` off the (adapter-passed) `CapabilityMapData.team`, draw the lead as the middle tier, and fall back to a flat human -> all-agents row if `team_leader` doesn't match an agent. (Before 2026-06, the public renderers ignored `team_leader` and always drew the flat fallback — that was the bug that showed a "1 + N" team instead of "1 + 1 + N".)

Live team leaders: Roxbury → Mable, EverStock → Scout, Newkind → Don, reMYnd → Joy.

---

## Schema: strict on generate, liberal on read

This is the single most important architectural principle (see `decisions.md` for the full rationale). There are **two schemas** for the capability map:

- **The strict GENERATION schema** (`capability-map-schema-v05.ts`, `ClusterTypeSchema = z.enum([...])`, `validateCapabilityMapV05`). This gates the website's intake/generation path. It is strict — it enforces the canonical shape, requires `team_leader`, bounds agent counts 2–6, etc. New capability maps generated by the website must pass this.
- **The lenient READ schema** (`schema-v2.ts`, `loadBlueprintV2`, e.g. `cluster_type: z.string()` free-string). This gates the Console's read/render path. It is liberal — it accepts the broader real-world vocabulary that comes from hand-built or transform-produced data, normalizing to canonical shapes on read.

The read type `CapabilityMapV05` is, by existing design, a re-export of the strict parsed type — so a field made *required* in the strict schema also types as required on the shared type, but the **runtime read path remains tolerant** (the lenient schema is what actually parses at runtime). Keep the read path tolerant; tighten only the generation gate.

**Why two schemas:** generation should produce clean canonical data (strict), but the render path must never break on real data that's slightly off-shape (liberal). Tightening the read path to match generation is the recurring mistake that breaks live blueprints.

---

## Readiness (the percentage)

Readiness is **phase-relative** — it measures progress through the *current phase's* work.

- **Build phase** (e.g. Roxbury): readiness = weighted progress through the active work plan's sprint stages. The 8 sprint stages have weights summing to 100 (front-heavy): Sprint Map (10) → Cognition Design (18) → Skills Design (12) → Cognition Install (15) → Skills Install (12) → Sandbox Testing (13) → Live Testing (12) → Handoff (8). Complete stages earn their full weight; the active stage earns its own progress_pct (or 50% partial credit). The sprint **ends at Handoff**; refinement is post-handoff in the Operate phase (not a tracked sprint stage).
- **Modelling phase** (e.g. EverStock, Newkind, reMYnd): readiness = `0.80 × analysis_completeness + 0.20 × (blockers_resolved ÷ blockers_total)`. Analysis completeness averages each capability's completeness metric (STUB 0.15 / PARTIAL 0.55 / COMPLETE 1.0). The blockers are the *last-mile* — clearing them is the final 20%. **Note:** the completeness metric is currently a provisional AI judgment, not a rigorous measurement — it becomes rigorous when Cognitive Studio / Ben land. Marked provisional in code.

Both the dashboard and the blueprint page must read readiness from **one shared module** (a past bug had them computing it two different ways → 40% vs 66% for the same engagement; fixed by unifying).

---

## blueprint.md — only 5 sections render in 2.0

The 2.0 renderer (`V2View`) reads only **5 sections** from `blueprint.md`, by their `<!-- section:ID -->` marker: `infrastructure`, `integrations`, `throughput`, `gap-register`, `sign-off`. Everything else (engagement-summary, capability-map-unit, capability-map-agent, team, work-model, scope) is **1.x-only and ignored** — its 2.0 equivalent comes from the JSON. When migrating an engagement to 2.0, the dead 1.x sections can be removed; the summary/capability-map/team now come from the JSON.

### Gap register + the split
The gap register is a markdown table in `blueprint.md`. It supports a **split** into "Critical Blockers" (gate sign-off) vs "Gaps to resolve in build", driven by a per-row **Blocking** column (Yes/No). The parser (`parseGapRegister`) matches columns by header name (case-insensitive substring), so a `Blocking` column triggers the split; a plain `Blocks` column does not (no substring match). Footer format the parser reads: `**Status:** N gaps open · M blocking sign-off.` (separator must be `·` or `•`). With a Blocking column present, live counts come from the rows (a blocker counts resolved when its status ∈ {answered, closed, resolved, done}); the 20% readiness last-mile is driven by blocker resolution.

---

## The Console (polynize-ai)

Next.js App Router, deployed on Vercel, auto-deploys on push to `origin/main`. Pages are `force-dynamic` (no read caching) so a repo push is immediately live.

### Auth & roles
Roles are determined by **email allowlist via environment variables** (no user DB):
- `CONSOLE_ALLOWED_EMAILS` → **team** scope (sees all engagements, can edit).
- `CONSOLE_CLIENT_EMAILS` (an `email:slug` map) → **client** scope (sees only that one slug, read-only + the two narrow write paths).
- In both → team wins. In neither → cannot sign in.
- Sign-in is **passwordless magic-link via Resend** (enter email → link emailed → click → session). Scope is baked into the session.

**Critical gotcha:** because team emails and test emails can share the `polynize.io` domain, a test email accidentally placed in `CONSOLE_ALLOWED_EMAILS` resolves as **team, not client** — silently giving you the team view when you meant to test the client view. Keep test emails out of the team list.

### Access-control enforcement
- All **mutating** routes require team scope (`requireTeamScope`) **except** the two deliberate client-write paths.
- All **read** routes are gated by `authorizeClientAccess(scope, slug)` — a client gets 404 on any slug that isn't theirs (cross-tenant is sealed: confirmed no leak).
- The two client-write paths, each tightly scoped and unit-tested:
  1. **Questions** (`POST …/questions` add, `…/questions/[id]` update) — a client may add a question on their own slug and edit their own *open* question's text; status/answers are team-only.
  2. **SoW fields + signing** (`…/sow/field`, `…/sow/sign`) — a client may edit only their own client-owned (orange) SoW fields, and sign only when all their fields are filled.

---

## The SoW (Statement of Works) system

The SoW is generated by merging Blueprint data into a fixed legal template, then completed by humans and signed by the client. It is the engagement's commercial agreement.

### Generation & merge
"Generate SoW" merges `capability-map.json` + `engagement-model.json` into the SoW structure. Field types:
- **AUTO** — filled from the Blueprint (engagement name, agent team table with the team leader first, background, in/out scope, the capability schedule, targets from benchmarks, motions, the 8-stage build sequence). ~80% of the body.
- **HUMAN** — commercial/legal fields not in the Blueprint, rendered as fillable badges. Each is **owned** by either Polynize or the client (drives colour — see below).
- **STATIC** — the Service Agreement boilerplate (clauses 1–25 + schedules), which rides as Annexure A. Schedule 1 just points to the SoW (no duplication).

### The two-colour fill system
- **Mint** (#4de8a0, Polynize brand) = Polynize-owned fields (commercial + Polynize-entity + signatory + the fee schedule).
- **Orange** = client-owned fields (the client's own entity facts: legal name, ACN/ABN, address, contact, billing email).
- A key at the top explains the colours. Two counters track Polynize-remaining and client-remaining.
- **Role-aware display:** team sees both colours and edits all. A client sees their orange fields to fill, sees filled Polynize values, and sees *unfilled* Polynize fields as plain blank underlines — **never** the mint "to-do" badge (clients don't see our internal to-do state).

### The fee schedule (§9.1) — the engagement lifecycle
Four rows reflecting Modelling → Build → Operate:
1. **Modelling fee** — `[Paid]` tag (settled before signing), amount is a mint NEEDS-INPUT field (`modelling_fee`).
2. **Build commencement** — on signing (Gate 03), `milestone_build_amount`.
3. **Handoff** — on acceptance (Gate 04), `milestone_handoff_amount`.
4. **Operate (monthly)** — "starting [date]", a mint NEEDS-INPUT start date (`operate_start_date`) + the monthly fee (the `support_fee`/`support_period` keys, relabelled "Operate" in display only — keys kept so filled data isn't orphaned).

Note: "Support" remains the **defined legal term** in the Service Agreement clauses (clause 19, Schedules 2 & 4) — only the §9.1 fee row and field *labels* moved to "Operate". The legal term was deliberately left untouched (a defined-term rename needs a legal review, not a find-replace).

### The signing flow (DocuSign-style)
- **Polynize signature** is pre-filled from the start: "Marrs Coiro" rendered in a cursive web font (Dancing Script), with title/date beneath.
- **Client signature**: types name → renders live in cursive → "Submit signature". Gated: a client can sign **only after all their orange fields are filled** ("N fields to complete" → "Ready to sign").
- **Lock on signing:** signing writes `signing { locked, client_signature, signed_by, signed_at }` to sow.json. A locked SoW is **read-only, enforced server-side** (the field route returns 423 when locked, for client *and* team — not just hidden in the UI).
- **Team unlock:** team-only; clears the client signature (re-signing required, since the doc could change), records who/when. The Polynize pre-signature stays.
- **Regenerate on a locked SoW is blocked (423)** — a signed agreement is never silently overwritten; unlock first (which clears the signature).
- **Regenerate preserves filled HUMAN fields** (both mint and orange) — it refreshes AUTO from the Blueprint but keeps any field a human actually filled. (A field is "user-set" if it differs from its registry default and is non-empty.)
- **Send to client:** team-only, appears only when all mint (Polynize) fields are filled, opens a mailto with the SoW link + a message.
- **Print / Save as PDF:** browser-print with a print stylesheet — strips Console chrome, paginates (Annexure A on a fresh page, table headers repeat), forces black text, and renders unfilled fields as blank underscores (not badges). Also surfaces at the signing block once signed.

---

## Deploy discipline (the manual safety routine)

There is no staging environment (see the maturity report — this is a known gap). The current discipline, when a change touches both Console code and engagement data:

1. Commit + push the **polynize-ai (Console)** change first.
2. Poll the Vercel deploy until **success**.
3. *Then* push the engagement **data**.

Rationale: new-shape data must never be read by an old schema. If the data lands before the schema that understands it is live, the blueprint breaks (parse fails → empty state). Data-only changes (no schema change) need no deploy ordering. **Concurrent pushes happen** (Console-side edits land while CC works) — the move is to fast-forward/rebase and preserve the other change (this has occurred several times and been handled by clean rebases).

---

## The transform engine (current state vs intended)

**Intended:** an agent (**Ben**, CS-01 Intelligence Architect) ingests meeting transcripts and writes the structured Blueprint JSON into the engagement repo, from which the Console renders. Ben's transform cognition depends on **Cognitive Studio** (Shourov's rigorous capability/benchmark transform engine, landing ~next week), which will export a markdown seed that imports into PAM.

**Current (interim):** the four live blueprints were built by a **manual "Cognitive Studio emulator"** — a fresh Claude chat in each engagement's project, given the canonical schema as a literal template, producing the two JSON files, which were then validated and committed. The hard-won lesson: **give the transform a *real committed example file* as the template, not a described schema** — described schemas drift (EverStock 26 issues, Newkind 83 issues), a real-file template comes back clean (reMYnd 0 issues). This is the spec for Ben: a hard contract, not a paraphrase.

---

## Other infrastructure (named systems)

- **Hermes** — the orchestration runtime the production agents run on (AWS Lightsail + Bedrock model routing).
- **Orthogonal** — the skills gateway / marketplace (agents acquire skills here).
- **Hindsight** — the long-term memory substrate (replaced an earlier Neo4j approach).
- **Cognitive Studio** — Shourov's transform engine (produces cognition/capability files); the upstream dependency for Ben.
- **Build Bench** — the intended testing/deployment pipeline (Cognitive Studio → validation + infra selection → Lightsail production); R2-D2 is the intended orchestrator. Currently run manually for the first client (Roxy) to build the runbook before automating.
- **Supabase** — CRM data (the `crm` schema; reads use `Accept-Profile: crm`, writes use `Content-Profile: crm` — asymmetric; needs the service-role key, not anon, for cross-schema access).

---

## Quick map: where things live

| If you need to change… | Look in… |
|---|---|
| How a blueprint renders | polynize-ai: `V2View` + the section components |
| The capability-map read shape | polynize-ai: `schema-v2.ts` (lenient read path) |
| The capability-map generation gate | polynize-ai: `capability-map-schema-v05.ts` + `capability-map-prompt.ts` |
| Readiness math | polynize-ai: the shared readiness module + `load-readiness.ts` |
| The gap-register parsing/split | polynize-ai: `parseGapRegister` + `GapRegister` |
| The SoW merge / fields / signing | polynize-ai: `lib/sow/` (`template.ts`, `generate.ts`, `sow-io.ts`) + the SoW route + `SowDocument` |
| Auth / roles | polynize-ai: the auth/scope resolver + `requireTeamScope` / `authorizeClientAccess` |
| A specific engagement's data | that engagement's repo (`roxburys` / `everstock` / `newkind` / `remynd`) |
| Engagement metadata (phase, status, RAG) | that repo's `.polynize/client-config.yaml` |
